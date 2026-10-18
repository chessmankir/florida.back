import { Controller, Get, Headers, Query } from '@nestjs/common';

import { ExpensesService } from './expenses.service.js';

import type { ExpenseAnalyticsResponse } from './types/expenses.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';

@Controller('analytics/expenses')
export class ExpensesController {
    public constructor(private readonly expenses: ExpensesService, private readonly accounts: AccountAccessService) {}

    @Get()
    public getAnalytics(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('dateFrom')
        dateFrom?: string,

        @Query('dateTo')
        dateTo?: string,

        @Query('paymentType')
        paymentType?: string,

        @Query('expenseItemId')
        expenseItemId?: string,

        @Query('includeUnposted')
        includeUnposted?: string,

        @Query('search')
        search?: string,

        @Query('sortBy')
        sortBy?: string,

        @Query('sortDirection')
        sortDirection?: string,

        @Query('page')
        page?: string,

        @Query('limit')
        limit?: string
    ): Promise<ExpenseAnalyticsResponse> {
        return this.expenses.getAnalytics(this.accounts.authorize(accountIdValue, authorization), {
            dateFrom,
            dateTo,
            paymentType,
            expenseItemId,
            includeUnposted,
            search,
            sortBy,
            sortDirection,
            page,
            limit,
        });
    }
}
