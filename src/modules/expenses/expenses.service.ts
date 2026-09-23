import { Injectable } from '@nestjs/common';

import { ExpensesSyncService } from './expenses-sync.service.js';

import type { ExpensesSyncResult } from './types/expenses.types.js';

@Injectable()
export class ExpensesService {
    public constructor(private readonly synchronization: ExpensesSyncService) {}

    public syncAll(): Promise<ExpensesSyncResult> {
        return this.synchronization.syncAll();
    }
}
