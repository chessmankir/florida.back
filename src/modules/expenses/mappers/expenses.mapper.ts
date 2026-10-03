import { BadGatewayException } from '@nestjs/common';

import { CashOut } from '../models/cash-out.model.js';
import { ExpenseDocumentBase } from '../models/expense-document.base.js';
import { ExpenseItem } from '../models/expense-item.model.js';
import { PaymentOut } from '../models/payment-out.model.js';

import type {
    ExpenseDocumentRemote,
    ExpenseItemRemote,
    ExpenseReference,
    LossPositionRemote,
    LossRemote,
} from '../types/expenses.types.js';
import { ExpenseLossPosition } from '../models/loss-position.model.js';
import { ExpenseLoss } from '../models/loss.model.js';

export class ExpensesMapper {
    public static toExpenseItem(source: ExpenseItemRemote, syncedAt: Date): ExpenseItem {
        return {
            id: source.id,
            name: source.name,
            code: source.code ?? null,
            description: source.description ?? null,
            externalCode: source.externalCode ?? null,
            isOperatingExpense: source.operatingExpenses ?? false,
            sourceUpdatedAt: this.parseDate(source.updated),
            syncedAt,
        };
    }

    public static toPaymentOut(source: ExpenseDocumentRemote, syncedAt: Date): PaymentOut {
        return {
            ...this.mapDocument(source, syncedAt),
            organizationAccountId: this.referenceId(source.organizationAccount),
        };
    }

    public static toCashOut(source: ExpenseDocumentRemote, syncedAt: Date): CashOut {
        return {
            ...this.mapDocument(source, syncedAt),
        };
    }

    private static mapDocument(source: ExpenseDocumentRemote, syncedAt: Date): ExpenseDocumentBase {
        return {
            id: source.id,
            name: source.name,
            externalCode: source.externalCode ?? null,
            description: source.description ?? null,

            moment: this.parseDate(source.moment),
            createdAtSource: source.created ? this.parseDate(source.created) : null,
            sourceUpdatedAt: this.parseDate(source.updated),

            isPosted: source.applicable,

            sumMinor: String(source.sum ?? 0),
            vatSumMinor: source.vatSum === undefined ? null : String(source.vatSum),

            expenseItemId: this.referenceId(source.expenseItem),
            organizationId: this.referenceId(source.organization),
            agentId: this.referenceId(source.agent),
            agentType: source.agent?.meta.type ?? null,
            ownerId: this.referenceId(source.owner),
            groupId: this.referenceId(source.group),
            projectId: this.referenceId(source.project),

            currencyId: this.referenceId(source.rate?.currency),
            exchangeRate: source.rate?.value === undefined ? null : String(source.rate.value),

            syncedAt,
        };
    }

    private static referenceId(reference?: ExpenseReference): string | null {
        if (!reference?.meta.href) {
            return null;
        }

        return reference.meta.href.split('/').filter(Boolean).at(-1) ?? null;
    }

    /**
     * Даты МойСклад приходят в московском времени
     * без указания часового пояса.
     */
    private static parseDate(value: string): Date {
        const hasTimeZone = /Z$|[+-]\d{2}:\d{2}$/.test(value);

        const normalized = hasTimeZone ? value.replace(' ', 'T') : `${value.replace(' ', 'T')}+03:00`;

        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) {
            throw new BadGatewayException(`МойСклад вернул некорректную дату: ${value}`);
        }

        return date;
    }

    public static toLoss(
        source: LossRemote,
        syncedAt: Date,
    ): ExpenseLoss {
        return {
            id: source.id,
            name: source.name,

            externalCode:
                source.externalCode ?? null,

            description:
                source.description ?? null,

            moment:
                this.parseDate(source.moment),

            createdAtSource:
                source.created
                    ? this.parseDate(source.created)
                    : null,

            sourceUpdatedAt:
                this.parseDate(source.updated),

            isPosted:
            source.applicable,

            sumMinor:
                String(source.sum ?? 0),

            organizationId:
                this.referenceId(
                    source.organization,
                ),

            storeId:
                this.referenceId(
                    source.store,
                ),

            ownerId:
                this.referenceId(
                    source.owner,
                ),

            groupId:
                this.referenceId(
                    source.group,
                ),

            projectId:
                this.referenceId(
                    source.project,
                ),

            currencyId:
                this.referenceId(
                    source.rate?.currency,
                ),

            exchangeRate:
                source.rate?.value === undefined
                    ? null
                    : String(source.rate.value),

            syncedAt,
        };
    }

    public static toLossPosition(
        source: LossPositionRemote,
        lossId: string,
    ): ExpenseLossPosition {
        const quantity =
            source.quantity ?? 0;

        const price =
            source.price ?? 0;

        return {
            lossId,
            id: source.id,

            assortmentId:
                this.referenceId(
                    source.assortment,
                ),

            assortmentType:
                source.assortment.meta.type ??
                null,

            quantity:
                String(quantity),

            priceMinor:
                String(price),

            totalMinor:
                String(quantity * price),

            vat:
                source.vat === undefined
                    ? null
                    : String(source.vat),

            vatEnabled:
                source.vatEnabled ?? null,
        };
    }
}
