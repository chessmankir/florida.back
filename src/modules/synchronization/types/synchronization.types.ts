import type {
    FlowwowProductAvailabilityAuditItem,
    FlowwowProductsSyncResult,
} from '../../flowwow/flowwow_products/types/flowwow-products.types.js';
import type { MoyskladInventorySyncResult } from '../../moysklad_inventory/types/moysklad-inventory.types.js';
import type { ProcessingPlansSyncResult } from '../../moysklad_processing_plans/types/moysklad-processing-plans.types.js';

export type SyncScope = 'all' | 'sales' | 'products' | 'expenses' | 'flowwow_orders' | 'flowwow_products' | 'moysklad_inventory' | 'moysklad_processing_plans';

export interface SyncResult {
    scope: SyncScope;
    startedAt: Date;
    finishedAt: Date;
    counts: Record<string, number>;
    errors: string[];
}

export interface FlowwowAvailabilityCheckResult {
    startedAt: Date;
    finishedAt: Date;
    synchronized: {
        moyskladInventory: MoyskladInventorySyncResult;
        moyskladProcessingPlans: ProcessingPlansSyncResult;
        flowwowProducts: FlowwowProductsSyncResult;
    };
    summary: {
        total: number;
        withStock: number;
        withoutStock: number;
        unlinked: number;
        withoutComponents: number;
    };
    products: FlowwowProductAvailabilityAuditItem[];
}
