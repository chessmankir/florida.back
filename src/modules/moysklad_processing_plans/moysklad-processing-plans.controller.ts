import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { AccountAccessService } from '../auth/account-access.service.js';
import { MoyskladProcessingPlansService } from './moysklad-processing-plans.service.js';

@Controller('analytics/moysklad/processing-plans')
export class MoyskladProcessingPlansController {
    public constructor(private readonly service: MoyskladProcessingPlansService, private readonly accounts: AccountAccessService) {}

    @Get()
    public getPlans(
        @Headers('x-account-id') accountId: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string
    ) {
        return this.service.getPlans(this.accounts.authorize(accountId, authorization), { page, limit, search });
    }

    @Get(':planId/materials')
    public getMaterials(
        @Headers('x-account-id') accountId: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Param('planId') planId: string
    ) {
        return this.service.getMaterials(this.accounts.authorize(accountId, authorization), planId);
    }
}
