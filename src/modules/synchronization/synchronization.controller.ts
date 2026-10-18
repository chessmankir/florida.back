import { BadRequestException, ConflictException, Controller, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import { SynchronizationService } from './synchronization.service.js';
import type { SyncResult, SyncScope } from './types/synchronization.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';

@Controller('synchronization')
export class SynchronizationController {
    public constructor(private readonly synchronization: SynchronizationService, private readonly accounts: AccountAccessService) {}

    @Post('run')
    @HttpCode(HttpStatus.OK)
    public async run(
        @Headers('x-account-id') accountIdValue: string | undefined,
        @Headers('authorization') authorization: string | undefined,
        @Query('scope') scopeValue?: string
    ): Promise<SyncResult> {
        const scopes: SyncScope[] = ['all', 'sales', 'products', 'expenses', 'flowwow_orders', 'flowwow_products', 'moysklad_inventory', 'moysklad_processing_plans'];
        const scope = scopeValue ?? 'all';
        if (!scopes.includes(scope as SyncScope)) {
            throw new BadRequestException('Неизвестная область синхронизации');
        }
        const result = await this.synchronization.run(this.accounts.authorize(accountIdValue, authorization), scope as SyncScope);

        if (!result) {
            throw new ConflictException('Синхронизация уже выполняется');
        }

        return result;
    }
}
