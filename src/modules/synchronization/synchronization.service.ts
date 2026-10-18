import { Injectable, Logger } from '@nestjs/common';
import { SynchronizationRepository } from './synchronization.repository.js';
import { SalesService } from '../sales/sales.service.js';
import { ProductsService } from '../products/products.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { FlowwowOrdersService } from '../flowwow/flowwow_orders/flowwow-orders.service.js';
import { FlowwowProductsService } from '../flowwow/flowwow_products/flowwow-products.service.js';
import { MoyskladInventoryService } from '../moysklad_inventory/moysklad-inventory.service.js';
import { MoyskladProcessingPlansService } from '../moysklad_processing_plans/moysklad-processing-plans.service.js';
import { SyncResult, SyncScope } from './types/synchronization.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';


@Injectable()
export class SynchronizationService {
    private readonly logger = new Logger(SynchronizationService.name);

    private running = false;

    public constructor(
        private readonly repository: SynchronizationRepository,
        private readonly sales: SalesService,
        private readonly products: ProductsService,
        private readonly expenses: ExpensesService,
        private readonly flowwowOrders: FlowwowOrdersService,
        private readonly flowwowProducts: FlowwowProductsService,
        private readonly moyskladInventory: MoyskladInventoryService,
        private readonly moyskladProcessingPlans: MoyskladProcessingPlansService,
        private readonly accounts: AccountAccessService
    ) {}

    public async run(accountId: string, scope: SyncScope = 'all'): Promise<SyncResult | null> {
        if (this.running) {
            return null;
        }

        this.running = true;

        try {
            return await this.repository.withLock(accountId, scope, () => this.synchronize(accountId, scope));
        } finally {
            this.running = false;
        }
    }

    private async synchronize(accountId: string, scope: SyncScope): Promise<SyncResult> {
        const startedAt = new Date();
        const counts: Record<string, number> = {};
        const errors: string[] = [];

      /*  if (scope === 'all' || scope === 'sales') {
            await this.synchronizeSales(accountId, counts, errors);
        }

        if (scope === 'all' || scope === 'products') {
            await this.synchronizeProducts(accountId, counts, errors);
        }

        if (scope === 'all' || scope === 'expenses') {
            await this.synchronizeExpenses(accountId, counts, errors);
        }*/

        if (scope === 'all' || scope === 'flowwow_orders') {
            await this.synchronizeFlowwowOrders(accountId, counts, errors);
        }

        if (scope === 'all' || scope === 'flowwow_products') {
            await this.synchronizeFlowwowProducts(accountId, counts, errors);
        }

        if (scope === 'all' || scope === 'moysklad_inventory') {
            await this.synchronizeMoyskladInventory(accountId, counts, errors);
        }

        if (scope === 'all' || scope === 'moysklad_processing_plans') {
            await this.synchronizeMoyskladProcessingPlans(accountId, counts, errors);
        }

        return {
            scope,
            startedAt,
            finishedAt: new Date(),
            counts,
            errors,
        };
    }

    private async synchronizeMoyskladProcessingPlans(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const result = await this.moyskladProcessingPlans.syncAll(accountId, await this.accounts.moyskladToken(accountId));
            counts.moysklad_processing_plans = result.plans;
            counts.moysklad_processing_plan_materials = result.materials;
            this.logger.log({ event: 'moysklad_processing_plans_synchronization_finished', ...result });
        } catch (error: unknown) {
            const cause = error instanceof Error ? error.message : String(error);
            errors.push(`moysklad_processing_plans: Синхронизация техкарт не завершена. ${cause}`);
            this.logger.error({ event: 'moysklad_processing_plans_synchronization_failed', cause });
        }
    }

    private async synchronizeMoyskladInventory(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const result = await this.moyskladInventory.syncAll(accountId, await this.accounts.moyskladToken(accountId));
            counts.moysklad_inventory = result.saved;
            counts.moysklad_bundle_components = result.componentsReceived;
            this.logger.log({ event: 'moysklad_inventory_synchronization_finished', ...result });
        } catch (error: unknown) {
            const cause = error instanceof Error ? error.message : String(error);
            errors.push(`moysklad_inventory: Синхронизация каталога и остатков не завершена. ${cause}`);
            this.logger.error({ event: 'moysklad_inventory_synchronization_failed', cause });
        }
    }

    private async synchronizeFlowwowProducts(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const result = await this.flowwowProducts.syncAll(accountId, await this.accounts.flowwowToken(accountId));
            counts.flowwow_products = result.total;
            this.logger.log({
                event: 'flowwow_products_synchronization_finished',
                shops: result.shops,
                total: result.total,
            });
        } catch (error: unknown) {
            const cause = error instanceof Error ? error.message : String(error);
            const message = 'Синхронизация товаров Flowwow не завершена.';
            errors.push(`flowwow_products: ${message} ${cause}`);
            this.logger.error({
                event: 'flowwow_products_synchronization_failed',
                message,
                cause,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    private async synchronizeFlowwowOrders(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const result = await this.flowwowOrders.syncAll(accountId, await this.accounts.flowwowToken(accountId));
            counts.flowwow_shops = result.shopsSynced;
            counts.flowwow_orders = result.total;
            this.logger.log({
                event: 'flowwow_orders_synchronization_finished',
                shopsSynced: result.shopsSynced,
                shops: result.shops,
                total: result.total,
            });
        } catch (error: unknown) {
            const cause = error instanceof Error ? error.message : String(error);
            const message = 'Синхронизация заказов Flowwow не завершена.';
            errors.push(`flowwow_orders: ${message} ${cause}`);
            this.logger.error({
                event: 'flowwow_orders_synchronization_failed',
                message,
                cause,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    private async synchronizeExpenses(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            /*
             * Внутри syncAll последовательность:
             * expenseitem → paymentout → cashout.
             */
            const result = await this.expenses.syncAll(accountId, await this.accounts.moyskladToken(accountId));

            counts.expenseitem = result.expenseItems;

            counts.paymentout = result.paymentOuts;

            counts.cashout = result.cashOuts;

            counts.loss = result.losses;

            this.logger.log({
                event: 'expenses_synchronization_finished',

                expenseItems: result.expenseItems,

                paymentOuts: result.paymentOuts,

                cashOuts: result.cashOuts,

                losses: result.losses,

                total: result.total,
            });
        } catch {
            const message = 'Синхронизация расходов не завершена; ' + 'сохранённые чанки будут обновлены ' + 'при повторном запуске.';

            errors.push(`expenses: ${message}`);

            this.logger.error({
                event: 'expenses_synchronization_failed',
                message,
            });
        }
    }

    private async synchronizeSales(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const savedOrders = await this.sales.syncAll(accountId, await this.accounts.moyskladToken(accountId));

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

    private async synchronizeProducts(accountId: string, counts: Record<string, number>, errors: string[]): Promise<void> {
        try {
            const periodFrom = '2026-01-01';

            const results = await this.products.syncFromDateToToday(accountId, await this.accounts.moyskladToken(accountId), periodFrom);

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
