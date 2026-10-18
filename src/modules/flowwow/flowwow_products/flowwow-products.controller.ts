import { Body, Controller, Delete, Get, Headers, Post, Query } from '@nestjs/common';

import { FlowwowProductsService } from './flowwow-products.service.js';
import { FlowwowProductLinksService } from './flowwow-product-links.service.js';
import type {
    FlowwowProductsListResponse,
    FlowwowProductStatusResponse,
} from './types/flowwow-products.types.js';
import { AccountAccessService } from '../../auth/account-access.service.js';

@Controller('analytics/flowwow/products')
export class FlowwowProductsController {
    public constructor(
        private readonly products: FlowwowProductsService,
        private readonly links: FlowwowProductLinksService,
        private readonly accounts: AccountAccessService
    ) {}

    @Get('links')
    public getLinks(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId?: string,
        @Query('productId') productId?: string
    ) {
        return this.links.get(this.accounts.authorize(accountIdValue, authorization), shopId, productId);
    }

    @Get('availability')
    public getAvailability(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId?: string,
        @Query('productId') productId?: string
    ) {
        return this.products.getAvailability(
            this.accounts.authorize(accountIdValue, authorization), shopId, productId
        );
    }

    @Post('links')
    public saveLinks(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Body() body: unknown
    ) {
        return this.links.save(this.accounts.authorize(accountIdValue, authorization), body);
    }

    @Post('create')
    public createProduct(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId: string | undefined,
        @Body() body: unknown
    ) {
        return this.products.createProduct(this.accounts.authorize(accountIdValue, authorization), shopId, body);
    }

    @Delete('links')
    public removeLinks(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId?: string,
        @Query('productId') productId?: string
    ) {
        return this.links.remove(this.accounts.authorize(accountIdValue, authorization), shopId, productId);
    }

    @Get()
    public getProducts(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection') sortDirection?: string,
        @Query('search') search?: string
        , @Query('linkStatus') linkStatus?: string
        , @Query('availability') availability?: string
    ): Promise<FlowwowProductsListResponse> {
        return this.products.getProducts(this.accounts.authorize(accountIdValue, authorization), { shopId, page, limit, status, sortBy, sortDirection, search, linkStatus, availability });
    }

    @Post('hide')
    public hideProducts(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId: string | undefined,
        @Body() body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        return this.products.changeVisibility(this.accounts.authorize(accountIdValue, authorization), 'hide', shopId, body);
    }

    @Post('unhide')
    public unhideProducts(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('shopId') shopId: string | undefined,
        @Body() body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        return this.products.changeVisibility(this.accounts.authorize(accountIdValue, authorization), 'unhide', shopId, body);
    }
}
