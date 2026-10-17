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
        @InjectRepository(FlowwowProduct, 'florida')
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

        const total = await query.getCount();
        const direction = options.sortDirection.toUpperCase() as 'ASC' | 'DESC';
        if (options.sortBy === 'productSales' || options.sortBy === 'itemViews') {
            query
                .addSelect(`COALESCE((product.stats ->> '${options.sortBy}')::numeric, 0)`, 'sort_value')
                .orderBy('sort_value', direction);
        } else if (options.sortBy === 'profit') {
            query
                .addSelect(
                    `CASE
                        WHEN EXISTS (
                            SELECT 1
                            FROM flowwow_product_inventory_links profit_link
                            WHERE profit_link.shop_id = product.shop_id
                              AND profit_link.flowwow_product_id = product.product_id
                        ) THEN product.price * (
                            1::numeric - CAST(:flowwowExpenseRate AS numeric)
                        ) - COALESCE((
                            SELECT SUM(
                                profit_component.quantity
                                * COALESCE(profit_inventory.stock_cost_minor, profit_inventory.buy_price_minor)
                            ) / 100
                            FROM flowwow_product_inventory_links profit_link
                            INNER JOIN moysklad_bundle_components profit_component
                                ON profit_component.bundle_id = profit_link.moysklad_product_id
                            INNER JOIN moysklad_inventory_products profit_inventory
                                ON profit_inventory.id = profit_component.assortment_id
                            WHERE profit_link.shop_id = product.shop_id
                              AND profit_link.flowwow_product_id = product.product_id
                        ), 0)
                        ELSE NULL
                    END`,
                    'sort_value'
                )
                .setParameter('flowwowExpenseRate', options.flowwowExpenseRate)
                .orderBy('sort_value', direction, 'NULLS LAST');
        } else if (options.sortBy === 'stock') {
            query.orderBy('product.stock', direction);
        } else {
            query.orderBy('product.productId', direction);
        }
        query.addOrderBy('product.shopId', 'ASC').addOrderBy('product.productId', 'ASC');

        const items = await query.getMany();
        if (items.length > 0) {
            const links = await this.products.query<Array<{
                shopId: number | string;
                productId: number | string;
                bundleId: string;
                costPriceAmount: string | null;
                availableToAssemble: number | string | null;
            }>>(
                `
                    SELECT
                        link.shop_id AS "shopId",
                        link.flowwow_product_id AS "productId",
                        link.moysklad_product_id AS "bundleId",
                        ROUND(bundle_data.bundle_cost_minor / 100, 2)::text AS "costPriceAmount",
                        bundle_data.available_to_assemble AS "availableToAssemble"
                    FROM flowwow_product_inventory_links link
                    LEFT JOIN LATERAL (
                        SELECT
                            SUM(
                                component.quantity
                                * COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor)
                            ) AS bundle_cost_minor,
                            MIN(
                                GREATEST(
                                    FLOOR(
                                        COALESCE(inventory.available, 0)
                                        / NULLIF(component.quantity, 0)
                                    ),
                                    0
                                )
                            ) FILTER (
                                WHERE inventory.name NOT ILIKE 'Доставка Центральный%'
                            )::integer AS available_to_assemble
                        FROM moysklad_bundle_components component
                        INNER JOIN moysklad_inventory_products inventory
                            ON inventory.id = component.assortment_id
                        WHERE component.bundle_id = link.moysklad_product_id
                    ) bundle_data ON true
                    WHERE link.shop_id = ANY($1::integer[])
                      AND link.flowwow_product_id = ANY($2::integer[])
                `,
                [
                    [...new Set(items.map((item) => item.shopId))],
                    [...new Set(items.map((item) => item.productId))],
                ]
            );
            const linked = new Map(links.map((link) => [`${link.shopId}:${link.productId}`, link]));
            for (const item of items) {
                const link = linked.get(`${item.shopId}:${item.productId}`);
                item.bundleId = link?.bundleId ?? null;
                item.costPriceAmount = link?.costPriceAmount ?? null;
                item.availableToAssemble = link?.availableToAssemble == null
                    ? null
                    : Number(link.availableToAssemble);
            }
        }
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

