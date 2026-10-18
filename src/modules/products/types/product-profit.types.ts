export interface MoySkladMeta {
    href: string;
    type: string;
}

export interface ProductProfitAssortment {
    meta: MoySkladMeta;
    name: string;
    code?: string;
    article?: string;
}

export interface ProductProfitRow {
    assortment: ProductProfitAssortment;

    sellQuantity: number;
    sellSum: number;
    sellCostSum: number;

    returnQuantity: number;
    returnSum: number;
    returnCostSum: number;

    profit: number;
    margin: number;
}

export interface ProductProfitPage {
    meta: {
        size: number;
        limit: number;
        offset: number;
    };
    rows: ProductProfitRow[];
}

export interface ProductProfitRequest {
    momentFrom: string;
    momentTo: string;
    limit: number;
    offset: number;
}

export interface ProductProfitSyncResult {
    periodDate: string;
    received: number;
    saved: number;
}

export type ProductProfitabilitySortBy =
    'grossProfit' | 'soldQuantity' | 'revenue' | 'cost' | 'marginPercent' | 'returnRatePercent' | 'name';

export type SortDirection = 'asc' | 'desc';

export interface ProductProfitabilityOptions {
    accountId: string;
    dateFrom: string;
    dateTo: string;
    sortBy: ProductProfitabilitySortBy;
    sortDirection: SortDirection;
    page: number;
    limit: number;
    search: string | null;
}

export interface ProductProfitabilityItem {
    productId: string;
    productType: string;
    name: string;
    code: string | null;
    article: string | null;

    soldQuantity: string;
    returnQuantity: string;
    netSoldQuantity: string;

    revenueMinor: string;
    costMinor: string;
    grossProfitMinor: string;

    marginPercent: string;
    returnRatePercent: string;
}

export interface ProductProfitabilitySummary {
    productsCount: number;

    soldQuantity: string;
    returnQuantity: string;
    netSoldQuantity: string;

    revenueMinor: string;
    costMinor: string;
    grossProfitMinor: string;

    marginPercent: string;
    returnRatePercent: string;
}

export interface ProductProfitabilityResponse {
    period: {
        dateFrom: string;
        dateTo: string;
    };

    summary: ProductProfitabilitySummary;

    items: ProductProfitabilityItem[];

    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

export interface ProductConsumptionResponse {
    period: { dateFrom: string; dateTo: string; days: number };
    items: Array<{ productId: string; name: string; code: string | null; article: string | null; available: string; soldQuantity: string; averageDaily: string; daysRemaining: string | null; expectedOutOfStockDate: string | null }>;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
