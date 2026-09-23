import { Entity, Index } from 'typeorm';

import { ExpenseDocumentBase } from './expense-document.base.js';

@Entity('expense_cash_outs')
@Index('idx_expense_cash_outs_moment', ['moment'])
@Index('idx_expense_cash_outs_item', ['expenseItemId'])
@Index('idx_expense_cash_outs_organization', ['organizationId'])
export class CashOut extends ExpenseDocumentBase {}
