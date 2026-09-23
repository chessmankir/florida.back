import { BadGatewayException } from '@nestjs/common';

import { ProductProfit } from '../models/product-profit.model.js';
import { ProductProfitRow } from '../types/product-profit.types.js';

export class ProductProfitMapper {
    public static toEntity(row: ProductProfitRow, periodDate: string, syncedAt: Date): ProductProfit {
        const productId = this.extractId(row.assortment.meta.href);

        return {
            productId,
            periodDate,
            productType: row.assortment.meta.type,
            name: row.assortment.name,
            code: row.assortment.code ?? null,
            article: row.assortment.article ?? null,

            sellQuantity: String(row.sellQuantity ?? 0),
            sellSumMinor: String(row.sellSum ?? 0),
            sellCostSumMinor: String(row.sellCostSum ?? 0),

            returnQuantity: String(row.returnQuantity ?? 0),
            returnSumMinor: String(row.returnSum ?? 0),
            returnCostSumMinor: String(row.returnCostSum ?? 0),

            profitMinor: String(row.profit ?? 0),
            marginPercent: String(row.margin ?? 0),

            syncedAt,
        } as ProductProfit;
    }

    private static extractId(href: string): string {
        const id = href.split('/').filter(Boolean).at(-1);

        if (!id) {
            throw new BadGatewayException(`В отчёте прибыльности отсутствует ID товара: ${href}`);
        }

        return id;
    }
}
