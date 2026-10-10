import { BadGatewayException, Injectable } from '@nestjs/common';

import type { FlowwowProductSnapshot, FlowwowRemoteProduct } from '../types/flowwow-products.types.js';

@Injectable()
export class FlowwowProductsMapper {
    public mapSnapshot(shopId: number, product: FlowwowRemoteProduct, syncedAt: Date): FlowwowProductSnapshot {
        if (!Number.isSafeInteger(product.productId) || product.productId < 1) {
            throw new BadGatewayException('Flowwow вернул товар без корректного productId');
        }

        return {
            shopId,
            productId: product.productId,
            offerId: product.offerId ?? null,
            isActive: product.isActive,
            isArchived: product.isArchived,
            type: product.type,
            categoryId: product.categoryId,
            subCategoryId: product.subCategoryId,
            name: product.name,
            description: product.description ?? null,
            url: product.url,
            available: product.available,
            stock: product.stock,
            minOrder: product.minOrder,
            price: this.decimal(product.price, 'price'),
            discount: this.decimal(product.discount, 'discount'),
            currencyCode: product.currencyCode,
            images: product.images,
            productionTime: product.productionTime,
            shipmentTime: product.shipmentTime,
            canRent: product.canRent,
            originalId: product.originalId,
            isDeliveryPost: product.isDeliveryPost,
            isStarred: product.isStarred,
            vat: product.vat,
            stats: product.stats,
            properties: product.properties,
            syncedAt,
        };
    }

    private decimal(value: string, field: string): string {
        if (!/^\d+(?:\.\d+)?$/.test(value)) {
            throw new BadGatewayException(`Flowwow вернул некорректное поле ${field}: ${value}`);
        }
        return value;
    }
}
