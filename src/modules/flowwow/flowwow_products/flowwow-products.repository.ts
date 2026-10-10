import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { FlowwowProduct } from './models/flowwow-product.model.js';
import type {
    FlowwowProductStatusItem,
    FlowwowProductSnapshot,
    FlowwowProductsListOptions,
    FlowwowProductsListResponse,
} from './types/flowwow-products.types.js';

@Injectable()
export class FlowwowProductsRepository {
    public constructor(
        @InjectRepository(FlowwowProduct, 'seller')
        private readonly products: Repository<FlowwowProduct>
    ) {}

    public async saveChunk(products: FlowwowProductSnapshot[]): Promise<number> {
        if (products.length === 0) return 0;
        await this.products.upsert(
            products as Parameters<typeof this.products.upsert>[0],
            ['shopId', 'productId']
        );
        return products.length;
    }

    public async findPage(options: FlowwowProductsListOptions): Promise<Omit<FlowwowProductsListResponse, 'shops'>> {
        const query = this.products
            .createQueryBuilder('product')
            .skip((options.page - 1) * options.limit)
            .take(options.limit);

        if (options.shopId !== null) {
            query.where('product.shopId = :shopId', { shopId: options.shopId });
        }
        if (options.search !== null) {
            query.andWhere('product.name ILIKE :search', { search: `%${options.search}%` });
        }
        if (options.status === 'active') {
            query.andWhere('product.isActive = :isActive', { isActive: true });
            query.andWhere('product.isArchived = :isArchived', { isArchived: false });
        } else if (options.status === 'hidden') {
            query.andWhere('product.isActive = :isActive', { isActive: false });
            query.andWhere('product.isArchived = :isArchived', { isArchived: false });
        } else if (options.status === 'archived') {
            query.andWhere('product.isArchived = :isArchived', { isArchived: true });
        }

        const direction = options.sortDirection.toUpperCase() as 'ASC' | 'DESC';
        if (options.sortBy === 'productSales' || options.sortBy === 'itemViews') {
            query
                .addSelect(`COALESCE((product.stats ->> '${options.sortBy}')::numeric, 0)`, 'sort_value')
                .orderBy('sort_value', direction);
        } else if (options.sortBy === 'stock') {
            query.orderBy('product.stock', direction);
        } else {
            query.orderBy('product.productId', direction);
        }
        query.addOrderBy('product.shopId', 'ASC').addOrderBy('product.productId', 'ASC');

        const [items, total] = await query.getManyAndCount();
        return {
            filters: {
                shopId: options.shopId,
                status: options.status,
                sortBy: options.sortBy,
                sortDirection: options.sortDirection,
                search: options.search,
            },
            items,
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                totalPages: total === 0 ? 0 : Math.ceil(total / options.limit),
            },
        };
    }

    public async applyStatusResult(shopId: number, items: FlowwowProductStatusItem[]): Promise<void> {
        const validItems = items.filter(
            (item): item is FlowwowProductStatusItem & { productId: number } =>
                Number.isSafeInteger(item.productId) && Number(item.productId) > 0
        );
        if (validItems.length === 0) return;

        await this.products.manager.transaction(async (manager) => {
            for (const item of validItems) {
                await manager.update(
                    FlowwowProduct,
                    { shopId, productId: item.productId },
                    { isActive: item.isActive }
                );
            }
        });
    }
}
