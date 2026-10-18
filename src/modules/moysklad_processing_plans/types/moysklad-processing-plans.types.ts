export interface MoyskladMetaRef { href?: string; type?: string; }
export interface MoyskladProcessingPlanRow {
    id?: string; meta?: MoyskladMetaRef; name?: string; code?: string; externalCode?: string;
    pathName?: string; archived?: boolean; cost?: number; updated?: string;
}
export interface MoyskladProcessingPlanMaterialRow {
    id?: string; meta?: MoyskladMetaRef; quantity?: number;
    assortment?: { meta?: MoyskladMetaRef };
    product?: { meta?: MoyskladMetaRef };
}
export interface MoyskladPage<T> { meta: { size: number; limit?: number; offset?: number }; rows: T[]; }
export interface ProcessingPlanSnapshot {
    id: string; name: string; code: string | null; externalCode: string | null; pathName: string | null;
    archived: boolean; productionCostMinor: string | null; sourceUpdatedAt: Date | null; syncedAt: Date;
}
export interface ProcessingPlanMaterialSnapshot {
    id: string; processingPlanId: string; assortmentId: string; assortmentType: string; quantity: string; syncedAt: Date;
}
export interface ProcessingPlansSyncResult { plans: number; materials: number; }
