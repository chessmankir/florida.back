import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MoyskladInventoryClient } from './clients/moysklad-inventory.client.js';
import { MoyskladInventoryMapper } from './mappers/moysklad-inventory.mapper.js';
import { MoyskladInventoryRepository } from './moysklad-inventory.repository.js';
import type { MoyskladInventoryListResponse, MoyskladInventorySnapshot, MoyskladInventorySyncResult } from './types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryService {
    private readonly logger = new Logger(MoyskladInventoryService.name);
    private readonly pageSize: number;

    public constructor(
        config: ConfigService,
        private readonly client: MoyskladInventoryClient,
        private readonly mapper: MoyskladInventoryMapper,
        private readonly repository: MoyskladInventoryRepository
    ) { this.pageSize = config.get<number>('MOYSKLAD_SYNC_PAGE_SIZE', 100); }

    public async syncAll(): Promise<MoyskladInventorySyncResult> {
        const syncedAt = new Date();
        const products = new Map<string, MoyskladInventorySnapshot>();
        let assortmentReceived = 0;
        for (let offset = 0; ; offset += this.pageSize) {
            const page = await this.client.getAssortmentPage(this.pageSize, offset);
            for (const row of page.rows) {
                const snapshot = this.mapper.fromAssortment(row, syncedAt);
                products.set(snapshot.id, snapshot);
            }
            assortmentReceived += page.rows.length;
            if (assortmentReceived >= page.meta.size) break;
            if (page.rows.length === 0) throw new BadGatewayException('МойСклад вернул пустую страницу ассортимента');
        }

        let stockRowsReceived = 0;
        for (let offset = 0; ; offset += this.pageSize) {
            const page = await this.client.getStockPage(this.pageSize, offset);
            for (const row of page.rows) {
                const id = this.mapper.stockId(row);
                const snapshot = this.mapper.applyStock(products.get(id), row, syncedAt);
                products.set(snapshot.id, snapshot);
            }
            stockRowsReceived += page.rows.length;
            if (stockRowsReceived >= page.meta.size) break;
            if (page.rows.length === 0) throw new BadGatewayException('МойСклад вернул пустую страницу остатков');
        }
        const saved = await this.repository.saveAll([...products.values()]);
        this.logger.log({ event: 'moysklad_inventory_synchronization_finished', assortmentReceived, stockRowsReceived, saved });
        return { assortmentReceived, stockRowsReceived, saved };
    }

    public getProducts(query: Record<string, string | undefined>): Promise<MoyskladInventoryListResponse> {
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
}
