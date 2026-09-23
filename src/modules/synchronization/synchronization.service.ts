import { Injectable, Logger } from '@nestjs/common';

import { ProductsService } from '../products/products.service.js';
import { SalesService } from '../sales/sales.service.js';
import { SynchronizationRepository } from './synchronization.repository.js';
import type { SyncResult, SyncScope } from './types/synchronization.types.js';
import { ExpensesService } from '../expenses/expenses.service.js';

@Injectable()
export class SynchronizationService {
    private readonly logger = new Logger(SynchronizationService.name);

    private running = false;

    public constructor(
        private readonly repository: SynchronizationRepository,
        private readonly sales: SalesService,
        private readonly products: ProductsService,
        private readonly expenses: ExpensesService
    ) {}

    public async run(scope: SyncScope = 'all'): Promise<SyncResult | null> {
        if (this.running) {
            return null;
        }

        this.running = true;

        try {
            return await this.repository.withLock(scope, () => this.synchronize(scope));
        } finally {
            this.running = false;
        }
    }

    private async synchronize(scope: SyncScope): Promise<SyncResult> {
        const startedAt = new Date();
        const counts: Record<string, number> = {};
        const errors: string[] = [];

        /* if (scope === 'all' || scope === 'sales') {
            await this.synchronizeSales(counts, errors);
        }*/

        if (scope === 'all' || scope === 'products') {
            await this.synchronizeProducts(counts, errors);
        }

        if (scope === 'all' || scope === 'expenses') {
            await this.synchronizeExpenses(counts, errors);
        }

        return {
            scope,
            startedAt,
            finishedAt: new Date(),
            counts,
            errors,
        };
    }

    private async synchronizeExpenses(
        counts: Record<string, number>,
        errors: string[],
    ): Promise<void> {
        try {
            /*
             * Внутри syncAll последовательность:
             * expenseitem → paymentout → cashout.
             */
            const result =
                await this.expenses.syncAll();

            counts.expenseitem =
                result.expenseItems;

            counts.paymentout =
                result.paymentOuts;

            counts.cashout =
                result.cashOuts;

            this.logger.log({
                event:
                    'expenses_synchronization_finished',
                expenseItems:
                result.expenseItems,
                paymentOuts:
                result.paymentOuts,
                cashOuts:
                result.cashOuts,
                total:
                result.total,
            });
        } catch {
            const message =
                'Синхронизация расходов не завершена; ' +
                'сохранённые чанки будут обновлены ' +
                'при повторном запуске.';

            errors.push(`expenses: ${message}`);

            this.logger.error({
                event:
                    'expenses_synchronization_failed',
                message,
            });
        }
    }

    private async synchronizeSales(counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const savedOrders = await this.sales.syncAll();

            counts.customerorder = savedOrders;

            this.logger.log({
                event: 'sales_synchronization_finished',
                saved: savedOrders,
            });
        } catch {
            const message = 'Синхронизация продаж не завершена; ' + 'сохранённые чанки будут обновлены при повторном запуске.';

            errors.push(`sales: ${message}`);

            this.logger.error({
                event: 'sales_synchronization_failed',
                message,
            });
        }
    }

    private async synchronizeProducts(counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const periodFrom = '2026-01-01';

            const results = await this.products.syncFromDateToToday(periodFrom);

            const received = results.reduce((total, result) => total + result.received, 0);

            const saved = results.reduce((total, result) => total + result.saved, 0);

            counts.productProfit = saved;

            this.logger.log({
                event: 'products_synchronization_finished',
                periodFrom,
                periodTo: results.at(-1)?.periodDate ?? null,
                days: results.length,
                received,
                saved,
            });
        } catch {
            const message = 'Синхронизация прибыльности товаров ' + 'не завершена; данные будут обновлены ' + 'при повторном запуске.';

            errors.push(`products: ${message}`);

            this.logger.error({
                event: 'products_synchronization_failed',
                message,
            });
        }
    }
}
