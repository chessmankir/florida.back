import { Controller, Get, Headers, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
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
import { AccountAccessService } from '../../auth/account-access.service.js';

@Controller(['analytics/flowwow/orders', 'analytics/flowwow/order'])
export class FlowwowOrdersController {
    public constructor(
        private readonly orders: FlowwowOrdersService,
        private readonly financeImport: FlowwowOrdersFinanceImportService,
        private readonly accounts: AccountAccessService
    ) {}

    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
    public importFinance(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @UploadedFile() file?: UploadedFlowwowFinanceFile,
        @Query('shopId') shopId?: string
    ): Promise<FlowwowOrdersFinanceImportResult> {
        return this.financeImport.import(this.accounts.authorize(accountIdValue, authorization), file, shopId);
    }

    @Get()
    public getOrders(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('shopId') shopId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ): Promise<FlowwowOrdersListResponse> {
        return this.orders.getOrders(this.accounts.authorize(accountIdValue, authorization), { dateFrom, dateTo, shopId, page, limit });
    }
}
