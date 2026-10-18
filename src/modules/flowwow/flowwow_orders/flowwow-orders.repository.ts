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

    public constructor(@InjectDataSource('florida') private readonly database: DataSource) {}

    public async saveChunk(accountId: string, snapshots: FlowwowOrderSnapshot[]): Promise<void> {
        if (snapshots.length === 0) return;

        await this.database.transaction(async (manager) => {
            const orders = snapshots.map((snapshot) => ({ ...snapshot.order, accountId }));
            for (let offset = 0; offset < orders.length; offset += this.batchSize) {
                await manager
                    .createQueryBuilder()
                    .insert()
                    .into(FlowwowOrder)
                    .values(orders.slice(offset, offset + this.batchSize))
                    .orUpdate(
                        [
                            'account_id',
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
                await manager.query(
                    `UPDATE flowwow_order_positions
                     SET account_id = $1
                     WHERE account_id IS NULL AND shop_id = $2 AND order_id = $3`,
                    [accountId, snapshot.order.shopId, snapshot.order.orderId]
                );
                await manager.delete(FlowwowOrderPosition, {
                    accountId,
                    shopId: snapshot.order.shopId,
                    orderId: snapshot.order.orderId,
                });
            }

            const positions = snapshots.flatMap((snapshot) => snapshot.positions.map((position) => ({ ...position, accountId })));
            for (let offset = 0; offset < positions.length; offset += this.batchSize) {
                await manager.insert(FlowwowOrderPosition, positions.slice(offset, offset + this.batchSize));
            }
        });
    }

    public findOne(accountId: string, shopId: number, orderId: number): Promise<FlowwowOrder | null> {
        return this.database.getRepository(FlowwowOrder).findOneBy({ accountId, shopId, orderId });
    }

    public async updateFinanceAmounts(
        accountId: string, shopId: number,
        rows: FlowwowOrderFinanceAmounts[]
    ): Promise<{ updatedOrders: number; missingOrderIds: number[] }> {
        if (rows.length === 0) return { updatedOrders: 0, missingOrderIds: [] };

        const existing = await this.database
            .getRepository(FlowwowOrder)
            .createQueryBuilder('order')
            .select('order.orderId', 'orderId')
            .where('order.shopId = :shopId', { shopId })
            .andWhere('order.accountId = :accountId', { accountId })
            .andWhere('order.orderId IN (:...orderIds)', { orderIds: rows.map((row) => row.orderId) })
            .getRawMany<{ orderId: number | string }>();
        const existingIds = new Set(existing.map((row) => Number(row.orderId)));
        const matched = rows.filter((row) => existingIds.has(row.orderId));

        await this.database.transaction(async (manager) => {
            for (const row of matched) {
                await manager.update(
                    FlowwowOrder,
                    { accountId, shopId, orderId: row.orderId },
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

    public async findOrders(accountId: string, options: FlowwowOrdersListOptions): Promise<FlowwowOrdersListResponse> {
        const parameters = [options.dateFrom, options.dateTo, options.shopId, accountId];
        const where = `
            o.created_at_source >= ($1::date::timestamp AT TIME ZONE 'Europe/Moscow')
            AND o.created_at_source < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow')
            AND ($3::integer IS NULL OR o.shop_id = $3)
            AND o.account_id = $4::uuid
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
                WITH enriched_positions AS (
                    SELECT
                        p.*,
                        link.moysklad_product_id AS bundle_id,
                        ROUND(bundle_cost.bundle_cost_minor / 100, 2) AS unit_cost_amount,
                        ROUND(bundle_cost.bundle_cost_minor * p.quantity / 100, 2) AS total_cost_amount
                    FROM flowwow_order_positions p
                    LEFT JOIN flowwow_product_inventory_links link
                        ON link.shop_id = p.shop_id
                       AND link.flowwow_product_id = p.product_id
                       AND link.account_id = p.account_id
                    LEFT JOIN LATERAL (
                        SELECT SUM(
                            component.quantity
                            * COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor)
                        ) AS bundle_cost_minor
                        FROM moysklad_processing_plan_materials component
                        INNER JOIN moysklad_inventory_products inventory
                            ON inventory.id = component.assortment_id
                           AND inventory.account_id = component.account_id
                        WHERE component.processing_plan_id = link.moysklad_product_id
                          AND component.account_id = link.account_id
                    ) bundle_cost ON true
                )
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
                    CASE
                        WHEN COUNT(p.total_cost_amount) > 0
                        THEN ROUND(SUM(p.total_cost_amount), 2)::text
                        ELSE NULL
                    END AS "costPriceAmount",
                    (
                        COUNT(p.line_index) > 0
                        AND COUNT(p.line_index) = COUNT(p.total_cost_amount)
                    ) AS "costPriceComplete",
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
                                'currencyCode', p.currency_code,
                                'bundleId', p.bundle_id,
                                'unitCostAmount', p.unit_cost_amount::text,
                                'totalCostAmount', p.total_cost_amount::text
                            ) ORDER BY p.line_index
                        ) FILTER (WHERE p.line_index IS NOT NULL),
                        '[]'::json
                    ) AS positions
                FROM flowwow_orders o
                LEFT JOIN flowwow_shops s ON s.shop_id = o.shop_id AND s.account_id = o.account_id
                LEFT JOIN enriched_positions p
                    ON p.shop_id = o.shop_id AND p.order_id = o.order_id AND p.account_id = o.account_id
                WHERE ${where}
                GROUP BY o.shop_id, o.order_id, s.name, s.address
                ORDER BY o.created_at_source DESC, o.order_id DESC
                LIMIT $5 OFFSET $6
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

