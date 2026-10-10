import type { MoyskladInventoryProduct } from '../models/moysklad-inventory-product.model.js';

export interface MoyskladMeta { href: string; type: string; }
export interface MoyskladMoney { value: number; }

export interface MoyskladAssortmentRow {
    id?: string;
    meta: MoyskladMeta;
    name: string;
    code?: string;
    article?: string;
    externalCode?: string;
    archived?: boolean;
    pathName?: string;
    updated?: string;
    buyPrice?: MoyskladMoney;
    minPrice?: MoyskladMoney;
    salePrices?: MoyskladMoney[];
    uom?: { name?: string };
    product?: { meta?: MoyskladMeta };
}

export interface MoyskladStockRow {
    meta?: MoyskladMeta;
    name?: string;
    code?: string;
    article?: string;
    assortment?: { meta: MoyskladMeta; name: string; code?: string; article?: string };
    stock?: number;
    reserve?: number;
    inTransit?: number;
    quantity?: number;
    price?: number;
    salePrice?: number;
    minimumBalance?: number;
    daysOnStock?: number;
}

export interface MoyskladPage<T> {
    meta: { size: number; limit: number; offset: number };
    rows: T[];
}

export type MoyskladInventorySnapshot = Omit<MoyskladInventoryProduct, 'createdAt' | 'updatedAt'>;
export interface MoyskladInventorySyncResult { assortmentReceived: number; stockRowsReceived: number; saved: number; }
export interface MoyskladInventoryListOptions {
    page: number;
    limit: number;
    search: string | null;
    type: string | null;
    archived: boolean | null;
    sortBy: 'name' | 'stock' | 'available' | 'cost' | 'salePrice';
    sortDirection: 'asc' | 'desc';
}
export interface MoyskladInventoryListResponse {
    filters: Pick<MoyskladInventoryListOptions, 'search' | 'type' | 'archived' | 'sortBy' | 'sortDirection'>;
    items: MoyskladInventoryProduct[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}
