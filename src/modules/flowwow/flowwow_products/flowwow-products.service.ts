import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';

import { FlowwowShopsRepository } from '../flowwow_orders/flowwow-shops.repository.js';
import { FlowwowShopsService } from '../flowwow_orders/flowwow-shops.service.js';
import { FlowwowProductsClient } from './clients/flowwow-products.client.js';
import { FlowwowProductsMapper } from './mappers/flowwow-products.mapper.js';
import { FlowwowProductsRepository } from './flowwow-products.repository.js';
import type {
    FlowwowOfferMapping,
    FlowwowProductStatusRequest,
    FlowwowProductStatusResponse,
    FlowwowProductsListResponse,
    FlowwowProductsSyncResult,
} from './types/flowwow-products.types.js';

@Injectable()
export class FlowwowProductsService {
    private readonly logger = new Logger(FlowwowProductsService.name);
    private readonly pageSize = 1000;

    public constructor(
        private readonly client: FlowwowProductsClient,
        private readonly mapper: FlowwowProductsMapper,
        private readonly repository: FlowwowProductsRepository,
        private readonly shops: FlowwowShopsRepository,
        private readonly shopsService: FlowwowShopsService
    ) {}

    public async syncAll(): Promise<FlowwowProductsSyncResult> {
        let shopIds = await this.shops.findActiveShopIds();
        if (shopIds.length === 0) {
            shopIds = (await this.shopsService.syncAll()).activeShopIds;
        }
        if (shopIds.length === 0) {
            throw new BadGatewayException('Flowwow: активные магазины не найдены');
        }

        const shops: Record<number, number> = {};
        for (const shopId of shopIds) shops[shopId] = await this.syncShop(shopId);
        return { shops, total: Object.values(shops).reduce((total, count) => total + count, 0) };
    }

    public async getProducts(query: {
        shopId?: string;
        page?: string;
        limit?: string;
        status?: string;
        sortBy?: string;
        sortDirection?: string;
        search?: string;
    }): Promise<FlowwowProductsListResponse> {
        const shopId = query.shopId === undefined
            ? null
            : this.parsePositiveInteger(query.shopId, 0, 'shopId');
        const page = this.parsePositiveInteger(query.page, 1, 'page');
        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');
        if (limit > 100) throw new BadRequestException('limit не может быть больше 100');
        const statuses = ['all', 'active', 'hidden', 'archived'] as const;
        const sortFields = ['productId', 'productSales', 'stock', 'itemViews'] as const;
        const sortAliases = { sales: 'productSales', views: 'itemViews' } as const;
        const sortDirections = ['asc', 'desc'] as const;
        const status = query.status ?? 'active';
        const requestedSortBy = query.sortBy ?? 'productId';
        const sortBy = requestedSortBy in sortAliases
            ? sortAliases[requestedSortBy as keyof typeof sortAliases]
            : requestedSortBy;
        const sortDirection = query.sortDirection ?? 'asc';
        const search = query.search?.trim() || null;
        if (search !== null && search.length > 200) {
            throw new BadRequestException('search не может быть длиннее 200 символов');
        }
        if (!statuses.includes(status as typeof statuses[number])) {
            throw new BadRequestException('status должен быть all, active, hidden или archived');
        }
        if (!sortFields.includes(sortBy as typeof sortFields[number])) {
            throw new BadRequestException(
                'sortBy должен быть productId, sales, productSales, stock, views или itemViews'
            );
        }
        if (!sortDirections.includes(sortDirection as typeof sortDirections[number])) {
            throw new BadRequestException('sortDirection должен быть asc или desc');
        }

        const [result, shops] = await Promise.all([
            this.repository.findPage({
                shopId,
                page,
                limit,
                status: status as typeof statuses[number],
                sortBy: sortBy as typeof sortFields[number],
                sortDirection: sortDirection as typeof sortDirections[number],
                search,
            }),
            this.shops.findActiveShops(),
        ]);
        return { ...result, shops };
    }

    public changeVisibility(
        action: 'hide' | 'unhide',
        shopIdValue: string | undefined,
        body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        if (shopIdValue === undefined) {
            throw new BadRequestException('Параметр shopId обязателен');
        }
        const shopId = this.parsePositiveInteger(shopIdValue, 0, 'shopId');
        const request = this.validateStatusRequest(body);
        return this.sendVisibilityChange(action, shopId, request);
    }

    private async syncShop(shopId: number): Promise<number> {
        let received = 0;
        for (let page = 0; ; page++) {
            const response = await this.client.getProducts(shopId, {
                page,
                limit: this.pageSize,
                withArchive: true,
                withStats: true,
                extended: true,
            });
            const mappings = response.items
                .filter((product) => !product.offerId)
                .map((product): FlowwowOfferMapping => ({
                    productId: product.productId,
                    offerId: this.buildOfferId(product.productId),
                }));
            if (mappings.length > 0) {
                await this.assignMissingOfferIds(shopId, response.items, mappings);
            }
            const syncedAt = new Date();
            const saved = await this.repository.saveChunk(
                response.items.map((product) => this.mapper.mapSnapshot(shopId, product, syncedAt))
            );
            received += response.items.length;
            this.logger.log({
                event: 'flowwow_products_chunk_saved',
                shopId,
                page,
                receivedOnPage: response.items.length,
                received,
                saved,
                total: response.total,
            });
            if (received >= response.total) return received;
        }
    }

    private async assignMissingOfferIds(
        shopId: number,
        products: Array<{ productId: number; offerId: string | null }>,
        mappings: FlowwowOfferMapping[]
    ): Promise<void> {
        const result = await this.client.mapOffers(shopId, { offers: mappings });
        const failedProductIds = new Set(
            result.errors
                .map((error) => error.productId)
                .filter((productId): productId is number => productId !== null)
        );
        const failedOfferIds = new Set(
            result.errors
                .map((error) => error.offerId)
                .filter((offerId): offerId is string => offerId !== null)
        );
        const mappingByProductId = new Map(mappings.map((mapping) => [mapping.productId, mapping]));
        const hasUnidentifiedError = result.errors.some(
            (error) => error.productId === null && error.offerId === null
        );
        let assigned = 0;

        for (const product of products) {
            const mapping = mappingByProductId.get(product.productId);
            if (
                mapping &&
                !hasUnidentifiedError &&
                !failedProductIds.has(mapping.productId) &&
                !failedOfferIds.has(mapping.offerId)
            ) {
                product.offerId = mapping.offerId;
                assigned++;
            }
        }

        if (result.errors.length > 0) {
            this.logger.warn({
                event: 'flowwow_product_offer_mapping_partial_failure',
                shopId,
                requested: mappings.length,
                failed: result.errors.length,
                errors: result.errors,
            });
        }
        this.logger.log({
            event: 'flowwow_product_offer_mapping_finished',
            shopId,
            requested: mappings.length,
            assigned,
        });
    }

    private buildOfferId(productId: number): string {
        return String(productId);
    }

    private async sendVisibilityChange(
        action: 'hide' | 'unhide',
        shopId: number,
        request: FlowwowProductStatusRequest
    ): Promise<FlowwowProductStatusResponse> {
        const response = action === 'hide'
            ? await this.client.hideProducts(shopId, request)
            : await this.client.unhideProducts(shopId, request);
        await this.repository.applyStatusResult(shopId, response.data);
        return response;
    }

    private validateStatusRequest(body: unknown): FlowwowProductStatusRequest {
        if (!body || typeof body !== 'object' || !('offers' in body) || !Array.isArray(body.offers)) {
            throw new BadRequestException('Тело запроса должно содержать массив offers');
        }
        if (body.offers.length < 1 || body.offers.length > 1000) {
            throw new BadRequestException('Массив offers должен содержать от 1 до 1000 товаров');
        }

        const offerIds = body.offers.map((offer, index) => {
            if (!offer || typeof offer !== 'object' || !('offerId' in offer)) {
                throw new BadRequestException(`В offers[${index}] отсутствует offerId`);
            }
            const offerId = offer.offerId;
            if (typeof offerId !== 'string' || offerId.trim().length === 0 || offerId.length > 50) {
                throw new BadRequestException(`offers[${index}].offerId должен содержать от 1 до 50 символов`);
            }
            return offerId.trim();
        });
        if (new Set(offerIds).size !== offerIds.length) {
            throw new BadRequestException('Массив offers содержит повторяющиеся offerId');
        }
        return { offers: offerIds.map((offerId) => ({ offerId })) };
    }

    private parsePositiveInteger(value: string | undefined, defaultValue: number, field: string): number {
        if (value === undefined) return defaultValue;
        if (!/^\d+$/.test(value)) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }
        return parsed;
    }
}
