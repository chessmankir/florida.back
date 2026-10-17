import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { MoyskladInventoryProduct } from './models/moysklad-inventory-product.model.js';
import { MoyskladBundleComponent } from './models/moysklad-bundle-component.model.js';
import type {
    MoyskladBundleComponentItem,
    MoyskladBundleComponentsResponse,
    MoyskladBundleComponentSnapshot,
    MoyskladInventoryListOptions,
    MoyskladInventoryListResponse,
    MoyskladInventorySnapshot,
} from './types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryRepository {
    public constructor(
        @InjectRepository(MoyskladInventoryProduct, 'florida')
        private readonly products: Repository<MoyskladInventoryProduct>
    ) {}

    public async saveAll(rows: MoyskladInventorySnapshot[]): Promise<number> {
        const chunkSize = 500;
        for (let offset = 0; offset < rows.length; offset += chunkSize) {
            await this.products.upsert(rows.slice(offset, offset + chunkSize), ['id']);
        }
        return rows.length;
    }

    public async replaceBundleComponents(
        bundleIds: string[],
        components: MoyskladBundleComponentSnapshot[]
    ): Promise<number> {
        if (bundleIds.length === 0) return 0;
        await this.products.manager.transaction(async (manager) => {
            await manager
                .createQueryBuilder()
                .delete()
                .from(MoyskladBundleComponent)
                .where('bundle_id IN (:...bundleIds)', { bundleIds })
                .execute();
            const chunkSize = 500;
            for (let offset = 0; offset < components.length; offset += chunkSize) {
                await manager.insert(MoyskladBundleComponent, components.slice(offset, offset + chunkSize));
            }
        });
        return components.length;
    }

    public async findBundleComponents(bundleId: string): Promise<MoyskladBundleComponentsResponse | null> {
        const bundle = await this.products.findOne({ where: { id: bundleId }, select: { id: true, name: true, productType: true } });
        if (!bundle || bundle.productType !== 'bundle') return null;
        const items = await this.products.manager.query<MoyskladBundleComponentItem[]>(
            `
                SELECT
                    component.component_id AS "componentId",
                    component.assortment_id AS "assortmentId",
                    component.assortment_type AS "assortmentType",
                    inventory.name,
                    inventory.code,
                    inventory.article,
                    component.quantity::text AS quantity,
                    inventory.buy_price_minor::text AS "buyPriceMinor",
                    inventory.stock_cost_minor::text AS "stockCostMinor",
                    COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor)::text AS "unitCostMinor",
                    (
                        component.quantity *
                        COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor)
                    )::text AS "totalCostMinor"
                FROM moysklad_bundle_components component
                INNER JOIN moysklad_inventory_products inventory
                    ON inventory.id = component.assortment_id
                WHERE component.bundle_id = $1
                ORDER BY inventory.name ASC, component.component_id ASC
            `,
            [bundleId]
        );
        const totalCostMinor = items.reduce(
            (total, item) => total + Number(item.totalCostMinor ?? 0),
            0
        );
        return {
            bundleId,
            bundleName: bundle.name,
            items,
            totalCostMinor: String(Math.round(totalCostMinor * 100) / 100),
        };
    }

    public async findPage(options: MoyskladInventoryListOptions): Promise<MoyskladInventoryListResponse> {
        const query = this.products.createQueryBuilder('product');
        if (options.search !== null) {
            query.andWhere(
                '(product.name ILIKE :search OR product.code ILIKE :search OR product.article ILIKE :search)',
                { search: `%${options.search}%` }
            );
        }
        if (options.type !== null) query.andWhere('product.productType = :type', { type: options.type });
        if (options.archived !== null) query.andWhere('product.archived = :archived', { archived: options.archived });
        const sortColumns = {
            name: 'product.name', stock: 'product.stock', available: 'product.available',
            cost: 'product.stockCostMinor', salePrice: 'product.salePriceMinor',
        } as const;
        const direction = options.sortDirection.toUpperCase() as 'ASC' | 'DESC';
        query.orderBy(sortColumns[options.sortBy], direction, 'NULLS LAST')
            .addOrderBy('product.id', 'ASC')
            .skip((options.page - 1) * options.limit)
            .take(options.limit);
        const [items, total] = await query.getManyAndCount();
        return {
            filters: {
                search: options.search, type: options.type, archived: options.archived,
                sortBy: options.sortBy, sortDirection: options.sortDirection,
            },
            items,
            pagination: { page: options.page, limit: options.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / options.limit) },
        };
    }
}

