import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExpensesClient } from './clients/expenses.client.js';
import { CashOut } from './models/cash-out.model.js';
import { ExpenseItem } from './models/expense-item.model.js';
import { PaymentOut } from './models/payment-out.model.js';
import { ExpensesRepository } from './expenses.repository.js';
import { ExpensesSyncService } from './expenses-sync.service.js';
import { ExpensesService } from './expenses.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([ExpenseItem, PaymentOut, CashOut], 'seller')],
    providers: [ExpensesClient, ExpensesRepository, ExpensesSyncService, ExpensesService],
    exports: [ExpensesService, ExpensesRepository],
})
export class ExpensesModule {}
