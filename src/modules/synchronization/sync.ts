import { NestFactory } from '@nestjs/core';

import { SynchronizationService } from './synchronization.service.js';
import type { SyncScope } from './types/synchronization.types.js';

const allowedScopes: SyncScope[] = ['all', 'sales', 'products', 'expenses', 'flowwow_orders', 'flowwow_products', 'moysklad_inventory'];

const requestedScope = process.argv[2] ?? 'all';

if (!allowedScopes.includes(requestedScope as SyncScope)) {
    throw new Error(`Допустимые режимы: ${allowedScopes.join(', ')}`);
}

process.env.MOYSKLAD_SYNC_ENABLED = 'false';

const { AppModule } = await import('../../app/app.module.js');

const app = await NestFactory.createApplicationContext(AppModule);

try {
    const result = await app.get(SynchronizationService).run(requestedScope as SyncScope);

    if (!result) {
        console.log('Синхронизация уже выполняется.');
        process.exitCode = 1;
    } else {
        console.log(JSON.stringify(result, null, 2));

        if (result.errors.length > 0) {
            process.exitCode = 1;
        }
    }
} catch {
    console.error('Синхронизация не выполнена. ' + 'Проверьте подключение к БД и применение миграций.');

    process.exitCode = 1;
} finally {
    await app.close();
}
