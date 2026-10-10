import type { FlowwowProduct } from '../models/flowwow-product.model.js';

export interface FlowwowRemoteProductStats {
    [key: string]: number;
    productSales: number;
    conversionAll: number;
    catalogViews: number;
    itemViews: number;
    addToCart: number;
    purchase: number;
}

export interface FlowwowRemoteProduct {
    offerId: string | null;
    productId: number;
    isActive: boolean;
    isArchived: boolean;
    type: number;
    categoryId: number;
    subCategoryId: number;
    name: string;
    description: string | null;
    url: string;
    available: number;
    stock: number;
    minOrder: number;
    price: string;
    discount: string;
    currencyCode: string;
    images: string[];
    productionTime: number;
    shipmentTime: number;
    canRent: number;
    originalId: number;
    isDeliveryPost: boolean;
    isStarred: boolean;
    vat: string;
    stats: FlowwowRemoteProductStats | null;
    properties: Record<string, unknown> | null;
}

export interface FlowwowProductsPage {
    items: FlowwowRemoteProduct[];
    total: number;
}

export interface FlowwowProductsRequest {
    page: number;
    limit: number;
    withArchive: boolean;
    withStats: boolean;
    extended: boolean;
}

export interface FlowwowOfferMapping {
    offerId: string;
    productId: number;
}

export interface FlowwowOfferMappingsRequest {
    offers: FlowwowOfferMapping[];
}

export interface FlowwowOfferMappingError {
    offerId: string | null;
    productId: number | null;
    message: string;
}

export interface FlowwowOfferMappingsResponse {
    errors: FlowwowOfferMappingError[];
}

export type FlowwowProductSnapshot = Omit<FlowwowProduct, never>;

export interface FlowwowProductsSyncResult {
    shops: Record<number, number>;
    total: number;
}

export interface FlowwowProductStatusOffer {
    offerId: string;
}

export interface FlowwowProductStatusRequest {
    offers: FlowwowProductStatusOffer[];
}

export interface FlowwowProductStatusItem {
    offerId: string | null;
    productId: number | null;
    isActive: boolean;
    updated: boolean;
}

export interface FlowwowProductStatusError {
    offerId: string | null;
    productId: number | null;
    isActive: boolean;
    message: string;
}

export interface FlowwowProductStatusResponse {
    shopId: number;
    data: FlowwowProductStatusItem[];
    errors: FlowwowProductStatusError[];
}

export interface FlowwowProductsListOptions {
    shopId: number | null;
    page: number;
    limit: number;
    status: 'all' | 'active' | 'hidden' | 'archived';
    sortBy: 'productId' | 'productSales' | 'stock' | 'itemViews';
    sortDirection: 'asc' | 'desc';
    search: string | null;
}

export interface FlowwowProductsListResponse {
    shops: Array<{ shopId: number; name: string; address: string | null }>;
    filters: {
        shopId: number | null;
        status: FlowwowProductsListOptions['status'];
        sortBy: FlowwowProductsListOptions['sortBy'];
        sortDirection: FlowwowProductsListOptions['sortDirection'];
        search: string | null;
    };
    items: FlowwowProduct[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
