import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CashOut } from './models/cash-out.model.js';
import { ExpenseItem } from './models/expense-item.model.js';
import { PaymentOut } from './models/payment-out.model.js';
import {
    ExpenseAnalyticsItem,
    ExpenseAnalyticsOptions,
    ExpenseAnalyticsResponse,
    ExpenseAnalyticsSummary,
    ExpenseCategorySummary,
} from './types/expenses.types.js';
import { ExpenseLoss } from './models/loss.model.js';
import { ExpenseLossPosition } from './models/loss-position.model.js';

@Injectable()
export class ExpensesRepository {
    public constructor(
        @InjectRepository(ExpenseItem, 'florida')
        private readonly expenseItems: Repository<ExpenseItem>,

        @InjectRepository(PaymentOut, 'florida')
        private readonly paymentOuts: Repository<PaymentOut>,

        @InjectRepository(CashOut, 'florida')
        private readonly cashOuts: Repository<CashOut>,

        @InjectRepository(ExpenseLoss, 'florida')
        private readonly losses: Repository<ExpenseLoss>,

        @InjectRepository(ExpenseLossPosition, 'florida')
        private readonly lossPositions: Repository<ExpenseLossPosition>
    ) {}

    public async saveLossChunk(accountId: string, losses: ExpenseLoss[], positions: ExpenseLossPosition[]): Promise<number> {
        if (losses.length === 0) {
            return 0;
        }

        const lossIds = losses.map((loss) => loss.id);

        await this.losses.manager.transaction(async (manager) => {
            await manager.upsert(ExpenseLoss, losses.map((row) => ({ ...row, accountId })), ['id']);

            /*
             * Состав списания полностью заменяется,
             * чтобы удалённые позиции не оставались
             * в локальной базе.
             */
            await manager.delete(ExpenseLossPosition, {
                accountId,
                lossId: In(lossIds),
            });

            if (positions.length > 0) {
                await manager.insert(ExpenseLossPosition, positions.map((row) => ({ ...row, accountId })));
            }
        });

        return losses.length;
    }

    public async deleteMissingLosses(
        accountId: string, lossIds: string[],
    ): Promise<void> {
        await this.losses.manager.transaction(
            async (manager) => {
                if (lossIds.length === 0) {
                    await manager.query(
                        'DELETE FROM expense_loss_positions WHERE account_id = $1', [accountId]
                    );

                    await manager.query(
                        'DELETE FROM expense_losses WHERE account_id = $1', [accountId]
                    );

                    return;
                }

                await manager.query(
                    `
                        DELETE FROM expense_loss_positions
                        WHERE NOT (
                            loss_id = ANY($1::uuid[])
                            )
                          AND account_id = $2::uuid
                    `,
                    [lossIds, accountId],
                );

                await manager.query(
                    `
                        DELETE FROM expense_losses
                        WHERE NOT (
                            id = ANY($1::uuid[])
                            )
                          AND account_id = $2::uuid
                    `,
                    [lossIds, accountId],
                );
            },
        );
    }

    public async upsertExpenseItems(accountId: string, rows: ExpenseItem[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.expenseItems.upsert(rows.map((row) => ({ ...row, accountId })), {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public async upsertPaymentOuts(accountId: string, rows: PaymentOut[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.paymentOuts.upsert(rows.map((row) => ({ ...row, accountId })), {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public async upsertCashOuts(accountId: string, rows: CashOut[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.cashOuts.upsert(rows.map((row) => ({ ...row, accountId })), {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public deleteMissingExpenseItems(accountId: string, ids: string[]): Promise<void> {
        return this.deleteMissing(accountId, 'expense_items', ids);
    }

    public deleteMissingPaymentOuts(accountId: string, ids: string[]): Promise<void> {
        return this.deleteMissing(accountId, 'expense_payment_outs', ids);
    }

    public deleteMissingCashOuts(accountId: string, ids: string[]): Promise<void> {
        return this.deleteMissing(accountId, 'expense_cash_outs', ids);
    }

    private async deleteMissing(accountId: string, tableName: 'expense_items' | 'expense_payment_outs' | 'expense_cash_outs', ids: string[]): Promise<void> {
        if (ids.length === 0) {
            await this.expenseItems.manager.query(`DELETE FROM ${tableName} WHERE account_id = $1`, [accountId]);

            return;
        }

        await this.expenseItems.manager.query(
            `
                DELETE FROM ${tableName}
                WHERE NOT (
                    id = ANY($1::uuid[])
                )
                  AND account_id = $2::uuid
            `,
            [ids, accountId]
        );
    }

    public async findAnalytics(options: ExpenseAnalyticsOptions): Promise<ExpenseAnalyticsResponse> {
        const sortColumns = {
            moment: 'moment',
            sum: 'sum_minor',
            expenseItem: 'expense_item_name',
            name: 'name',
        } as const;

        /*
         * В SQL подставляется значение только
         * из фиксированного списка.
         */
        const sortColumn = sortColumns[options.sortBy];

        const sortDirection = options.sortDirection === 'asc' ? 'ASC' : 'DESC';

        const offset = (options.page - 1) * options.limit;

        const parameters = [
            options.dateFrom,
            options.dateTo,
            options.paymentType,
            options.expenseItemId,
            options.includeUnposted,
            options.search,
            options.accountId,
        ];

        const commonQuery = `
        WITH combined_expenses AS (
            SELECT
                id,
                'paymentout'::text AS payment_type,
                name,
                description,
                moment,
                is_posted,
                sum_minor,
                vat_sum_minor,
                expense_item_id,
                organization_id,
                organization_account_id,
                agent_id,
                agent_type,
                project_id
            FROM expense_payment_outs
            WHERE account_id = $7::uuid

            UNION ALL

            SELECT
                id,
                'cashout'::text AS payment_type,
                name,
                description,
                moment,
                is_posted,
                sum_minor,
                vat_sum_minor,
                expense_item_id,
                organization_id,
                NULL::uuid AS organization_account_id,
                agent_id,
                agent_type,
                project_id
            FROM expense_cash_outs
            WHERE account_id = $7::uuid

            UNION ALL

            SELECT
                id,
                'loss'::text AS payment_type,
                name,
                description,
                moment,
                is_posted,
                sum_minor,
                NULL::numeric AS vat_sum_minor,
                NULL::uuid AS expense_item_id,
                organization_id,
                NULL::uuid AS organization_account_id,
                NULL::uuid AS agent_id,
                NULL::text AS agent_type,
                project_id
            FROM expense_losses
            WHERE account_id = $7::uuid
        ),

        filtered_expenses AS (
            SELECT
                expense.id,
                expense.payment_type,
                expense.name,
                expense.description,
                expense.moment,
                expense.is_posted,
                expense.sum_minor,
                expense.vat_sum_minor,

                expense.expense_item_id,

                CASE
                    WHEN expense.payment_type = 'loss'
                        THEN 'Списания'
                    ELSE COALESCE(
                        item.name,
                        'Без статьи расходов'
                         )
                    END AS expense_item_name,

                expense.organization_id,
                expense.organization_account_id,
                expense.agent_id,
                expense.agent_type,
                expense.project_id

            FROM combined_expenses AS expense

            LEFT JOIN expense_items AS item
                ON item.id =
                   expense.expense_item_id
               AND item.account_id = $7::uuid

            WHERE expense.moment >= $1::date
              AND expense.moment <
                  ($2::date + INTERVAL '1 day')

              AND (
                  $3::text = 'all'
                  OR expense.payment_type =
                     $3::text
              )

              AND (
                  $4::uuid IS NULL
                  OR expense.expense_item_id =
                     $4::uuid
              )

              AND (
                  $5::boolean = true
                  OR expense.is_posted = true
              )

              AND (
                  $6::text IS NULL
                  OR expense.name ILIKE
                     '%' || $6::text || '%'
                  OR expense.description ILIKE
                     '%' || $6::text || '%'
                  OR item.name ILIKE
                     '%' || $6::text || '%'
              )
        )
    `;

        const itemsQuery = `
        ${commonQuery}

        SELECT
            id::text AS "id",
            payment_type AS "paymentType",

            name,
            description,
            moment,
            is_posted AS "isPosted",

            sum_minor AS "sumMinor",
            vat_sum_minor AS "vatSumMinor",

            expense_item_id::text
                AS "expenseItemId",

            expense_item_name
                AS "expenseItemName",

            organization_id::text
                AS "organizationId",

            organization_account_id::text
                AS "organizationAccountId",

            agent_id::text AS "agentId",
            agent_type AS "agentType",

            project_id::text AS "projectId"

            , CASE WHEN payment_type = 'loss' THEN COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', position.id::text,
                        'assortmentId', position.assortment_id::text,
                        'assortmentType', position.assortment_type,
                        'name', COALESCE(inventory.name, 'Товар ' || COALESCE(position.assortment_id::text, 'не указан')),
                        'quantity', position.quantity::text,
                        'priceMinor', position.price_minor::text,
                        'totalMinor', position.total_minor::text
                    ) ORDER BY COALESCE(inventory.name, ''), position.id
                )
                FROM expense_loss_positions position
                LEFT JOIN moysklad_inventory_products inventory
                  ON inventory.account_id = $7::uuid
                 AND inventory.id = position.assortment_id
                WHERE position.account_id = $7::uuid
                  AND position.loss_id = filtered_expenses.id
            ), '[]'::jsonb) ELSE '[]'::jsonb END AS positions

        FROM filtered_expenses

        ORDER BY
            ${sortColumn} ${sortDirection},
            id ASC

        LIMIT $8
        OFFSET $9
    `;

        const summaryQuery = `
        ${commonQuery}

        SELECT
            COUNT(*)::integer
                AS "paymentsCount",

            COALESCE(
                SUM(sum_minor),
                0
            ) AS "totalMinor",

            COALESCE(
                SUM(sum_minor) FILTER (
                    WHERE payment_type =
                          'paymentout'
                ),
                0
            ) AS "paymentOutMinor",

            COALESCE(
                SUM(sum_minor) FILTER (
                    WHERE payment_type =
                          'cashout'
                ),
                0
            ) AS "cashOutMinor",
            COALESCE(
                SUM(sum_minor) FILTER (
                WHERE payment_type = 'loss'
    ),
                0
            ) AS "lossMinor"
        

        FROM filtered_expenses
    `;

        const categoriesQuery = `
        ${commonQuery}

        SELECT
            expense_item_id::text
                AS "expenseItemId",

            expense_item_name
                AS "expenseItemName",

            COUNT(*)::integer
                AS "paymentsCount",

            COALESCE(
                SUM(sum_minor),
                0
            ) AS "totalMinor",

            CASE
                WHEN COALESCE(
                    SUM(
                        SUM(sum_minor)
                    ) OVER (),
                    0
                ) = 0
                    THEN 0
                ELSE ROUND(
                    (
                        SUM(sum_minor) /
                        SUM(
                            SUM(sum_minor)
                        ) OVER ()
                    ) * 100,
                    4
                )
            END AS "sharePercent"

        FROM filtered_expenses

        GROUP BY
            expense_item_id,
            expense_item_name

        ORDER BY
            SUM(sum_minor) DESC,
            expense_item_name ASC
    `;

        const [itemsResult, summaryResult, categoriesResult] = await Promise.all([
            this.expenseItems.manager.query(itemsQuery, [...parameters, options.limit, offset]),

            this.expenseItems.manager.query(summaryQuery, parameters),

            this.expenseItems.manager.query(categoriesQuery, parameters),
        ]);

        const items = itemsResult as ExpenseAnalyticsItem[];

        const categories = categoriesResult as ExpenseCategorySummary[];

        const rawSummary = summaryResult[0] as ExpenseAnalyticsSummary | undefined;

        const summary: ExpenseAnalyticsSummary = rawSummary ?? {
            paymentsCount: 0,
            totalMinor: '0',
            paymentOutMinor: '0',
            cashOutMinor: '0',
            lossMinor: '0',
        };

        const totalItems = Number(summary.paymentsCount);

        return {
            period: {
                dateFrom: options.dateFrom,
                dateTo: options.dateTo,
            },

            filters: {
                paymentType: options.paymentType,

                expenseItemId: options.expenseItemId,

                includeUnposted: options.includeUnposted,

                search: options.search,
            },

            summary: {
                ...summary,
                paymentsCount: totalItems,
            },

            categories,
            items,

            pagination: {
                page: options.page,
                limit: options.limit,
                totalItems,
                totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / options.limit),
            },
        };
    }
}

