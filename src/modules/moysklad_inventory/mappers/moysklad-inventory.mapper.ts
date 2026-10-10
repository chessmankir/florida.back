import { BadGatewayException, Injectable } from '@nestjs/common';
import type { MoyskladAssortmentRow, MoyskladInventorySnapshot, MoyskladStockRow } from '../types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryMapper {
    public fromAssortment(row: MoyskladAssortmentRow, syncedAt: Date): MoyskladInventorySnapshot {
        return {
            id: row.id ?? this.extractId(row.meta.href),
            productType: row.meta.type,
            parentProductId: row.product?.meta?.href ? this.extractId(row.product.meta.href) : null,
            name: row.name,
            code: row.code ?? null,
            article: row.article ?? null,
            externalCode: row.externalCode ?? null,
            pathName: row.pathName ?? null,
            uomName: row.uom?.name ?? null,
            archived: row.archived ?? null,
            buyPriceMinor: this.money(row.buyPrice?.value),
            salePriceMinor: this.money(row.salePrices?.[0]?.value),
            minimumPriceMinor: this.money(row.minPrice?.value),
            stock: '0', reserve: '0', inTransit: '0', available: '0',
            stockCostMinor: null, stockValueMinor: null, minimumBalance: null, daysOnStock: null,
            sourceUpdatedAt: row.updated ? this.date(row.updated) : null,
            syncedAt,
        };
    }

    public applyStock(snapshot: MoyskladInventorySnapshot | undefined, row: MoyskladStockRow, syncedAt: Date): MoyskladInventorySnapshot {
        const assortment = this.stockAssortment(row);
        const id = this.extractId(assortment.meta.href);
        const stock = row.stock ?? 0;
        const cost = row.price;
        return {
            ...(snapshot ?? {
                id, productType: assortment.meta.type, parentProductId: null,
                name: assortment.name, code: assortment.code ?? null, article: assortment.article ?? null,
                externalCode: null, pathName: null, uomName: null, archived: null, buyPriceMinor: null,
                salePriceMinor: this.money(row.salePrice), minimumPriceMinor: null, sourceUpdatedAt: null,
            }),
            stock: String(stock),
            reserve: String(row.reserve ?? 0),
            inTransit: String(row.inTransit ?? 0),
            available: String(row.quantity ?? stock - (row.reserve ?? 0)),
            stockCostMinor: this.money(cost),
            stockValueMinor: cost === undefined ? null : String(Math.round(stock * cost * 100) / 100),
            minimumBalance: row.minimumBalance === undefined ? null : String(row.minimumBalance),
            daysOnStock: row.daysOnStock === undefined ? null : String(row.daysOnStock),
            syncedAt,
        };
    }

    public stockId(row: MoyskladStockRow): string {
        return this.extractId(this.stockAssortment(row).meta.href);
    }

    private stockAssortment(row: MoyskladStockRow): { meta: { href: string; type: string }; name: string; code?: string; article?: string } {
        if (row.assortment?.meta && row.assortment.name) return row.assortment;
        if (row.meta && row.name) {
            return { meta: row.meta, name: row.name, code: row.code, article: row.article };
        }
        throw new BadGatewayException('МойСклад вернул строку остатков без meta или name');
    }

    private money(value: number | undefined): string | null {
        return value === undefined || !Number.isFinite(value) ? null : String(value);
    }
    private date(value: string): Date | null {
        const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + '+03:00');
        return Number.isNaN(date.getTime()) ? null : date;
    }
    private extractId(href: string): string {
        const id = href.split('/').filter(Boolean).at(-1)?.split('?')[0];
        if (!id) throw new BadGatewayException(`МойСклад вернул ссылку без ID: ${href}`);
        return id;
    }
}
