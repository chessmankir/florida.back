import { Column, Entity, Index } from 'typeorm';

import { ExpenseDocumentBase } from './expense-document.base.js';

@Entity('expense_payment_outs')
@Index('idx_expense_payment_outs_moment', ['moment'])
@Index('idx_expense_payment_outs_item', ['expenseItemId'])
@Index('idx_expense_payment_outs_organization', ['organizationId'])
export class PaymentOut extends ExpenseDocumentBase {
    @Column({
        name: 'organization_account_id',
        type: 'uuid',
        nullable: true,
    })
    organizationAccountId!: string | null;
}
