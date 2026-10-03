import { Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
    FlowwowOrdersFinanceImportService,
    type UploadedFlowwowFinanceFile,
} from './flowwow-orders-finance-import.service.js';
import { FlowwowOrdersService } from './flowwow-orders.service.js';
import type {
    FlowwowOrdersFinanceImportResult,
    FlowwowOrdersListResponse,
} from './types/flowwow-orders.types.js';

@Controller(['analytics/flowwow/orders', 'analytics/flowwow/order'])
export class FlowwowOrdersController {
    public constructor(
        private readonly orders: FlowwowOrdersService,
        private readonly financeImport: FlowwowOrdersFinanceImportService
    ) {}

    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
    public importFinance(
        @UploadedFile() file?: UploadedFlowwowFinanceFile
    ): Promise<FlowwowOrdersFinanceImportResult> {
        return this.financeImport.import(file);
    }

    @Get()
    public getOrders(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('shopId') shopId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ): Promise<FlowwowOrdersListResponse> {
        return this.orders.getOrders({ dateFrom, dateTo, shopId, page, limit });
    }
}
