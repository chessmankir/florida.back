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
    public constructor(@InjectDataSource('florida') private readonly database: DataSource) {}

    public async replace(accountId: string, shopId: number, productId: number, bundleId: string): Promise<void> {
        await this.database.transaction(async (manager) => {
            await manager.delete(FlowwowProductInventoryLink, { accountId, shopId, flowwowProductId: productId });
            await manager.insert(FlowwowProductInventoryLink, {
                accountId, shopId,
                flowwowProductId: productId,
                bundleId,
                quantity: 1,
            });
        });
    }

    public async remove(accountId: string, shopId: number, productId: number): Promise<void> {
        await this.database.getRepository(FlowwowProductInventoryLink).delete({
            accountId, shopId,
            flowwowProductId: productId,
        });
    }

    public async existsInInventory(accountId: string, bundleId: string): Promise<boolean> {
        const rows = await this.database.query<Array<{ exists: boolean }>>(
            `SELECT EXISTS(
                SELECT 1 FROM moysklad_processing_plans
                WHERE id = $1 AND account_id = $2 AND archived = false
            ) AS "exists"`,
            [bundleId, accountId]
        );
        return rows[0]?.exists === true;
    }

    public async find(accountId: string, shopId: number, productId: number): Promise<LinkedInventoryBundle | null> {
        const rows = await this.database.query<LinkedInventoryBundle[]>(
            `
                SELECT
                    plan.id,
                    'processingplan'::text AS "productType",
                    plan.name,
                    plan.production_cost_minor::text AS "buyPriceMinor",
                    NULL::text AS "salePriceMinor",
                    plan.production_cost_minor::text AS "stockCostMinor"
                FROM flowwow_product_inventory_links link
                INNER JOIN moysklad_processing_plans plan
                    ON plan.id = link.moysklad_product_id
                   AND plan.account_id = link.account_id
                WHERE link.shop_id = $1
                  AND link.flowwow_product_id = $2
                  AND link.account_id = $3
                LIMIT 1
            `,
            [shopId, productId, accountId]
        );
        return rows[0] ?? null;
    }
}

