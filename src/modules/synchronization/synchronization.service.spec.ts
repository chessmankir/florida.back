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
});
