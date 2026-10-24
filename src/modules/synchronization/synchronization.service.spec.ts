import { describe, expect, it, vi } from 'vitest';

import { SynchronizationService } from './synchronization.service.js';

describe('SynchronizationService', () => {
    it.each(['expenses', 'all'] as const)('runs expense synchronization for the %s scope', async (scope) => {
        const repository = {
            withLock: vi.fn(async (_accountId: string, _scope: string, work: () => Promise<unknown>) => work()),
        };
        const expenses = {
            syncAll: vi.fn().mockResolvedValue({
                expenseItems: 3,
                paymentOuts: 5,
                cashOuts: 7,
                losses: 11,
                total: 26,
            }),
        };
        const accounts = {
            moyskladToken: vi.fn().mockResolvedValue('moysklad-token'),
            flowwowToken: vi.fn().mockResolvedValue('flowwow-token'),
        };
        const noOpSync = { syncAll: vi.fn().mockResolvedValue({}) };

        const service = new SynchronizationService(
            repository as never,
            noOpSync as never,
            noOpSync as never,
            expenses as never,
            { syncAll: vi.fn().mockResolvedValue({ shopsSynced: 0, shops: [], total: 0 }) } as never,
            { syncAll: vi.fn().mockResolvedValue({ shops: [], total: 0 }) } as never,
            { syncAll: vi.fn().mockResolvedValue({ saved: 0, componentsReceived: 0 }) } as never,
            { syncAll: vi.fn().mockResolvedValue({ plans: 0, materials: 0 }) } as never,
            accounts as never,
        );

        const result = await service.run('account-id', scope);

        expect(expenses.syncAll).toHaveBeenCalledWith('account-id', 'moysklad-token');
        expect(result?.counts).toMatchObject({
            expenseitem: 3,
            paymentout: 5,
            cashout: 7,
            loss: 11,
        });
        expect(result?.errors).toEqual([]);
    });

    it('synchronizes sources and checks every Flowwow product availability', async () => {
        const inventoryResult = {
            assortmentReceived: 10,
            stockRowsReceived: 8,
            bundlesReceived: 0,
            componentsReceived: 0,
            saved: 10,
        };
        const plansResult = { plans: 2, materials: 4 };
        const flowwowResult = { shops: { 1: 3 }, total: 3 };
        const inventory = { syncAll: vi.fn().mockResolvedValue(inventoryResult) };
        const plans = { syncAll: vi.fn().mockResolvedValue(plansResult) };
        const flowwow = {
            syncAll: vi.fn().mockResolvedValue(flowwowResult),
            getAvailabilityAudit: vi.fn().mockResolvedValue([
                { shopId: 1, productId: 1, productName: 'Есть', linked: true, hasComponents: true, hasStock: true,
                    processingPlanId: 'plan-1', processingPlanName: 'Карта 1', availableToAssemble: 2, missingComponents: [] },
                { shopId: 1, productId: 2, productName: 'Нет', linked: true, hasComponents: true, hasStock: false,
                    processingPlanId: 'plan-2', processingPlanName: 'Карта 2', availableToAssemble: 0, missingComponents: [{}] },
                { shopId: 1, productId: 3, productName: 'Без карты', linked: false, hasComponents: false, hasStock: false,
                    processingPlanId: null, processingPlanName: null, availableToAssemble: 0, missingComponents: [] },
            ]),
        };
        const accounts = {
            moyskladToken: vi.fn().mockResolvedValue('moysklad-token'),
            flowwowToken: vi.fn().mockResolvedValue('flowwow-token'),
        };
        const service = new SynchronizationService(
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never,
            flowwow as never,
            inventory as never,
            plans as never,
            accounts as never,
        );

        const result = await service.checkFlowwowAvailability('account-id');

        expect(inventory.syncAll).toHaveBeenCalledWith('account-id', 'moysklad-token');
        expect(plans.syncAll).toHaveBeenCalledWith('account-id', 'moysklad-token');
        expect(flowwow.syncAll).toHaveBeenCalledWith('account-id', 'flowwow-token');
        expect(flowwow.getAvailabilityAudit).toHaveBeenCalledWith('account-id');
        expect(result?.summary).toEqual({
            total: 3,
            withStock: 1,
            withoutStock: 1,
            unlinked: 1,
            withoutComponents: 0,
        });
    });
});
