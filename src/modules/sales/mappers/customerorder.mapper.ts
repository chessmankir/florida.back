import { BadGatewayException, Injectable } from '@nestjs/common';

import type { CustomerOrder, CustomerOrderPosition, Reference } from '../types/customerorder.types.js';
import type { SalesOrderSnapshot, SalesOrderRecord, SalesOrderPositionRecord } from '../types/sales.types.js';

@Injectable()
export class CustomerOrderMapper {
    public mapSnapshot(order: CustomerOrder, positions: CustomerOrderPosition[], syncedAt: Date): SalesOrderSnapshot {
        return {
            order: this.mapOrder(order, syncedAt),
            positions: positions.map((position) => this.mapPosition(order.id, position)),
        };
    }

    private mapOrder(order: CustomerOrder, syncedAt: Date): SalesOrderRecord {
        return {
            id: order.id,
            number: order.name,
            externalCode: order.externalCode ?? null,
            createdAtSource: order.created ?? null,
            documentAt: order.moment,
            sourceUpdatedAt: order.updated,
            isPosted: order.applicable,
            stateId: this.referenceId(order.state),
            customerId: this.referenceId(order.agent),
            organizationId: this.referenceId(order.organization),
            storeId: this.referenceId(order.store),
            ownerId: this.referenceId(order.owner),
            currencyId: this.referenceId(order.rate?.currency),
            exchangeRate: this.decimal(order.rate?.value),
            sumMinor: this.requiredDecimal(order.sum),
            paidSumMinor: this.decimal(order.payedSum),
            shippedSumMinor: this.decimal(order.shippedSum),
            invoicedSumMinor: this.decimal(order.invoicedSum),
            reservedSumMinor: this.decimal(order.reservedSum),
            vatEnabled: order.vatEnabled ?? null,
            vatIncluded: order.vatIncluded ?? null,
            vatSumMinor: this.decimal(order.vatSum),
            description: order.description ?? null,
            attributes: order.attributes ?? [],
            documentLinks: [
                ...(order.demands ?? []).map((ref) => ({ type: 'demand', id: this.referenceId(ref) })),
                ...(order.invoicesOut ?? []).map((ref) => ({ type: 'invoiceout', id: this.referenceId(ref) })),
                ...(order.productionTasks ?? []).map((ref) => ({ type: 'productiontask', id: this.referenceId(ref) })),
            ],
            rawJson: order,
            syncedAt,
        };
    }

    private mapPosition(orderId: string, position: CustomerOrderPosition): SalesOrderPositionRecord {
        return {
            orderId,
            id: position.id,
            assortmentId: this.referenceId(position.assortment),
            assortmentType: position.assortment.meta.type ?? null,
            quantity: this.requiredDecimal(position.quantity),
            priceMinor: this.requiredDecimal(position.price),
            discount: this.decimal(position.discount),
            vat: this.decimal(position.vat),
            vatEnabled: position.vatEnabled ?? null,
            reserve: this.decimal(position.reserve),
            rawJson: position,
        };
    }

    private referenceId(reference?: Reference): string | null {
        return reference?.meta.href.split('/').at(-1) ?? null;
    }

    private decimal(value: number | null | undefined): string | null {
        return value == null ? null : this.requiredDecimal(value);
    }

    private requiredDecimal(value: number): string {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new BadGatewayException('МойСклад вернул некорректное числовое значение заказа');
        }

        // Keep source monetary units; converting kopecks to rubles belongs in reports.
        return String(value);
    }
}
