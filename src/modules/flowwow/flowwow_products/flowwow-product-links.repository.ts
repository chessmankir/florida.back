import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { FlowwowProductInventoryLink } from './models/flowwow-product-inventory-link.model.js';

export interface LinkedInventoryBundle {
    id: string;
    productType: string;
    name: string;
    buyPriceMinor: string | null;
    salePriceMinor: string | null;
    stockCostMinor: string | null;
}

@Injectable()
export class FlowwowProductLinksRepository {
    public constructor(@InjectDataSource('seller') private readonly database: DataSource) {}

    public async replace(shopId: number, productId: number, bundleId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            await manager.delete(FlowwowProductInventoryLink, { shopId, flowwowProductId: productId });
            await manager.insert(FlowwowProductInventoryLink, {
                shopId,
                flowwowProductId: productId,
                bundleId,
                quantity: 1,
            });
        });
    }

    public async existsInInventory(bundleId: string): Promise<boolean> {
        const rows = await this.database.query<Array<{ exists: boolean }>>(
            'SELECT EXISTS(SELECT 1 FROM moysklad_inventory_products WHERE id = $1) AS "exists"',
            [bundleId]
        );
        return rows[0]?.exists === true;
    }

    public async find(shopId: number, productId: number): Promise<LinkedInventoryBundle | null> {
        const rows = await this.database.query<LinkedInventoryBundle[]>(
            `
                SELECT
                    inventory.id,
                    inventory.product_type AS "productType",
                    inventory.name,
                    inventory.buy_price_minor::text AS "buyPriceMinor",
                    inventory.sale_price_minor::text AS "salePriceMinor",
                    inventory.stock_cost_minor::text AS "stockCostMinor"
                FROM flowwow_product_inventory_links link
                INNER JOIN moysklad_inventory_products inventory
                    ON inventory.id = link.moysklad_product_id
                WHERE link.shop_id = $1
                  AND link.flowwow_product_id = $2
                LIMIT 1
            `,
            [shopId, productId]
        );
        return rows[0] ?? null;
    }
}
