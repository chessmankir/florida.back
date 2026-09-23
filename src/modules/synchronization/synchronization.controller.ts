import { ConflictException, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { SynchronizationService } from './synchronization.service.js';
import type { SyncResult } from './types/synchronization.types.js';

@Controller('synchronization')
export class SynchronizationController {
    public constructor(private readonly synchronization: SynchronizationService) {}

    @Post('run')
    @HttpCode(HttpStatus.OK)
    public async run(): Promise<SyncResult> {
        const result = await this.synchronization.run('all');

        if (!result) {
            throw new ConflictException('Синхронизация уже выполняется');
        }

        return result;
    }
}
