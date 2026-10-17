import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoyskladInventoryService } from './moysklad-inventory.service.js';
import type { MoyskladBundleComponentsResponse, MoyskladInventoryListResponse } from './types/moysklad-inventory.types.js';

@Controller('analytics/moysklad/inventory')
export class MoyskladInventoryController {
    public constructor(private readonly inventory: MoyskladInventoryService) {}

    @Get(':bundleId/components')
    public getBundleComponents(@Param('bundleId') bundleId: string): Promise<MoyskladBundleComponentsResponse> {
        return this.inventory.getBundleComponents(bundleId);
    }

    @Get()
    public getProducts(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('type') type?: string,
        @Query('archived') archived?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDirection') sortDirection?: string
    ): Promise<MoyskladInventoryListResponse> {
        return this.inventory.getProducts({ page, limit, search, type, archived, sortBy, sortDirection });
    }
}
