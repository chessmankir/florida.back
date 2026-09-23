import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CashOut } from './models/cash-out.model.js';
import { ExpenseItem } from './models/expense-item.model.js';
import { PaymentOut } from './models/payment-out.model.js';

@Injectable()
export class ExpensesRepository {
    public constructor(
        @InjectRepository(ExpenseItem, 'seller')
        private readonly expenseItems: Repository<ExpenseItem>,

        @InjectRepository(PaymentOut, 'seller')
        private readonly paymentOuts: Repository<PaymentOut>,

        @InjectRepository(CashOut, 'seller')
        private readonly cashOuts: Repository<CashOut>
    ) {}

    public async upsertExpenseItems(rows: ExpenseItem[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.expenseItems.upsert(rows, {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public async upsertPaymentOuts(rows: PaymentOut[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.paymentOuts.upsert(rows, {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public async upsertCashOuts(rows: CashOut[]): Promise<number> {
        if (rows.length === 0) {
            return 0;
        }

        await this.cashOuts.upsert(rows, {
            conflictPaths: ['id'],
            skipUpdateIfNoValuesChanged: true,
        });

        return rows.length;
    }

    public deleteMissingExpenseItems(ids: string[]): Promise<void> {
        return this.deleteMissing('expense_items', ids);
    }

    public deleteMissingPaymentOuts(ids: string[]): Promise<void> {
        return this.deleteMissing('expense_payment_outs', ids);
    }

    public deleteMissingCashOuts(ids: string[]): Promise<void> {
        return this.deleteMissing('expense_cash_outs', ids);
    }

    private async deleteMissing(tableName: 'expense_items' | 'expense_payment_outs' | 'expense_cash_outs', ids: string[]): Promise<void> {
        if (ids.length === 0) {
            await this.expenseItems.manager.query(`DELETE FROM ${tableName}`);

            return;
        }

        await this.expenseItems.manager.query(
            `
                DELETE FROM ${tableName}
                WHERE NOT (
                    id = ANY($1::uuid[])
                )
            `,
            [ids]
        );
    }
}
