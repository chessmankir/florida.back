export interface ExpenseReference {
    meta: {
        href: string;
        type?: string;
    };
}

export interface ExpensePageRequest {
    limit?: number;
    offset?: number;
}

export interface ExpenseRemotePage<T> {
    meta: {
        size: number;
        limit: number;
        offset: number;
    };
    rows: T[];
}

export interface ExpenseItemRemote {
    id: string;
    name: string;
    code?: string;
    description?: string;
    externalCode?: string;
    updated: string;
    operatingExpenses?: boolean;
}

export interface ExpenseDocumentRemote {
    id: string;
    name: string;
    description?: string;
    externalCode?: string;

    moment: string;
    created?: string;
    updated: string;
    applicable: boolean;

    sum: number;
    vatSum?: number;

    expenseItem?: ExpenseReference;
    organization?: ExpenseReference;
    organizationAccount?: ExpenseReference;
    agent?: ExpenseReference;
    owner?: ExpenseReference;
    group?: ExpenseReference;
    project?: ExpenseReference;

    rate?: {
        currency?: ExpenseReference;
        value?: number;
    };
}

export interface ExpensesSyncResult {
    expenseItems: number;
    paymentOuts: number;
    cashOuts: number;
    losses: number;
    total: number;
}

export type ExpensePaymentType = 'all' | 'paymentout' | 'cashout' | 'loss';

export type ExpenseAnalyticsSortBy = 'moment' | 'sum' | 'expenseItem' | 'name';

export type ExpenseSortDirection = 'asc' | 'desc';

export interface ExpenseAnalyticsOptions {
    dateFrom: string;
    dateTo: string;

    paymentType: ExpensePaymentType;
    expenseItemId: string | null;

    includeUnposted: boolean;
    search: string | null;

    sortBy: ExpenseAnalyticsSortBy;
    sortDirection: ExpenseSortDirection;

    page: number;
    limit: number;
}

export interface ExpenseAnalyticsItem {
    id: string;
    paymentType: Exclude<ExpensePaymentType, 'all'>;

    name: string;
    description: string | null;
    moment: Date;
    isPosted: boolean;

    sumMinor: string;
    vatSumMinor: string | null;

    expenseItemId: string | null;
    expenseItemName: string;

    organizationId: string | null;
    organizationAccountId: string | null;

    agentId: string | null;
    agentType: string | null;

    projectId: string | null;
}

export interface ExpenseCategorySummary {
    expenseItemId: string | null;
    expenseItemName: string;
    paymentsCount: number;
    totalMinor: string;
    sharePercent: string;
}

export interface ExpenseAnalyticsSummary {
    paymentsCount: number;
    totalMinor: string;
    paymentOutMinor: string;
    cashOutMinor: string;
    lossMinor: string;
}

export interface ExpenseAnalyticsResponse {
    period: {
        dateFrom: string;
        dateTo: string;
    };

    filters: {
        paymentType: ExpensePaymentType;
        expenseItemId: string | null;
        includeUnposted: boolean;
        search: string | null;
    };

    summary: ExpenseAnalyticsSummary;

    categories: ExpenseCategorySummary[];

    items: ExpenseAnalyticsItem[];

    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

export interface LossPositionRemote {
    id: string;

    assortment: ExpenseReference;

    quantity: number;
    price: number;

    vat?: number;
    vatEnabled?: boolean;
}

export interface LossRemote {
    id: string;
    name: string;

    description?: string;
    externalCode?: string;

    moment: string;
    created?: string;
    updated: string;

    applicable: boolean;
    sum: number;

    organization?: ExpenseReference;
    store?: ExpenseReference;
    owner?: ExpenseReference;
    group?: ExpenseReference;
    project?: ExpenseReference;

    rate?: {
        currency?: ExpenseReference;
        value?: number;
    };

    positions: {
        meta: {
            href: string;
            size: number;
            limit?: number;
            offset?: number;
        };

        rows?: LossPositionRemote[];
    };
}