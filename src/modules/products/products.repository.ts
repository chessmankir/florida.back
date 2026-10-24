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
        @InjectRepository(ProductProfit, 'florida')
        private readonly productProfit: Repository<ProductProfit>
    ) {}

    public async upsertProfit(accountId: string, rows: ProductProfit[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.productProfit.upsert(rows.map((row) => ({ ...row, accountId })), {
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
    public async deleteMissingForDate(accountId: string, periodDate: string, productIds: string[]): Promise<void> {
        if (productIds.length === 0) {
            await this.productProfit.delete({ accountId, periodDate });
            return;
        }

        await this.productProfit.query(
            `
                DELETE FROM product_profit_daily
                WHERE period_date = $1
                  AND NOT (product_id = ANY($2::uuid[]))
                  AND account_id = $3::uuid
            `,
            [periodDate, productIds, accountId]
        );
    }

    public async findByPeriod(accountId: string, periodFrom: string, periodTo: string): Promise<ProductProfit[]> {
        return this.productProfit
            .createQueryBuilder('profit')
            .where('profit.accountId = :accountId', { accountId })
            .andWhere('profit.period_date >= :periodFrom', { periodFrom })
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
            options.accountId,
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
              AND account_id = $4::uuid
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
              AND account_id = $4::uuid
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
        LIMIT $5
        OFFSET $6
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

    public async findConsumption(accountId: string, page: number, limit: number, search: string | null, sortDirection: 'asc' | 'desc', endingWithinWeek: boolean, periodDays: number) {
        const offset = (page - 1) * limit;
        const latestRows = await this.productProfit.query(
            `SELECT MAX(period_date)::text AS "latestDate" FROM product_profit_daily WHERE account_id = $1::uuid`,
            [accountId]
        ) as Array<{ latestDate: string | null }>;
        const latestDate = latestRows[0]?.latestDate ?? new Date().toISOString().slice(0, 10);
        const rows = await this.productProfit.query(`
            WITH sales AS (
                SELECT product_id, SUM(sell_quantity - return_quantity) AS sold_quantity
                FROM product_profit_daily
                WHERE account_id = $1::uuid
                  AND product_type = 'product'
                  AND period_date >= $7::date - (($6::integer - 1) * INTERVAL '1 day')
                  AND period_date <= $7::date
                GROUP BY product_id
            ), report AS (
                SELECT inventory.id, inventory.name, inventory.code, inventory.article, GREATEST(inventory.available, 0) AS available,
                       GREATEST(sales.sold_quantity, 0) AS sold_quantity,
                       GREATEST(sales.sold_quantity, 0) / $6::numeric AS average_daily
                FROM moysklad_inventory_products inventory
                INNER JOIN sales ON sales.product_id = inventory.id
                WHERE inventory.account_id = $1::uuid AND COALESCE(inventory.archived, false) = false
                  AND inventory.product_type = 'product'
                  AND sales.sold_quantity > 0
                  AND ($2::text IS NULL OR inventory.name ILIKE '%' || $2 || '%' OR inventory.code ILIKE '%' || $2 || '%' OR inventory.article ILIKE '%' || $2 || '%')
            ), filtered AS (
                SELECT *, CASE WHEN average_daily > 0 THEN available / average_daily ELSE NULL END AS days_remaining
                FROM report
                WHERE $5::boolean = false OR (average_daily > 0 AND available / average_daily <= 7)
            )
            SELECT id::text AS "productId", name, code, article, available::text AS available,
                   sold_quantity::text AS "soldQuantity", ROUND(average_daily, 2)::text AS "averageDaily",
                   CASE WHEN days_remaining IS NOT NULL THEN ROUND(days_remaining, 1)::text ELSE NULL END AS "daysRemaining",
                   CASE WHEN days_remaining IS NOT NULL THEN ($7::date + CEIL(days_remaining)::integer)::text ELSE NULL END AS "expectedOutOfStockDate",
                   COUNT(*) OVER()::integer AS "totalItems"
            FROM filtered ORDER BY days_remaining ${sortDirection === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, name ASC
            LIMIT $3 OFFSET $4
        `, [accountId, search, limit, offset, endingWithinWeek, periodDays, latestDate]) as Array<Record<string, unknown>>;
        const totalItems = Number(rows[0]?.totalItems ?? 0);
        const dateFrom = new Date(`${latestDate}T00:00:00.000Z`);
        dateFrom.setUTCDate(dateFrom.getUTCDate() - (periodDays - 1));
        return { period: { dateFrom: dateFrom.toISOString().slice(0, 10), dateTo: latestDate, days: periodDays }, items: rows.map(({ totalItems: _, ...row }) => row), pagination: { page, limit, totalItems, totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit) } };
    }
}

