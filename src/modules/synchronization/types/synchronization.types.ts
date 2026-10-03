export type SyncScope = 'all' | 'sales' | 'products' | 'expenses' | 'flowwow_orders';

export interface SyncResult {
    scope: SyncScope;
    startedAt: Date;
    finishedAt: Date;
    counts: Record<string, number>;
    errors: string[];
}
