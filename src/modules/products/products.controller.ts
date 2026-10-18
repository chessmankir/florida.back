import { Controller, Get, Headers, Query } from '@nestjs/common';

import { ProductsService } from './products.service.js';
import type { ProductProfitabilityResponse } from './types/product-profit.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';

@Controller('analytics/products')
export class ProductsController {
    public constructor(private readonly products: ProductsService, private readonly accounts: AccountAccessService) {}

    @Get('profitability')
    public getProfitability(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection')
        sortDirection?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string
    ): Promise<ProductProfitabilityResponse> {
        return this.products.getProfitability(this.accounts.authorize(accountIdValue, authorization), {
            dateFrom,
            dateTo,
            sortBy,
            sortDirection,
            page,
            limit,
            search,
        });
    }

    @Get('consumption')
    public getConsumption(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string,
        @Query('sortDirection') sortDirection?: string, @Query('endingWithinWeek') endingWithinWeek?: string,
        @Query('periodDays') periodDays?: string
    ) {
        return this.products.getConsumption(this.accounts.authorize(accountIdValue, authorization), { page, limit, search, sortDirection, endingWithinWeek, periodDays });
    }
}
