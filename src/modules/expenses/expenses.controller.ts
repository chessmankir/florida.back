import { Controller, Get, Query } from '@nestjs/common';

import { ExpensesService } from './expenses.service.js';

import type { ExpenseAnalyticsResponse } from './types/expenses.types.js';

@Controller('analytics/expenses')
export class ExpensesController {
    public constructor(private readonly expenses: ExpensesService) {}

    @Get()
    public getAnalytics(
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
        return this.expenses.getAnalytics({
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
