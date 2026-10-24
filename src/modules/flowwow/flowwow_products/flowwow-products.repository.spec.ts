import { describe, expect, it, vi } from 'vitest';

import { FlowwowProductsRepository } from './flowwow-products.repository.js';

describe('FlowwowProductsRepository availability audit', () => {
    it('classifies linked products by processing-plan material stock', async () => {
        const query = vi.fn()
            .mockResolvedValueOnce([
                { shopId: 1, productId: 10, productName: 'Букет в наличии', isActive: true, isArchived: false,
                    processingPlanId: 'plan-1', processingPlanName: 'Карта букета 1' },
                { shopId: 1, productId: 20, productName: 'Букет без остатка', isActive: true, isArchived: false,
                    processingPlanId: 'plan-2', processingPlanName: 'Карта букета 2' },
                { shopId: 1, productId: 30, productName: 'Букет без карты', isActive: true, isArchived: false,
                    processingPlanId: null, processingPlanName: null },
            ])
            .mockResolvedValueOnce([
                { processingPlanId: 'plan-1', componentId: 'component-1', name: 'Роза', requiredQuantity: '2', availableQuantity: '5' },
                { processingPlanId: 'plan-2', componentId: 'component-2', name: 'Пион', requiredQuantity: '3', availableQuantity: '1' },
            ]);
        const repository = new FlowwowProductsRepository({ query } as never);

        const products = await repository.findAllAvailability('account-id');

        expect(products[0]).toMatchObject({ hasStock: true, availableToAssemble: 2, missingComponents: [] });
        expect(products[1]).toMatchObject({
            hasStock: false,
            availableToAssemble: 0,
            missingComponents: [{ name: 'Пион', requiredQuantity: 3, availableQuantity: 1, missingQuantity: 2 }],
        });
        expect(products[2]).toMatchObject({ linked: false, hasComponents: false, hasStock: false });
    });
});
