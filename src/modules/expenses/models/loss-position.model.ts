import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('expense_loss_positions')
@Index('idx_expense_loss_positions_loss', ['lossId'])
@Index('idx_expense_loss_positions_assortment', ['assortmentId'])
export class ExpenseLossPosition {
    @PrimaryColumn({
        name: 'loss_id',
        type: 'uuid',
    })
    lossId!: string;

    @PrimaryColumn({
        type: 'uuid',
    })
    id!: string;

    @Column({
        name: 'assortment_id',
        type: 'uuid',
        nullable: true,
    })
    assortmentId!: string | null;

    @Column({
        name: 'assortment_type',
        type: 'varchar',
        length: 64,
        nullable: true,
    })
    assortmentType!: string | null;

    @Column({
        type: 'numeric',
        precision: 20,
        scale: 4,
    })
    quantity!: string;

    @Column({
        name: 'price_minor',
        type: 'numeric',
        precision: 20,
        scale: 4,
    })
    priceMinor!: string;

    @Column({
        name: 'total_minor',
        type: 'numeric',
        precision: 20,
        scale: 4,
    })
    totalMinor!: string;

    @Column({
        type: 'numeric',
        precision: 10,
        scale: 4,
        nullable: true,
    })
    vat!: string | null;

    @Column({
        name: 'vat_enabled',
        type: 'boolean',
        nullable: true,
    })
    vatEnabled!: boolean | null;
}
