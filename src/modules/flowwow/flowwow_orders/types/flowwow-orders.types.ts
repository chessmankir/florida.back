import type { FlowwowOrder } from '../models/flowwow-order.model.js';
import type { FlowwowOrderPosition } from '../models/flowwow-order-position.model.js';
import type { FlowwowShop } from '../models/flowwow-shop.model.js';

export const FLOWWOW_ORDER_STATUSES = [1, 2, 3, 4, 5, 7] as const;

export type FlowwowOrderStatus = (typeof FLOWWOW_ORDER_STATUSES)[number];

export const FLOWWOW_CDEK_STATUSES = [10, 11, 12] as const;

export type FlowwowCdekStatus = (typeof FLOWWOW_CDEK_STATUSES)[number];

export interface FlowwowRemoteProduct {
    offerId?: string | null;
    productId?: number | null;
    type?: number | null;
    categoryId?: number | null;
    subCategoryId?: number | null;
    name: string;
    price?: string | null;
    discount?: string | null;
    currencyCode?: string | null;
    count: number;
    cost: string;
    sum: string;
    [key: string]: unknown;
}

export interface FlowwowRemoteOrder {
    id: number;
    shopId: number;
    createdDate: number;
    status: FlowwowOrderStatus;
    deliveryType: number;
    deliveryTimeType: number;
    deliveryDateFrom: number;
    deliveryDateTo: number;
    address: string;
    courierInfo: string;
    shopAdditionalInfo: string;
    comment: string | null;
    photoBeforeUrl: string | null;
    photoAfterUrl: string | null;
    message: string;
    products: FlowwowRemoteProduct[];
    user: { name: string; phone: string } | null;
    recipient: { name: string; phone: string } | null;
    sourceHost: string | null;
}

export interface FlowwowOrdersPage {
    items: FlowwowRemoteOrder[];
    total: number;
}

export const FLOWWOW_SHOP_STATUSES = ['moderation', 'active', 'disabled'] as const;
export type FlowwowShopStatus = (typeof FLOWWOW_SHOP_STATUSES)[number];

export interface FlowwowRemoteShop {
    shopId: number;
    name: string;
    status: FlowwowShopStatus;
    address?: string | null;
    currency?: string | null;
    isVerified?: boolean | null;
    workingDays?: string[] | null;
    [key: string]: unknown;
}

export interface FlowwowShopsPage {
    shops: FlowwowRemoteShop[];
    total: number;
}

export interface FlowwowShopsRequest {
    status: FlowwowShopStatus;
    page?: number;
    limit?: number;
}

export interface FlowwowOrdersRequest {
    page?: number;
    limit?: number;
    createdDate?: string;
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
    status?: FlowwowOrderStatus;
    CDEK?: FlowwowCdekStatus;
}
export interface FlowwowOrderSnapshot {
    order: Omit<FlowwowOrder, 'rawJson'> & { rawJson: FlowwowRemoteOrder };
    positions: Array<Omit<FlowwowOrderPosition, 'rawJson'> & { rawJson: FlowwowRemoteProduct }>;
}

export type FlowwowShopSnapshot = Omit<FlowwowShop, 'rawJson'> & { rawJson: FlowwowRemoteShop };

export interface FlowwowOrdersSyncResult {
    shops: Record<number, number>;
    shopsSynced: number;
    total: number;
}

export interface FlowwowOrdersListOptions {
    dateFrom: string;
    dateTo: string;
    shopId: number | null;
    page: number;
    limit: number;
}

export interface FlowwowOrderListPosition {
    lineIndex: number;
    productId: number | null;
    offerId: string | null;
    name: string;
    quantity: number;
    costAmount: string;
    baseAmount: string;
    actualAmount: string;
    discountAmount: string;
    priceAfterDiscountAmount: string;
    discountPercent: string | null;
    currencyCode: string | null;
}

export interface FlowwowOrderListItem {
    shopId: number;
    shopName: string | null;
    shopAddress: string | null;
    orderId: number;
    status: number;
    createdAt: Date;
    deliveryDateFrom: Date;
    deliveryDateTo: Date;
    grossProductAmount: string;
    customerPaidAmount: string | null;
    bonusAmount: string | null;
    fixedCommissionAmount: string | null;
    variableCommissionAmount: string | null;
    sourceHost: string | null;
    positions: FlowwowOrderListPosition[];
}

export interface FlowwowOrderFinanceAmounts {
    orderId: number;
    customerPaidAmount: string;
    bonusAmount: string;
    fixedCommissionAmount: string;
    variableCommissionAmount: string;
}

export interface FlowwowOrdersFinanceImportResult {
    shopId: number;
    rowsRead: number;
    recognizedRows: number;
    ignoredRows: number;
    ordersInFile: number;
    createdOrders: number;
    updatedOrders: number;
    missingOrderIds: number[];
}

export interface FlowwowOrdersListResponse {
    period: { dateFrom: string; dateTo: string };
    filters: { shopId: number | null };
    shops: Array<{ shopId: number; name: string; address: string | null }>;
    summary: {
        ordersCount: number;
        turnover: string;
        averageCheck: string;
        commissionExpenses: string;
    };
    items: FlowwowOrderListItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
