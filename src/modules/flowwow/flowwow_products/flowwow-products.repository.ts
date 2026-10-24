import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { FlowwowProduct } from './models/flowwow-product.model.js';
import type {
    FlowwowProductAvailabilityAuditItem,
    FlowwowProductAvailabilityResponse,
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

    public async saveChunk(accountId: string, products: FlowwowProductSnapshot[]): Promise<number> {
        if (products.length === 0) return 0;
        await this.products.upsert(
            products.map((product) => ({ ...product, accountId })) as Parameters<typeof this.products.upsert>[0],
            ['shopId', 'productId']
        );
        return products.length;
    }

    public async findAllAvailability(accountId: string): Promise<FlowwowProductAvailabilityAuditItem[]> {
        const products = await this.products.query<Array<{
            shopId: number | string;
            productId: number | string;
            productName: string;
            isActive: boolean;
            isArchived: boolean;
            processingPlanId: string | null;
            processingPlanName: string | null;
        }>>(
            `
                SELECT
                    product.shop_id AS "shopId",
                    product.product_id AS "productId",
                    product.name AS "productName",
                    product.is_active AS "isActive",
                    product.is_archived AS "isArchived",
                    link.moysklad_product_id AS "processingPlanId",
                    plan.name AS "processingPlanName"
                FROM flowwow_products product
                LEFT JOIN flowwow_product_inventory_links link
                  ON link.account_id = product.account_id
                 AND link.shop_id = product.shop_id
                 AND link.flowwow_product_id = product.product_id
                LEFT JOIN moysklad_processing_plans plan
                  ON plan.account_id = link.account_id
                 AND plan.id = link.moysklad_product_id
                 AND plan.archived = false
                WHERE product.account_id = $1::uuid
                ORDER BY product.shop_id ASC, product.product_id ASC
            `,
            [accountId]
        );
        const components = await this.products.query<Array<{
            processingPlanId: string;
            componentId: string;
            name: string | null;
            requiredQuantity: string;
            availableQuantity: string;
        }>>(
            `
                SELECT
                    material.processing_plan_id AS "processingPlanId",
                    material.id AS "componentId",
                    inventory.name,
                    material.quantity::text AS "requiredQuantity",
                    COALESCE(inventory.available, 0)::text AS "availableQuantity"
                FROM moysklad_processing_plan_materials material
                LEFT JOIN moysklad_inventory_products inventory
                  ON inventory.account_id = material.account_id
                 AND inventory.id = material.assortment_id
                WHERE material.account_id = $1::uuid
                  AND COALESCE(inventory.name, '') NOT ILIKE 'Доставка Центральный%'
                ORDER BY material.processing_plan_id ASC, material.id ASC
            `,
            [accountId]
        );
        const componentsByPlan = new Map<string, typeof components>();
        for (const component of components) {
            const rows = componentsByPlan.get(component.processingPlanId) ?? [];
            rows.push(component);
            componentsByPlan.set(component.processingPlanId, rows);
        }

        return products.map((product) => {
            const linked = product.processingPlanId !== null;
            const planComponents = product.processingPlanId === null
                ? []
                : componentsByPlan.get(product.processingPlanId) ?? [];
            const quantities = planComponents.map((component) => ({
                ...component,
                required: Number(component.requiredQuantity),
                available: Number(component.availableQuantity),
            }));
            const limiting = quantities.filter((component) => component.required > 0);
            const availableToAssemble = limiting.length === 0
                ? 0
                : Math.max(0, Math.floor(Math.min(
                    ...limiting.map((component) => component.available / component.required)
                )));
            const missingComponents = limiting.flatMap((component) => {
                if (component.available >= component.required) return [];
                return [{
                    componentId: component.componentId,
                    name: component.name ?? 'Материал не найден в остатках МойСклад',
                    requiredQuantity: component.required,
                    availableQuantity: component.available,
                    missingQuantity: Math.max(component.required - component.available, 0),
                }];
            });
            const hasComponents = limiting.length > 0;

            return {
                shopId: Number(product.shopId),
                productId: Number(product.productId),
                productName: product.productName,
                isActive: product.isActive,
                isArchived: product.isArchived,
                linked,
                processingPlanId: product.processingPlanId,
                processingPlanName: product.processingPlanName,
                hasComponents,
                hasStock: linked && product.processingPlanName !== null
                    && hasComponents && missingComponents.length === 0 && availableToAssemble > 0,
                availableToAssemble,
                missingComponents,
            };
        });
    }

    public async findPage(options: FlowwowProductsListOptions): Promise<Omit<FlowwowProductsListResponse, 'shops'>> {
        const query = this.products
            .createQueryBuilder('product')
            .where('product.accountId = :accountId', { accountId: options.accountId })
            .skip((options.page - 1) * options.limit)
            .take(options.limit);

        if (options.shopId !== null) {
            query.andWhere('product.shopId = :shopId', { shopId: options.shopId });
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

        const linkExists = `EXISTS (
            SELECT 1 FROM flowwow_product_inventory_links filter_link
            WHERE filter_link.account_id = product.account_id
              AND filter_link.shop_id = product.shop_id
              AND filter_link.flowwow_product_id = product.product_id
        )`;
        if (options.linkStatus === 'linked') query.andWhere(linkExists);
        if (options.linkStatus === 'unlinked') query.andWhere(`NOT ${linkExists}`);

        const canAssemble = `EXISTS (
            SELECT 1
            FROM flowwow_product_inventory_links availability_link
            WHERE availability_link.account_id = product.account_id
              AND availability_link.shop_id = product.shop_id
              AND availability_link.flowwow_product_id = product.product_id
              AND EXISTS (
                  SELECT 1 FROM moysklad_processing_plan_materials availability_component
                  INNER JOIN moysklad_inventory_products availability_inventory
                    ON availability_inventory.account_id = availability_component.account_id
                   AND availability_inventory.id = availability_component.assortment_id
                  WHERE availability_component.account_id = availability_link.account_id
                    AND availability_component.processing_plan_id = availability_link.moysklad_product_id
                    AND availability_inventory.name NOT ILIKE 'Доставка Центральный%'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM moysklad_processing_plan_materials availability_component
                  LEFT JOIN moysklad_inventory_products availability_inventory
                    ON availability_inventory.account_id = availability_component.account_id
                   AND availability_inventory.id = availability_component.assortment_id
                  WHERE availability_component.account_id = availability_link.account_id
                    AND availability_component.processing_plan_id = availability_link.moysklad_product_id
                    AND COALESCE(availability_inventory.name, '') NOT ILIKE 'Доставка Центральный%'
                    AND COALESCE(availability_inventory.available, 0) < availability_component.quantity
              )
        )`;
        if (options.availability === 'in_stock') query.andWhere(canAssemble);
        if (options.availability === 'out_of_stock') {
            query.andWhere(linkExists).andWhere(`NOT ${canAssemble}`);
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
                              AND profit_link.account_id = product.account_id
                              AND profit_link.flowwow_product_id = product.product_id
                        ) THEN product.price * (
                            1::numeric - CAST(:flowwowExpenseRate AS numeric)
                        ) - COALESCE((
                            SELECT SUM(
                                profit_component.quantity
                                * COALESCE(profit_inventory.stock_cost_minor, profit_inventory.buy_price_minor)
                            ) / 100
                            FROM flowwow_product_inventory_links profit_link
                            INNER JOIN moysklad_processing_plan_materials profit_component
                                ON profit_component.processing_plan_id = profit_link.moysklad_product_id
                               AND profit_component.account_id = profit_link.account_id
                            INNER JOIN moysklad_inventory_products profit_inventory
                                ON profit_inventory.id = profit_component.assortment_id
                               AND profit_inventory.account_id = profit_component.account_id
                            WHERE profit_link.shop_id = product.shop_id
                              AND profit_link.flowwow_product_id = product.product_id
                              AND profit_link.account_id = product.account_id
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
                        FROM moysklad_processing_plan_materials component
                        INNER JOIN moysklad_inventory_products inventory
                            ON inventory.id = component.assortment_id
                           AND inventory.account_id = component.account_id
                        WHERE component.processing_plan_id = link.moysklad_product_id
                          AND component.account_id = link.account_id
                    ) bundle_data ON true
                    WHERE link.shop_id = ANY($1::integer[])
                      AND link.flowwow_product_id = ANY($2::integer[])
                      AND link.account_id = $3::uuid
                `,
                [
                    [...new Set(items.map((item) => item.shopId))],
                    [...new Set(items.map((item) => item.productId))],
                    options.accountId,
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
                linkStatus: options.linkStatus,
                availability: options.availability,
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

    public async findAvailability(
        accountId: string,
        shopId: number,
        productId: number
    ): Promise<FlowwowProductAvailabilityResponse | null> {
        const products = await this.products.find({ where: { accountId, shopId, productId }, take: 1 });
        if (products.length === 0) return null;
        const rows = await this.products.query<Array<{
            bundleId: string | null;
            componentId: string | null;
            name: string | null;
            requiredQuantity: string | null;
            availableQuantity: string | null;
        }>>(`
            SELECT link.moysklad_product_id AS "bundleId",
                   component.component_id AS "componentId",
                   inventory.name,
                   component.quantity AS "requiredQuantity",
                   COALESCE(inventory.available, 0) AS "availableQuantity"
            FROM flowwow_product_inventory_links link
            LEFT JOIN moysklad_processing_plan_materials component
              ON component.account_id = link.account_id
             AND component.processing_plan_id = link.moysklad_product_id
            LEFT JOIN moysklad_inventory_products inventory
              ON inventory.account_id = component.account_id
             AND inventory.id = component.assortment_id
            WHERE link.account_id = $1::uuid
              AND link.shop_id = $2
              AND link.flowwow_product_id = $3
              AND (inventory.name IS NULL OR inventory.name NOT ILIKE 'Доставка Центральный%')
        `, [accountId, shopId, productId]);
        if (rows.length === 0) {
            return { shopId, productId, linked: false, bundleId: null, hasComponents: false,
                canAssemble: false, availableToAssemble: 0, missingComponents: [] };
        }
        const componentRows = rows.filter((row) => row.componentId !== null);
        const missingComponents = componentRows.flatMap((row) => {
            const requiredQuantity = Number(row.requiredQuantity ?? 0);
            const availableQuantity = Number(row.availableQuantity ?? 0);
            if (availableQuantity >= requiredQuantity) return [];
            return [{
                componentId: row.componentId as string,
                name: row.name ?? 'Неизвестный компонент',
                requiredQuantity,
                availableQuantity,
                missingQuantity: Math.max(requiredQuantity - availableQuantity, 0),
            }];
        });
        const availableToAssemble = componentRows.length === 0 ? 0 : Math.max(0, Math.floor(Math.min(
            ...componentRows.map((row) => Number(row.availableQuantity ?? 0) / Number(row.requiredQuantity ?? 1))
        )));
        return {
            shopId, productId, linked: true, bundleId: rows[0].bundleId,
            hasComponents: componentRows.length > 0,
            canAssemble: componentRows.length > 0 && missingComponents.length === 0,
            availableToAssemble,
            missingComponents,
        };
    }

    public async applyStatusResult(accountId: string, shopId: number, items: FlowwowProductStatusItem[]): Promise<void> {
        const validItems = items.filter(
            (item): item is FlowwowProductStatusItem & { productId: number } =>
                Number.isSafeInteger(item.productId) && Number(item.productId) > 0
        );
        if (validItems.length === 0) return;

        await this.products.manager.transaction(async (manager) => {
            for (const item of validItems) {
                await manager.update(
                    FlowwowProduct,
                    { accountId, shopId, productId: item.productId },
                    { isActive: item.isActive }
                );
            }
        });
    }
}

