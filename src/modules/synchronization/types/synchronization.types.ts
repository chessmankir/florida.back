export type SyncScope = 'all' | 'sales' | 'products' | 'expenses' | 'flowwow_orders' | 'flowwow_products' | 'moysklad_inventory';

export interface SyncResult {
    scope: SyncScope;
    startedAt: Date;
    finishedAt: Date;
    counts: Record<string, number>;
    errors: string[];
}
