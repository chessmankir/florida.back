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
    total: number;
}
