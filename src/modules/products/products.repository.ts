import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductProfit } from './models/product-profit.model.js';
import {
    ProductProfitabilityItem,
    ProductProfitabilityOptions,
    ProductProfitabilityResponse,
    ProductProfitabilitySummary,
} from './types/product-profit.types.js';

@Injectable()
export class ProductsRepository {
    public constructor(
        @InjectRepository(ProductProfit, 'seller')
        private readonly productProfit: Repository<ProductProfit>
    ) {}

    public async upsertProfit(rows: ProductProfit[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.productProfit.upsert(rows, {
            conflictPaths: ['productId', 'periodDate'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    /**
     * Удаляет из дневного снимка товары, которых больше нет
     * в полном ответе API за этот день.
     *
     * Вызывается только после успешной загрузки всех страниц.
     */
    public async deleteMissingForDate(periodDate: string, productIds: string[]): Promise<void> {
        if (productIds.length === 0) {
            await this.productProfit.delete({ periodDate });
            return;
        }

        await this.productProfit.query(
            `
                DELETE FROM product_profit_daily
                WHERE period_date = $1
                  AND NOT (product_id = ANY($2::uuid[]))
            `,
            [periodDate, productIds]
        );
    }

    public async findByPeriod(periodFrom: string, periodTo: string): Promise<ProductProfit[]> {
        return this.productProfit
            .createQueryBuilder('profit')
            .where('profit.period_date >= :periodFrom', { periodFrom })
            .andWhere('profit.period_date <= :periodTo', { periodTo })
            .orderBy('profit.period_date', 'ASC')
            .addOrderBy('profit.name', 'ASC')
            .getMany();
    }

    public async findProfitability(
        options: ProductProfitabilityOptions,
    ): Promise<ProductProfitabilityResponse> {
        const sortColumns = {
            grossProfit: 'gross_profit_minor',
            soldQuantity: 'sold_quantity',
            revenue: 'revenue_minor',
            cost: 'cost_minor',
            marginPercent: 'margin_percent',
            returnRatePercent: 'return_rate_percent',
            name: 'name',
        } as const;

        /*
         * Название SQL-колонки выбирается только из фиксированного списка.
         * Пользовательское значение напрямую в SQL не подставляется.
         */
        const sortColumn = sortColumns[options.sortBy];

        const sortDirection =
            options.sortDirection === 'asc'
                ? 'ASC'
                : 'DESC';

        const offset =
            (options.page - 1) * options.limit;

        const parameters = [
            options.dateFrom,
            options.dateTo,
            options.search,
        ];

        const commonQuery = `
        WITH aggregated AS (
            SELECT
                product_id,

                SUM(sell_quantity) AS sold_quantity,
                SUM(return_quantity) AS return_quantity,

                SUM(
                    sell_quantity - return_quantity
                ) AS net_sold_quantity,

                SUM(
                    sell_sum_minor - return_sum_minor
                ) AS revenue_minor,

                SUM(
                    sell_cost_sum_minor -
                    return_cost_sum_minor
                ) AS cost_minor,

                SUM(profit_minor) AS gross_profit_minor
            FROM product_profit_daily
            WHERE period_date >= $1::date
              AND period_date <= $2::date
            GROUP BY product_id
        ),

        latest_product_data AS (
            SELECT DISTINCT ON (product_id)
                product_id,
                product_type,
                name,
                code,
                article
            FROM product_profit_daily
            WHERE period_date >= $1::date
              AND period_date <= $2::date
            ORDER BY
                product_id,
                period_date DESC
        ),

        profitability AS (
            SELECT
                aggregated.product_id,
                latest.product_type,
                latest.name,
                latest.code,
                latest.article,

                aggregated.sold_quantity,
                aggregated.return_quantity,
                aggregated.net_sold_quantity,

                aggregated.revenue_minor,
                aggregated.cost_minor,
                aggregated.gross_profit_minor,

                CASE
                    WHEN aggregated.revenue_minor = 0
                        THEN 0
                    ELSE ROUND(
                        (
                            aggregated.gross_profit_minor /
                            aggregated.revenue_minor
                        ) * 100,
                        4
                    )
                END AS margin_percent,

                CASE
                    WHEN aggregated.sold_quantity = 0
                        THEN 0
                    ELSE ROUND(
                        (
                            aggregated.return_quantity /
                            aggregated.sold_quantity
                        ) * 100,
                        4
                    )
                END AS return_rate_percent
            FROM aggregated
            INNER JOIN latest_product_data AS latest
                ON latest.product_id =
                   aggregated.product_id
            WHERE (
                $3::text IS NULL
                OR latest.name ILIKE
                    '%' || $3::text || '%'
                OR latest.code ILIKE
                    '%' || $3::text || '%'
                OR latest.article ILIKE
                    '%' || $3::text || '%'
            )
        )
    `;

        const itemsQuery = `
        ${commonQuery}

        SELECT
            product_id::text AS "productId",
            product_type AS "productType",
            name,
            code,
            article,

            sold_quantity AS "soldQuantity",
            return_quantity AS "returnQuantity",
            net_sold_quantity AS "netSoldQuantity",

            revenue_minor AS "revenueMinor",
            cost_minor AS "costMinor",
            gross_profit_minor AS "grossProfitMinor",

            margin_percent AS "marginPercent",
            return_rate_percent AS "returnRatePercent"
        FROM profitability
        ORDER BY
            ${sortColumn} ${sortDirection},
            product_id ASC
        LIMIT $4
        OFFSET $5
    `;

        const summaryQuery = `
        ${commonQuery}

        SELECT
            COUNT(*)::integer AS "productsCount",

            COALESCE(
                SUM(sold_quantity),
                0
            ) AS "soldQuantity",

            COALESCE(
                SUM(return_quantity),
                0
            ) AS "returnQuantity",

            COALESCE(
                SUM(net_sold_quantity),
                0
            ) AS "netSoldQuantity",

            COALESCE(
                SUM(revenue_minor),
                0
            ) AS "revenueMinor",

            COALESCE(
                SUM(cost_minor),
                0
            ) AS "costMinor",

            COALESCE(
                SUM(gross_profit_minor),
                0
            ) AS "grossProfitMinor",

            CASE
                WHEN COALESCE(
                    SUM(revenue_minor),
                    0
                ) = 0
                    THEN 0
                ELSE ROUND(
                    (
                        SUM(gross_profit_minor) /
                        SUM(revenue_minor)
                    ) * 100,
                    4
                )
            END AS "marginPercent",

            CASE
                WHEN COALESCE(
                    SUM(sold_quantity),
                    0
                ) = 0
                    THEN 0
                ELSE ROUND(
                    (
                        SUM(return_quantity) /
                        SUM(sold_quantity)
                    ) * 100,
                    4
                )
            END AS "returnRatePercent"
        FROM profitability
    `;

        const [itemsResult, summaryResult] =
            await Promise.all([
                this.productProfit.query(
                    itemsQuery,
                    [
                        ...parameters,
                        options.limit,
                        offset,
                    ],
                ),
                this.productProfit.query(
                    summaryQuery,
                    parameters,
                ),
            ]);

        const items =
            itemsResult as ProductProfitabilityItem[];

        const rawSummary = summaryResult[0] as
            ProductProfitabilitySummary | undefined;

        const summary: ProductProfitabilitySummary =
            rawSummary ?? {
                productsCount: 0,
                soldQuantity: '0',
                returnQuantity: '0',
                netSoldQuantity: '0',
                revenueMinor: '0',
                costMinor: '0',
                grossProfitMinor: '0',
                marginPercent: '0',
                returnRatePercent: '0',
            };

        const totalItems = Number(
            summary.productsCount,
        );

        return {
            period: {
                dateFrom: options.dateFrom,
                dateTo: options.dateTo,
            },
            summary: {
                ...summary,
                productsCount: totalItems,
            },
            items,
            pagination: {
                page: options.page,
                limit: options.limit,
                totalItems,
                totalPages:
                    totalItems === 0
                        ? 0
                        : Math.ceil(
                            totalItems / options.limit,
                        ),
            },
        };
    }
}
