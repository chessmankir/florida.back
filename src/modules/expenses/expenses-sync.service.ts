import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExpensesClient } from './clients/expenses.client.js';
import { ExpensesMapper } from './mappers/expenses.mapper.js';
import { CashOut } from './models/cash-out.model.js';
import { ExpenseItem } from './models/expense-item.model.js';
import { PaymentOut } from './models/payment-out.model.js';
import { ExpensesRepository } from './expenses.repository.js';

import type { ExpenseRemotePage, ExpensesSyncResult } from './types/expenses.types.js';

@Injectable()
export class ExpensesSyncService {
    private readonly logger = new Logger(ExpensesSyncService.name);

    private readonly pageSize: number;

    public constructor(
        config: ConfigService,
        private readonly client: ExpensesClient,
        private readonly repository: ExpensesRepository
    ) {
        this.pageSize = Math.min(Math.max(config.get<number>('MOYSKLAD_EXPENSES_PAGE_SIZE', 1000), 1), 1000);
    }

    public async syncAll(): Promise<ExpensesSyncResult> {
        /*
         * Порядок важен: сначала справочник,
         * затем банковские и наличные выплаты.
         */
        const expenseItems = await this.syncExpenseItems();

        const paymentOuts = await this.syncPaymentOuts();

        const cashOuts = await this.syncCashOuts();

        return {
            expenseItems,
            paymentOuts,
            cashOuts,
            total: expenseItems + paymentOuts + cashOuts,
        };
    }

    private async syncExpenseItems(): Promise<number> {
        return this.syncCollection({
            name: 'expenseitem',
            loadPage: (offset) =>
                this.client.getExpenseItems({
                    limit: this.pageSize,
                    offset,
                }),
            map: (row, syncedAt) => ExpensesMapper.toExpenseItem(row, syncedAt),
            save: (rows) => this.repository.upsertExpenseItems(rows),
            deleteMissing: (ids) => this.repository.deleteMissingExpenseItems(ids),
        });
    }

    private async syncPaymentOuts(): Promise<number> {
        return this.syncCollection({
            name: 'paymentout',
            loadPage: (offset) =>
                this.client.getPaymentOuts({
                    limit: this.pageSize,
                    offset,
                }),
            map: (row, syncedAt) => ExpensesMapper.toPaymentOut(row, syncedAt),
            save: (rows) => this.repository.upsertPaymentOuts(rows),
            deleteMissing: (ids) => this.repository.deleteMissingPaymentOuts(ids),
        });
    }

    private async syncCashOuts(): Promise<number> {
        return this.syncCollection({
            name: 'cashout',
            loadPage: (offset) =>
                this.client.getCashOuts({
                    limit: this.pageSize,
                    offset,
                }),
            map: (row, syncedAt) => ExpensesMapper.toCashOut(row, syncedAt),
            save: (rows) => this.repository.upsertCashOuts(rows),
            deleteMissing: (ids) => this.repository.deleteMissingCashOuts(ids),
        });
    }

    private async syncCollection<TRemote, TEntity extends { id: string }>(options: {
        name: string;

        loadPage: (offset: number) => Promise<ExpenseRemotePage<TRemote>>;

        map: (row: TRemote, syncedAt: Date) => TEntity;

        save: (rows: TEntity[]) => Promise<number>;

        deleteMissing: (ids: string[]) => Promise<void>;
    }): Promise<number> {
        const syncedAt = new Date();
        const ids = new Set<string>();

        let offset = 0;
        let saved = 0;

        while (true) {
            const page = await options.loadPage(offset);

            const rows = page.rows.map((row) => options.map(row, syncedAt));

            for (const row of rows) {
                ids.add(row.id);
            }

            saved += await options.save(rows);
            offset += page.rows.length;

            this.logger.log({
                event: 'expenses_chunk_saved',
                entity: options.name,
                saved: offset,
                total: page.meta.size,
            });

            if (offset >= page.meta.size) {
                break;
            }
        }

        /*
         * Удаление выполняется только после того,
         * как все страницы успешно загружены.
         */
        await options.deleteMissing([...ids]);

        return saved;
    }
}
