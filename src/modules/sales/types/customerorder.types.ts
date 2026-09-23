export interface PageRequest {
    limit?: number;
    offset?: number;
}

export interface Reference {
    meta: { href: string; type?: string };
}

export interface RemotePage<T> {
    meta: { size: number; offset: number; limit: number };
    rows: T[];
}

export interface CustomerOrderPosition {
    id: string;
    assortment: Reference;
    quantity: number;
    price: number;
    discount?: number;
    vat?: number;
    vatEnabled?: boolean;
    reserve?: number;
    [key: string]: unknown;
}

export interface CustomerOrder {
    id: string;
    name: string;
    updated: string;
    created?: string;
    moment: string;
    applicable: boolean;
    externalCode?: string;
    description?: string;
    sum: number;
    payedSum?: number;
    shippedSum?: number;
    invoicedSum?: number;
    reservedSum?: number;
    vatEnabled?: boolean;
    vatIncluded?: boolean;
    vatSum?: number;
    rate?: { currency: Reference; value?: number };
    agent: Reference;
    organization: Reference;
    store?: Reference;
    owner?: Reference;
    state?: Reference;
    attributes?: unknown[];
    demands?: Reference[];
    invoicesOut?: Reference[];
    productionTasks?: Reference[];
    positions: { meta: { href: string; size: number }; rows?: CustomerOrderPosition[] };
    [key: string]: unknown;
}
