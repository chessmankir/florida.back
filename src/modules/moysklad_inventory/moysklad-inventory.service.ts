import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MoyskladInventoryClient } from './clients/moysklad-inventory.client.js';
import { MoyskladInventoryMapper } from './mappers/moysklad-inventory.mapper.js';
import { MoyskladInventoryRepository } from './moysklad-inventory.repository.js';
import type {
    MoyskladBundleComponentsResponse,
    MoyskladBundleComponentSnapshot,
    MoyskladInventoryListResponse,
    MoyskladInventorySnapshot,
    MoyskladInventorySyncResult,
} from './types/moysklad-inventory.types.js';
import { AccountAccessService } from '../auth/account-access.service.js';

@Injectable()
export class MoyskladInventoryService {
    private readonly logger = new Logger(MoyskladInventoryService.name);
    private readonly pageSize: number;

    public constructor(
        config: ConfigService,
        private readonly client: MoyskladInventoryClient,
        private readonly mapper: MoyskladInventoryMapper,
        private readonly repository: MoyskladInventoryRepository,
        private readonly accounts: AccountAccessService
    ) { this.pageSize = config.get<number>('MOYSKLAD_SYNC_PAGE_SIZE', 100); }

    public async syncAll(accountId: string, token?: string): Promise<MoyskladInventorySyncResult> {
        const moyskladToken = token ?? await this.accounts.moyskladToken(accountId);
        const syncedAt = new Date();
        const products = new Map<string, MoyskladInventorySnapshot>();
        let assortmentReceived = 0;
        for (let offset = 0; ; offset += this.pageSize) {
            const page = await this.client.getAssortmentPage(moyskladToken, this.pageSize, offset);
            for (const row of page.rows) {
                const snapshot = this.mapper.fromAssortment(row, syncedAt);
                products.set(snapshot.id, snapshot);
            }
            assortmentReceived += page.rows.length;
            if (assortmentReceived >= page.meta.size) break;
            if (page.rows.length === 0) throw new BadGatewayException('МойСклад вернул пустую страницу ассортимента');
        }

        const bundleIds = [...products.values()]
            .filter((product) => product.productType === 'bundle')
            .map((product) => product.id);
        const components: MoyskladBundleComponentSnapshot[] = [];
        for (const bundleId of bundleIds) {
            let receivedForBundle = 0;
            for (let offset = 0; ; offset += this.pageSize) {
                const page = await this.client.getBundleComponentsPage(moyskladToken, bundleId, this.pageSize, offset);
                for (const component of page.rows) {
                    components.push({
                        bundleId,
                        componentId: component.id,
                        assortmentId: this.idFromHref(component.assortment.meta.href),
                        assortmentType: component.assortment.meta.type,
                        quantity: String(component.quantity),
                        syncedAt,
                    });
                }
                receivedForBundle += page.rows.length;
                if (receivedForBundle >= page.meta.size) break;
                if (page.rows.length === 0) {
                    throw new BadGatewayException(`МойСклад вернул пустую страницу компонентов комплекта ${bundleId}`);
                }
            }
            await this.sleep(75);
        }

        let stockRowsReceived = 0;
        for (let offset = 0; ; offset += this.pageSize) {
            const page = await this.client.getStockPage(moyskladToken, this.pageSize, offset);
            for (const row of page.rows) {
                const id = this.mapper.stockId(row);
                const snapshot = this.mapper.applyStock(products.get(id), row, syncedAt);
                products.set(snapshot.id, snapshot);
            }
            stockRowsReceived += page.rows.length;
            if (stockRowsReceived >= page.meta.size) break;
            if (page.rows.length === 0) throw new BadGatewayException('МойСклад вернул пустую страницу остатков');
        }
        const saved = await this.repository.saveAll(accountId, [...products.values()]);
        const componentsReceived = await this.repository.replaceBundleComponents(accountId, bundleIds, components);
        this.logger.log({
            event: 'moysklad_inventory_synchronization_finished',
            assortmentReceived,
            stockRowsReceived,
            bundlesReceived: bundleIds.length,
            componentsReceived,
            saved,
        });
        return { assortmentReceived, stockRowsReceived, bundlesReceived: bundleIds.length, componentsReceived, saved };
    }

    public async getBundleComponents(accountId: string, bundleIdValue: string): Promise<MoyskladBundleComponentsResponse> {
        const bundleId = this.uuid(bundleIdValue, 'bundleId');
        const result = await this.repository.findBundleComponents(accountId, bundleId);
        if (!result) throw new NotFoundException('Комплект МойСклад не найден');
        return result;
    }

    public getProducts(accountId: string, query: Record<string, string | undefined>): Promise<MoyskladInventoryListResponse> {
        const page = this.positiveInteger(query.page, 1, 'page');
        const limit = this.positiveInteger(query.limit, 50, 'limit');
        if (limit > 100) throw new BadRequestException('limit не может быть больше 100');
        const search = query.search?.trim() || null;
        if (search && search.length > 200) throw new BadRequestException('search не может быть длиннее 200 символов');
        const type = query.type?.trim() || null;
        const archived = query.archived === undefined ? null : this.boolean(query.archived, 'archived');
        const sortBy = query.sortBy ?? 'name';
        const sortDirection = query.sortDirection ?? 'asc';
        const sortFields = ['name', 'stock', 'available', 'cost', 'salePrice'] as const;
        if (!sortFields.includes(sortBy as typeof sortFields[number])) throw new BadRequestException('Некорректный sortBy');
        if (sortDirection !== 'asc' && sortDirection !== 'desc') throw new BadRequestException('sortDirection должен быть asc или desc');
        return this.repository.findPage({
            accountId,
            page, limit, search, type, archived,
            sortBy: sortBy as typeof sortFields[number], sortDirection,
        });
    }

    private positiveInteger(value: string | undefined, fallback: number, field: string): number {
        if (value === undefined) return fallback;
        if (!/^\d+$/.test(value) || Number(value) < 1) throw new BadRequestException(`${field} должен быть положительным целым числом`);
        return Number(value);
    }
    private boolean(value: string, field: string): boolean {
        if (value === 'true') return true;
        if (value === 'false') return false;
        throw new BadRequestException(`${field} должен быть true или false`);
    }

    private uuid(value: string, field: string): string {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            throw new BadRequestException(`${field} должен быть корректным UUID`);
        }
        return value;
    }

    private idFromHref(href: string): string {
        const id = href.split('/').filter(Boolean).at(-1)?.split('?')[0];
        if (!id) throw new BadGatewayException(`МойСклад вернул ссылку без ID: ${href}`);
        return id;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
