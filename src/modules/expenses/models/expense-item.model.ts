import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('expense_items')
@Index('idx_expense_items_name', ['name'])
export class ExpenseItem {
    @PrimaryColumn({
        type: 'uuid',
    })
    id!: string;

    @Column({
        type: 'varchar',
        length: 512,
    })
    name!: string;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    code!: string | null;

    @Column({
        type: 'text',
        nullable: true,
    })
    description!: string | null;

    @Column({
        name: 'external_code',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    externalCode!: string | null;

    @Column({
        name: 'is_operating_expense',
        type: 'boolean',
        default: false,
    })
    isOperatingExpense!: boolean;

    @Column({
        name: 'source_updated_at',
        type: 'timestamptz',
    })
    sourceUpdatedAt!: Date;

    @Column({
        name: 'synced_at',
        type: 'timestamptz',
    })
    syncedAt!: Date;
}
