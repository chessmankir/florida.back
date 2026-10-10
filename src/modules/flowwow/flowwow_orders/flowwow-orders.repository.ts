import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { FlowwowOrder } from './models/flowwow-order.model.js';
import { FlowwowOrderPosition } from './models/flowwow-order-position.model.js';
import type {
    FlowwowOrderListItem,
    FlowwowOrderFinanceAmounts,
    FlowwowOrdersListOptions,
    FlowwowOrdersListResponse,
    FlowwowOrderSnapshot,
} from './types/flowwow-orders.types.js';

@Injectable()
export class FlowwowOrdersRepository {
    private readonly batchSize = 100;

    public constructor(@InjectDataSource('seller') private readonly database: DataSource) {}

    public async saveChunk(snapshots: FlowwowOrderSnapshot[]): Promise<void> {
        if (snapshots.length === 0) return;

        await this.database.transaction(async (manager) => {
            const orders = snapshots.map((snapshot) => snapshot.order);
            for (let offset = 0; offset < orders.length; offset += this.batchSize) {
                await manager
                    .createQueryBuilder()
                    .insert()
                    .into(FlowwowOrder)
                    .values(orders.slice(offset, offset + this.batchSize))
                    .orUpdate(
                        [
                            'status',
                            'delivery_type',
                            'delivery_time_type',
                            'created_at_source',
                            'delivery_date_from',
                            'delivery_date_to',
                            'gross_product_amount',
                            'source_host',
                            'raw_json',
                            'synced_at',
                        ],
                        ['shop_id', 'order_id']
                    )
                    .execute();
            }

            for (const snapshot of snapshots) {
                await manager.delete(FlowwowOrderPosition, {
                    shopId: snapshot.order.shopId,
                    orderId: snapshot.order.orderId,
                });
            }

            const positions = snapshots.flatMap((snapshot) => snapshot.positions);
            for (let offset = 0; offset < positions.length; offset += this.batchSize) {
                await manager.insert(FlowwowOrderPosition, positions.slice(offset, offset + this.batchSize));
            }
        });
    }

    public findOne(shopId: number, orderId: number): Promise<FlowwowOrder | null> {
        return this.database.getRepository(FlowwowOrder).findOneBy({ shopId, orderId });
    }

    public async updateFinanceAmounts(
        shopId: number,
        rows: FlowwowOrderFinanceAmounts[]
    ): Promise<{ updatedOrders: number; missingOrderIds: number[] }> {
        if (rows.length === 0) return { updatedOrders: 0, missingOrderIds: [] };

        const existing = await this.database
            .getRepository(FlowwowOrder)
            .createQueryBuilder('order')
            .select('order.orderId', 'orderId')
            .where('order.shopId = :shopId', { shopId })
            .andWhere('order.orderId IN (:...orderIds)', { orderIds: rows.map((row) => row.orderId) })
            .getRawMany<{ orderId: number | string }>();
        const existingIds = new Set(existing.map((row) => Number(row.orderId)));
        const matched = rows.filter((row) => existingIds.has(row.orderId));

        await this.database.transaction(async (manager) => {
            for (const row of matched) {
                await manager.update(
                    FlowwowOrder,
                    { shopId, orderId: row.orderId },
                    {
                        customerPaidAmount: row.customerPaidAmount,
                        bonusAmount: row.bonusAmount,
                        fixedCommissionAmount: row.fixedCommissionAmount,
                        variableCommissionAmount: row.variableCommissionAmount,
                    }
                );
            }
        });

        return {
            updatedOrders: matched.length,
            missingOrderIds: rows.filter((row) => !existingIds.has(row.orderId)).map((row) => row.orderId),
        };
    }

    public async findOrders(options: FlowwowOrdersListOptions): Promise<FlowwowOrdersListResponse> {
        const parameters = [options.dateFrom, options.dateTo, options.shopId];
        const where = `
            o.created_at_source >= ($1::date::timestamp AT TIME ZONE 'Europe/Moscow')
            AND o.created_at_source < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow')
            AND ($3::integer IS NULL OR o.shop_id = $3)
        `;

        const summaryRows = await this.database.query<Array<{
            total: string;
            turnover: string;
            averageCheck: string;
            commissionExpenses: string;
        }>>(
            `
                SELECT
                    COUNT(*)::text AS total,
                    COALESCE(SUM(o.gross_product_amount), 0)::text AS turnover,
                    COALESCE(AVG(o.gross_product_amount), 0)::text AS "averageCheck",
                    COALESCE(SUM(ABS(
                        COALESCE(o.fixed_commission_amount, 0)
                        + COALESCE(o.variable_commission_amount, 0)
                    )), 0)::text AS "commissionExpenses"
                FROM flowwow_orders o
                WHERE ${where}
            `,
            parameters
        );
        const summary = summaryRows[0] ?? {
            total: '0',
            turnover: '0',
            averageCheck: '0',
            commissionExpenses: '0',
        };
        const total = Number(summary.total);
        const offset = (options.page - 1) * options.limit;

        const items = await this.database.query<FlowwowOrderListItem[]>(
            `
                SELECT
                    o.shop_id AS "shopId",
                    s.name AS "shopName",
                    s.address AS "shopAddress",
                    o.order_id AS "orderId",
                    o.status,
                    o.created_at_source AS "createdAt",
                    o.delivery_date_from AS "deliveryDateFrom",
                    o.delivery_date_to AS "deliveryDateTo",
                    o.gross_product_amount::text AS "grossProductAmount",
                    o.customer_paid_amount::text AS "customerPaidAmount",
                    o.bonus_amount::text AS "bonusAmount",
                    o.fixed_commission_amount::text AS "fixedCommissionAmount",
                    o.variable_commission_amount::text AS "variableCommissionAmount",
                    o.source_host AS "sourceHost",
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'lineIndex', p.line_index,
                                'productId', p.product_id,
                                'offerId', p.offer_id,
                                'name', p.name,
                                'quantity', p.quantity,
                                'costAmount', p.cost_amount::text,
                                'baseAmount', p.base_amount::text,
                                'actualAmount', p.actual_amount::text,
                                'discountAmount', p.discount_amount::text,
                                'priceAfterDiscountAmount', p.price_after_discount_amount::text,
                                'discountPercent', p.discount_percent::text,
                                'currencyCode', p.currency_code
                            ) ORDER BY p.line_index
                        ) FILTER (WHERE p.line_index IS NOT NULL),
                        '[]'::json
                    ) AS positions
                FROM flowwow_orders o
                LEFT JOIN flowwow_shops s ON s.shop_id = o.shop_id
                LEFT JOIN flowwow_order_positions p
                    ON p.shop_id = o.shop_id AND p.order_id = o.order_id
                WHERE ${where}
                GROUP BY o.shop_id, o.order_id, s.name, s.address
                ORDER BY o.created_at_source DESC, o.order_id DESC
                LIMIT $4 OFFSET $5
            `,
            [...parameters, options.limit, offset]
        );

        return {
            period: { dateFrom: options.dateFrom, dateTo: options.dateTo },
            filters: { shopId: options.shopId },
            shops: [],
            summary: {
                ordersCount: total,
                turnover: summary.turnover,
                averageCheck: summary.averageCheck,
                commissionExpenses: summary.commissionExpenses,
            },
            items,
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
            },
        };
    }
}
