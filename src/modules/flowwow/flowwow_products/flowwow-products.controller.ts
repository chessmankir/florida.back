import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { FlowwowProductsService } from './flowwow-products.service.js';
import { FlowwowProductLinksService } from './flowwow-product-links.service.js';
import type {
    FlowwowProductsListResponse,
    FlowwowProductStatusResponse,
} from './types/flowwow-products.types.js';

@Controller('analytics/flowwow/products')
export class FlowwowProductsController {
    public constructor(
        private readonly products: FlowwowProductsService,
        private readonly links: FlowwowProductLinksService
    ) {}

    @Get('links')
    public getLinks(
        @Query('shopId') shopId?: string,
        @Query('productId') productId?: string
    ) {
        return this.links.get(shopId, productId);
    }

    @Post('links')
    public saveLinks(@Body() body: unknown) {
        return this.links.save(body);
    }

    @Get()
    public getProducts(
        @Query('shopId') shopId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection') sortDirection?: string,
        @Query('search') search?: string
    ): Promise<FlowwowProductsListResponse> {
        return this.products.getProducts({ shopId, page, limit, status, sortBy, sortDirection, search });
    }

    @Post('hide')
    public hideProducts(
        @Query('shopId') shopId: string | undefined,
        @Body() body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        return this.products.changeVisibility('hide', shopId, body);
    }

    @Post('unhide')
    public unhideProducts(
        @Query('shopId') shopId: string | undefined,
        @Body() body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        return this.products.changeVisibility('unhide', shopId, body);
    }
}
