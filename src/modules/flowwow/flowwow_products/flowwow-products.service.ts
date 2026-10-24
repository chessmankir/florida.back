import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { FlowwowShopsRepository } from '../flowwow_orders/flowwow-shops.repository.js';
import { FlowwowShopsService } from '../flowwow_orders/flowwow-shops.service.js';
import { FlowwowCommissionService } from '../flowwow_orders/flowwow-commission.service.js';
import { AccountAccessService } from '../../auth/account-access.service.js';
import { randomUUID } from 'node:crypto';
import { FlowwowProductsClient } from './clients/flowwow-products.client.js';
import { FlowwowProductsMapper } from './mappers/flowwow-products.mapper.js';
import { FlowwowProductsRepository } from './flowwow-products.repository.js';
import type {
    FlowwowOfferMapping,
    FlowwowProductStatusRequest,
    FlowwowProductStatusResponse,
    FlowwowProductsListResponse,
    FlowwowProductAvailabilityResponse,
    FlowwowProductAvailabilityAuditItem,
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
        private readonly shopsService: FlowwowShopsService,
        private readonly commission: FlowwowCommissionService,
        private readonly accounts: AccountAccessService
    ) {}

    public async syncAll(accountId: string, token?: string): Promise<FlowwowProductsSyncResult> {
        const flowwowToken = token ?? await this.accounts.flowwowToken(accountId);
        let shopIds = await this.shops.findActiveShopIds(accountId);
        if (shopIds.length === 0) {
            shopIds = (await this.shopsService.syncAll(accountId, flowwowToken)).activeShopIds;
        }
        if (shopIds.length === 0) {
            throw new BadGatewayException('Flowwow: активные магазины не найдены');
        }

        const shops: Record<number, number> = {};
        for (const shopId of shopIds) shops[shopId] = await this.syncShop(accountId, flowwowToken, shopId);
        return { shops, total: Object.values(shops).reduce((total, count) => total + count, 0) };
    }

    public async getProducts(accountId: string, query: {
        shopId?: string;
        page?: string;
        limit?: string;
        status?: string;
        sortBy?: string;
        sortDirection?: string;
        search?: string;
        linkStatus?: string;
        availability?: string;
    }): Promise<FlowwowProductsListResponse> {
        const shopId = query.shopId === undefined
            ? null
            : this.parsePositiveInteger(query.shopId, 0, 'shopId');
        const page = this.parsePositiveInteger(query.page, 1, 'page');
        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');
        if (limit > 100) throw new BadRequestException('limit не может быть больше 100');
        const statuses = ['all', 'active', 'hidden', 'archived'] as const;
        const linkStatuses = ['all', 'linked', 'unlinked'] as const;
        const availabilities = ['all', 'in_stock', 'out_of_stock'] as const;
        const sortFields = ['productId', 'productSales', 'stock', 'itemViews', 'profit'] as const;
        const sortAliases = { sales: 'productSales', views: 'itemViews' } as const;
        const sortDirections = ['asc', 'desc'] as const;
        const status = query.status ?? 'active';
        const linkStatus = query.linkStatus ?? 'all';
        const availability = query.availability ?? 'all';
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
        if (!linkStatuses.includes(linkStatus as typeof linkStatuses[number])) {
            throw new BadRequestException('linkStatus должен быть all, linked или unlinked');
        }
        if (!availabilities.includes(availability as typeof availabilities[number])) {
            throw new BadRequestException('availability должен быть all, in_stock или out_of_stock');
        }
        if (!sortFields.includes(sortBy as typeof sortFields[number])) {
            throw new BadRequestException(
                'sortBy должен быть productId, sales, productSales, stock, views, itemViews или profit'
            );
        }
        if (!sortDirections.includes(sortDirection as typeof sortDirections[number])) {
            throw new BadRequestException('sortDirection должен быть asc или desc');
        }

        const [result, shops] = await Promise.all([
            this.repository.findPage({
                accountId,
                shopId,
                page,
                limit,
                status: status as typeof statuses[number],
                linkStatus: linkStatus as typeof linkStatuses[number],
                availability: availability as typeof availabilities[number],
                sortBy: sortBy as typeof sortFields[number],
                sortDirection: sortDirection as typeof sortDirections[number],
                search,
                flowwowExpenseRate: this.commission.calculate(100).flowwowExpenses / 100,
            }),
            this.shops.findActiveShops(accountId),
        ]);
        for (const product of result.items) {
            if (product.costPriceAmount === null || product.costPriceAmount === undefined) continue;
            const expenses = this.commission.calculate(product.price).flowwowExpenses;
            product.flowwowExpenses = expenses.toFixed(2);
            product.profitAmount = (
                Number(product.price) - Number(product.costPriceAmount) - expenses
            ).toFixed(2);
        }
        return { ...result, shops };
    }

    public async getAvailability(
        accountId: string, shopIdValue?: string, productIdValue?: string
    ): Promise<FlowwowProductAvailabilityResponse> {
        const shopId = this.parsePositiveInteger(shopIdValue, 0, 'shopId');
        const productId = this.parsePositiveInteger(productIdValue, 0, 'productId');
        const result = await this.repository.findAvailability(accountId, shopId, productId);
        if (result === null) throw new NotFoundException('Товар Flowwow не найден');
        return result;
    }

    public getAvailabilityAudit(accountId: string): Promise<FlowwowProductAvailabilityAuditItem[]> {
        return this.repository.findAllAvailability(accountId);
    }

    public changeVisibility(
        accountId: string, action: 'hide' | 'unhide',
        shopIdValue: string | undefined,
        body: unknown
    ): Promise<FlowwowProductStatusResponse> {
        if (shopIdValue === undefined) {
            throw new BadRequestException('Параметр shopId обязателен');
        }
        const shopId = this.parsePositiveInteger(shopIdValue, 0, 'shopId');
        const request = this.validateStatusRequest(body);
        return this.sendVisibilityChange(accountId, action, shopId, request);
    }

    public async createProduct(accountId: string, shopIdValue: string | undefined, body: unknown): Promise<unknown> {
        const shopId = this.parsePositiveInteger(shopIdValue, 0, 'shopId');
        if (!body || typeof body !== 'object') throw new BadRequestException('Передайте данные товара');
        const source = body as Record<string, unknown>;
        const name = String(source.name ?? '').trim();
        const price = String(source.price ?? '').trim();
        const images = Array.isArray(source.images) ? source.images.map(String).map((value) => value.trim()).filter(Boolean) : [];
        const availability = source.availability === 'stock' ? 'stock' : 'production';
        const productionTime = Number(source.productionTime);
        const productionTimeMeasure = Number(source.productionTimeMeasure);
        if (!name || name.length > 255) throw new BadRequestException('Название обязательно и не должно превышать 255 символов');
        if (!/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0) throw new BadRequestException('Укажите корректную цену');
        if (images.length === 0 || images.some((url) => !/^https?:\/\//i.test(url))) throw new BadRequestException('Добавьте хотя бы одну публичную ссылку на фотографию');
        const token = await this.accounts.flowwowToken(accountId);
        const tree = await this.client.getCategoryTree(token, shopId) as { data?: Array<{ subCategories?: Array<{ subCategoryId?: number; name?: string }> }> };
        const subCategory = tree.data?.flatMap((category) => category.subCategories ?? []).find((item) => item.name?.trim().toLocaleLowerCase('ru-RU') === 'авторские букеты');
        if (!subCategory?.subCategoryId) throw new BadGatewayException('Flowwow не вернул подкатегорию «Авторские букеты» для выбранного магазина');
        const composition = Array.isArray(source.consist) ? source.consist.map((item) => {
            const value = item as Record<string, unknown>;
            return { name: String(value.name ?? '').trim(), quantity: Number(value.quantity), measure: 1 };
        }).filter((item) => item.name && Number.isInteger(item.quantity) && item.quantity > 0) : [];
        const product: Record<string, unknown> = {
            offerId: `florida-${randomUUID()}`, productType: 1, subCategoryId: subCategory.subCategoryId,
            name, price, images, minOrderCount: 1,
            height: { val: Number(source.height), measure: 3 }, width: { val: Number(source.width), measure: 3 },
            consist: composition, manufacturerName: String(source.manufacturerName ?? '').trim(),
        };
        if (availability === 'stock') {
            product.stock = 1;
        } else {
            if (!Number.isFinite(productionTime) || productionTime <= 0) throw new BadRequestException('Укажите время изготовления');
            if (![7, 8, 9].includes(productionTimeMeasure)) throw new BadRequestException('Укажите единицу времени изготовления');
            product.productionTime = { val: productionTime, measure: productionTimeMeasure };
        }
        if (!Number.isFinite(Number(source.height)) || Number(source.height) <= 0 || !Number.isFinite(Number(source.width)) || Number(source.width) <= 0) throw new BadRequestException('Укажите ширину и высоту');
        if (!product.manufacturerName) delete product.manufacturerName;
        const flowwowRequest = { products: [product] };
        console.log('[Flowwow products/create] request', JSON.stringify({
            endpoint: '/apiseller/products/create',
            shopId,
            body: flowwowRequest,
        }, null, 2));
        const result = await this.client.createProducts(token, shopId, flowwowRequest) as { summary?: { success?: number }; errors?: Array<{ message?: string }> };
        console.log('[Flowwow products/create] response', JSON.stringify({ shopId, body: result }, null, 2));
        if (!result.summary?.success) throw new BadGatewayException(result.errors?.[0]?.message ?? 'Flowwow не создал товар');
        await this.syncShop(accountId, token, shopId);
        return result;
    }

    private async syncShop(accountId: string, token: string, shopId: number): Promise<number> {
        let received = 0;
        for (let page = 0; ; page++) {
            const response = await this.client.getProducts(token, shopId, {
                status: 'active',
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
                await this.assignMissingOfferIds(token, shopId, response.items, mappings);
            }
            const syncedAt = new Date();
            const saved = await this.repository.saveChunk(accountId,
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
        token: string, shopId: number,
        products: Array<{ productId: number; offerId: string | null }>,
        mappings: FlowwowOfferMapping[]
    ): Promise<void> {
        const result = await this.client.mapOffers(token, shopId, { offers: mappings });
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
        accountId: string, action: 'hide' | 'unhide',
        shopId: number,
        request: FlowwowProductStatusRequest
    ): Promise<FlowwowProductStatusResponse> {
        const token = await this.accounts.flowwowToken(accountId);
        const response = action === 'hide'
            ? await this.client.hideProducts(token, shopId, request)
            : await this.client.unhideProducts(token, shopId, request);
        await this.repository.applyStatusResult(accountId, shopId, response.data);
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
