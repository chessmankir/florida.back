import { BadRequestException, Injectable } from '@nestjs/common';

import { ExpensesRepository } from './expenses.repository.js';
import { ExpensesSyncService } from './expenses-sync.service.js';

import type {
    ExpenseAnalyticsOptions,
    ExpenseAnalyticsResponse,
    ExpenseAnalyticsSortBy,
    ExpensePaymentType,
    ExpenseSortDirection,
    ExpensesSyncResult,
} from './types/expenses.types.js';

@Injectable()
export class ExpensesService {
    public constructor(
        private readonly synchronization: ExpensesSyncService,
        private readonly repository: ExpensesRepository
    ) {}

    public syncAll(): Promise<ExpensesSyncResult> {
        return this.synchronization.syncAll();
    }

    public getAnalytics(query: {
        dateFrom?: string;
        dateTo?: string;
        paymentType?: string;
        expenseItemId?: string;
        includeUnposted?: string;
        search?: string;
        sortBy?: string;
        sortDirection?: string;
        page?: string;
        limit?: string;
    }): Promise<ExpenseAnalyticsResponse> {
        const dateFrom = this.validateDate(query.dateFrom, 'dateFrom');

        const dateTo = this.validateDate(query.dateTo, 'dateTo');

        if (dateFrom > dateTo) {
            throw new BadRequestException('dateFrom не может быть больше dateTo');
        }

        const paymentTypes: ExpensePaymentType[] = ['all', 'paymentout', 'cashout', 'loss'];

        const paymentType = query.paymentType ?? 'all';

        if (!paymentTypes.includes(paymentType as ExpensePaymentType)) {
            throw new BadRequestException('paymentType должен быть ' + paymentTypes.join(', '));
        }

        const sortFields: ExpenseAnalyticsSortBy[] = ['moment', 'sum', 'expenseItem', 'name'];

        const sortBy = query.sortBy ?? 'moment';

        if (!sortFields.includes(sortBy as ExpenseAnalyticsSortBy)) {
            throw new BadRequestException('Некорректный sortBy. Доступно: ' + sortFields.join(', '));
        }

        const sortDirection = query.sortDirection ?? 'desc';

        if (sortDirection !== 'asc' && sortDirection !== 'desc') {
            throw new BadRequestException('sortDirection должен быть asc или desc');
        }

        const includeUnposted = this.parseBoolean(query.includeUnposted, false, 'includeUnposted');

        const expenseItemId = query.expenseItemId?.trim() || null;

        if (expenseItemId && !this.isUuid(expenseItemId)) {
            throw new BadRequestException('expenseItemId должен быть UUID');
        }

        const search = query.search?.trim() || null;

        if (search && search.length > 100) {
            throw new BadRequestException('search не может быть длиннее 100 символов');
        }

        const page = this.parsePositiveInteger(query.page, 1, 'page');

        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');

        if (limit > 100) {
            throw new BadRequestException('limit не может быть больше 100');
        }

        const options: ExpenseAnalyticsOptions = {
            dateFrom,
            dateTo,

            paymentType: paymentType as ExpensePaymentType,

            expenseItemId,
            includeUnposted,
            search,

            sortBy: sortBy as ExpenseAnalyticsSortBy,

            sortDirection: sortDirection as ExpenseSortDirection,

            page,
            limit,
        };

        return this.repository.findAnalytics(options);
    }

    private validateDate(value: string | undefined, field: string): string {
        if (!value) {
            throw new BadRequestException(`Параметр ${field} обязателен`);
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new BadRequestException(`${field} должен иметь формат YYYY-MM-DD`);
        }

        const date = new Date(`${value}T00:00:00.000Z`);

        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new BadRequestException(`Параметр ${field} содержит некорректную дату`);
        }

        return value;
    }

    private parsePositiveInteger(value: string | undefined, defaultValue: number, field: string): number {
        if (value === undefined) {
            return defaultValue;
        }

        if (!/^\d+$/.test(value)) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }

        const parsed = Number(value);

        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }

        return parsed;
    }

    private parseBoolean(value: string | undefined, defaultValue: boolean, field: string): boolean {
        if (value === undefined) {
            return defaultValue;
        }

        if (value === 'true') {
            return true;
        }

        if (value === 'false') {
            return false;
        }

        throw new BadRequestException(`${field} должен быть true или false`);
    }

    private isUuid(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }
}
