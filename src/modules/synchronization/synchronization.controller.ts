import { BadRequestException, ConflictException, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';

import { SynchronizationService } from './synchronization.service.js';
import type { SyncResult, SyncScope } from './types/synchronization.types.js';

@Controller('synchronization')
export class SynchronizationController {
    public constructor(private readonly synchronization: SynchronizationService) {}

    @Post('run')
    @HttpCode(HttpStatus.OK)
    public async run(@Query('scope') scopeValue?: string): Promise<SyncResult> {
        const scopes: SyncScope[] = ['all', 'sales', 'products', 'expenses', 'flowwow_orders', 'flowwow_products', 'moysklad_inventory'];
        const scope = scopeValue ?? 'all';
        if (!scopes.includes(scope as SyncScope)) {
            throw new BadRequestException('Неизвестная область синхронизации');
        }
        const result = await this.synchronization.run(scope as SyncScope);

        if (!result) {
            throw new ConflictException('Синхронизация уже выполняется');
        }

        return result;
    }
}
