import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { MoyskladInventoryProduct } from './models/moysklad-inventory-product.model.js';
import type { MoyskladInventoryListOptions, MoyskladInventoryListResponse, MoyskladInventorySnapshot } from './types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryRepository {
    public constructor(
        @InjectRepository(MoyskladInventoryProduct, 'seller')
        private readonly products: Repository<MoyskladInventoryProduct>
    ) {}

    public async saveAll(rows: MoyskladInventorySnapshot[]): Promise<number> {
        const chunkSize = 500;
        for (let offset = 0; offset < rows.length; offset += chunkSize) {
            await this.products.upsert(rows.slice(offset, offset + chunkSize), ['id']);
        }
        return rows.length;
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
