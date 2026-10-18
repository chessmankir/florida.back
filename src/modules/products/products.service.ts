import { BadRequestException, Injectable } from '@nestjs/common';

import { ProductProfit } from './models/product-profit.model.js';
import { ProductsProfitSyncService } from './products-profit-sync.service.js';
import { ProductsRepository } from './products.repository.js';
import {
    ProductProfitabilityOptions,
    ProductProfitabilityResponse,
    ProductProfitabilitySortBy,
    ProductProfitSyncResult,
    SortDirection,
} from './types/product-profit.types.js';

@Injectable()
export class ProductsService {
    public constructor(
        private readonly profitSync: ProductsProfitSyncService,
        private readonly repository: ProductsRepository
    ) {}

    public syncPreviousDay(accountId: string, token: string): Promise<ProductProfitSyncResult> {
        return this.profitSync.syncPreviousDay(accountId, token);
    }

    public syncDay(accountId: string, token: string, day: string): Promise<ProductProfitSyncResult> {
        return this.profitSync.syncDay(accountId, token, day);
    }

    public syncRange(accountId: string, token: string, dateFrom: string, dateTo: string): Promise<ProductProfitSyncResult[]> {
        return this.profitSync.syncRange(accountId, token, dateFrom, dateTo);
    }

    public syncFromDateToToday(accountId: string, token: string, dateFrom: string): Promise<ProductProfitSyncResult[]> {
        const today = this.profitSync.getCurrentMoscowDate();

        return this.profitSync.syncRange(accountId, token, dateFrom, today);
    }

    public getProfit(accountId: string, periodFrom: string, periodTo: string): Promise<ProductProfit[]> {
        return this.repository.findByPeriod(accountId, periodFrom, periodTo);
    }

    public getProfitability(accountId: string, query: {
        dateFrom?: string;
        dateTo?: string;
        sortBy?: string;
        sortDirection?: string;
        page?: string;
        limit?: string;
        search?: string;
    }): Promise<ProductProfitabilityResponse> {
        const dateFrom = this.validateDate(query.dateFrom, 'dateFrom');

        const dateTo = this.validateDate(query.dateTo, 'dateTo');

        if (dateFrom > dateTo) {
            throw new BadRequestException('dateFrom не может быть больше dateTo');
        }

        const allowedSortFields: ProductProfitabilitySortBy[] = [
            'grossProfit',
            'soldQuantity',
            'revenue',
            'cost',
            'marginPercent',
            'returnRatePercent',
            'name',
        ];

        const sortBy = query.sortBy ?? 'grossProfit';

        if (!allowedSortFields.includes(sortBy as ProductProfitabilitySortBy)) {
            throw new BadRequestException(`Некорректный sortBy. Доступно: ` + allowedSortFields.join(', '));
        }

        const sortDirection = query.sortDirection ?? 'desc';

        if (sortDirection !== 'asc' && sortDirection !== 'desc') {
            throw new BadRequestException('sortDirection должен быть asc или desc');
        }

        const page = this.parsePositiveInteger(query.page, 1, 'page');

        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');

        if (limit > 100) {
            throw new BadRequestException('limit не может быть больше 100');
        }

        const search = query.search?.trim() || null;

        if (search && search.length > 100) {
            throw new BadRequestException('Поисковый запрос не может быть длиннее 100 символов');
        }

        const options: ProductProfitabilityOptions = {
            accountId,
            dateFrom,
            dateTo,
            sortBy: sortBy as ProductProfitabilitySortBy,
            sortDirection: sortDirection as SortDirection,
            page,
            limit,
            search,
        };

        return this.repository.findProfitability(options);
    }

    public getConsumption(accountId: string, query: { page?: string; limit?: string; search?: string; sortDirection?: string; endingWithinWeek?: string; periodDays?: string }) {
        const page = this.parsePositiveInteger(query.page, 1, 'page');
        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');
        if (limit > 100) throw new BadRequestException('limit не может быть больше 100');
        const search = query.search?.trim() || null;
        if (search && search.length > 100) throw new BadRequestException('Поисковый запрос не может быть длиннее 100 символов');
        const sortDirection = query.sortDirection ?? 'asc';
        if (sortDirection !== 'asc' && sortDirection !== 'desc') throw new BadRequestException('sortDirection должен быть asc или desc');
        const endingWithinWeek = query.endingWithinWeek === 'true';
        if (query.endingWithinWeek !== undefined && query.endingWithinWeek !== 'true' && query.endingWithinWeek !== 'false') throw new BadRequestException('endingWithinWeek должен быть true или false');
        const periodDays = this.parsePositiveInteger(query.periodDays, 7, 'periodDays');
        if (periodDays > 365) throw new BadRequestException('periodDays не может быть больше 365');
        return this.repository.findConsumption(accountId, page, limit, search, sortDirection, endingWithinWeek, periodDays);
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
}
