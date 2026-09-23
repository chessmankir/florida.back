import { Controller, Get, Query } from '@nestjs/common';

import { ProductsService } from './products.service.js';
import type { ProductProfitabilityResponse } from './types/product-profit.types.js';

@Controller('analytics/products')
export class ProductsController {
    public constructor(private readonly products: ProductsService) {}

    @Get('profitability')
    public getProfitability(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection')
        sortDirection?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string
    ): Promise<ProductProfitabilityResponse> {
        return this.products.getProfitability({
            dateFrom,
            dateTo,
            sortBy,
            sortDirection,
            page,
            limit,
            search,
        });
    }
}
