import { BadGatewayException, Injectable } from '@nestjs/common';

import type { FlowwowOrderSnapshot, FlowwowRemoteOrder, FlowwowRemoteProduct } from '../types/flowwow-orders.types.js';

@Injectable()
export class FlowwowOrdersMapper {
    public mapSnapshot(remote: FlowwowRemoteOrder, syncedAt: Date): FlowwowOrderSnapshot {
        return {
            order: {
                shopId: remote.shopId,
                orderId: remote.id,
                status: remote.status,
                deliveryType: remote.deliveryType,
                deliveryTimeType: remote.deliveryTimeType,
                createdAtSource: this.unixDate(remote.createdDate),
                deliveryDateFrom: this.unixDate(remote.deliveryDateFrom),
                deliveryDateTo: this.unixDate(remote.deliveryDateTo),
                grossProductAmount: this.total(remote.products),
                sourceHost: remote.sourceHost ?? null,
                rawJson: remote,
                syncedAt,
            },
            positions: remote.products.map((product, lineIndex) => ({
                shopId: remote.shopId,
                orderId: remote.id,
                lineIndex,
                productId: product.productId ?? null,
                offerId: product.offerId ?? null,
                productType: product.type ?? null,
                categoryId: product.categoryId ?? null,
                subcategoryId: product.subCategoryId ?? null,
                name: product.name,
                quantity: product.count,
                costAmount: this.money(product.cost),
                baseAmount: this.baseAmount(product),
                actualAmount: this.money(product.sum),
                discountAmount: this.discountAmount(product),
                priceAfterDiscountAmount: this.priceAfterDiscount(product),
                catalogPriceAmount: product.price == null ? null : this.money(product.price),
                discountPercent: product.discount == null ? null : this.decimal(product.discount),
                currencyCode: product.currencyCode ?? null,
                rawJson: product,
            })),
        };
    }

    private total(products: FlowwowRemoteProduct[]): string {
        const kopecks = products.reduce((sum, product) => sum + this.toKopecks(product.sum), 0);
        return this.fromKopecks(kopecks);
    }

    private baseAmount(product: FlowwowRemoteProduct): string {
        this.validateQuantity(product.count);
        return this.fromKopecks(this.toKopecks(product.cost) * product.count);
    }

    private discountAmount(product: FlowwowRemoteProduct): string {
        this.validateQuantity(product.count);
        const baseKopecks = this.toKopecks(product.cost) * product.count;
        const actualKopecks = this.toKopecks(product.sum);
        return this.fromKopecks(Math.max(0, baseKopecks - actualKopecks));
    }

    private priceAfterDiscount(product: FlowwowRemoteProduct): string {
        this.validateQuantity(product.count);
        return this.fromKopecks(Math.round(this.toKopecks(product.sum) / product.count));
    }

    private validateQuantity(value: number): void {
        if (!Number.isInteger(value) || value <= 0) {
            throw new BadGatewayException('Flowwow вернул некорректное количество товара: ' + value);
        }
    }

    private money(value: string): string {
        return this.fromKopecks(this.toKopecks(value));
    }

    private decimal(value: string): string {
        if (!/^\d+(?:\.\d+)?$/.test(value)) {
            throw new BadGatewayException('Flowwow вернул некорректное числовое значение: ' + value);
        }
        return value;
    }

    private toKopecks(value: string): number {
        if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
            throw new BadGatewayException('Flowwow вернул некорректную сумму: ' + value);
        }
        const [rubles, fraction = ''] = value.split('.');
        const result = Number(rubles) * 100 + Number(fraction.padEnd(2, '0'));
        if (!Number.isSafeInteger(result)) throw new BadGatewayException('Flowwow вернул слишком большую сумму');
        return result;
    }

    private fromKopecks(value: number): string {
        return `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}`;
    }

    private unixDate(value: number): Date {
        const result = new Date(value * 1000);
        if (!Number.isInteger(value) || Number.isNaN(result.getTime())) {
            throw new BadGatewayException('Flowwow вернул некорректную дату заказа');
        }
        return result;
    }
}
