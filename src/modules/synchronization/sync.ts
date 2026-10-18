import { NestFactory } from '@nestjs/core';

import { SynchronizationService } from './synchronization.service.js';
import type { SyncScope } from './types/synchronization.types.js';

const allowedScopes: SyncScope[] = ['all', 'sales', 'products', 'expenses', 'flowwow_orders', 'flowwow_products', 'moysklad_inventory', 'moysklad_processing_plans'];

const firstArgument = process.argv[2];
const firstArgumentIsAccountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstArgument ?? '');
const accountId = firstArgumentIsAccountId ? firstArgument : process.env.ACCOUNT_ID;
const requestedScope = firstArgumentIsAccountId ? (process.argv[3] ?? 'all') : (firstArgument ?? 'all');

if (!accountId) {
    throw new Error('Передайте accountId первым аргументом или задайте переменную окружения ACCOUNT_ID');
}

if (!allowedScopes.includes(requestedScope as SyncScope)) {
    throw new Error(`Допустимые режимы: ${allowedScopes.join(', ')}`);
}

process.env.MOYSKLAD_SYNC_ENABLED = 'false';

const { AppModule } = await import('../../app/app.module.js');

const app = await NestFactory.createApplicationContext(AppModule);

try {
    const result = await app.get(SynchronizationService).run(accountId, requestedScope as SyncScope);

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
