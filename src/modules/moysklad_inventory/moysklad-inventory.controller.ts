import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { MoyskladInventoryService } from './moysklad-inventory.service.js';
import type { MoyskladBundleComponentsResponse, MoyskladInventoryListResponse } from './types/moysklad-inventory.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';

@Controller('analytics/moysklad/inventory')
export class MoyskladInventoryController {
    public constructor(private readonly inventory: MoyskladInventoryService, private readonly accounts: AccountAccessService) {}

    @Get(':bundleId/components')
    public getBundleComponents(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Param('bundleId') bundleId: string
    ): Promise<MoyskladBundleComponentsResponse> {
        return this.inventory.getBundleComponents(this.accounts.authorize(accountIdValue, authorization), bundleId);
    }

    @Get()
    public getProducts(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('type') type?: string,
        @Query('archived') archived?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection') sortDirection?: string
    ): Promise<MoyskladInventoryListResponse> {
        return this.inventory.getProducts(this.accounts.authorize(accountIdValue, authorization), { page, limit, search, type, archived, sortBy, sortDirection });
    }
}
