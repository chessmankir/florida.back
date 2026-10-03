import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('expense_losses')
@Index('idx_expense_losses_moment', ['moment'])
@Index('idx_expense_losses_store', ['storeId'])
@Index('idx_expense_losses_organization', ['organizationId'])
export class ExpenseLoss {
    @PrimaryColumn({
        type: 'uuid',
    })
    id!: string;

    @Column({
        type: 'varchar',
        length: 255,
    })
    name!: string;

    @Column({
        name: 'external_code',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    externalCode!: string | null;

    @Column({
        type: 'text',
        nullable: true,
    })
    description!: string | null;

    @Column({
        type: 'timestamptz',
    })
    moment!: Date;

    @Column({
        name: 'created_at_source',
        type: 'timestamptz',
        nullable: true,
    })
    createdAtSource!: Date | null;

    @Column({
        name: 'source_updated_at',
        type: 'timestamptz',
    })
    sourceUpdatedAt!: Date;

    @Column({
        name: 'is_posted',
        type: 'boolean',
    })
    isPosted!: boolean;

    @Column({
        name: 'sum_minor',
        type: 'numeric',
        precision: 20,
        scale: 4,
    })
    sumMinor!: string;

    @Column({
        name: 'organization_id',
        type: 'uuid',
        nullable: true,
    })
    organizationId!: string | null;

    @Column({
        name: 'store_id',
        type: 'uuid',
        nullable: true,
    })
    storeId!: string | null;

    @Column({
        name: 'owner_id',
        type: 'uuid',
        nullable: true,
    })
    ownerId!: string | null;

    @Column({
        name: 'group_id',
        type: 'uuid',
        nullable: true,
    })
    groupId!: string | null;

    @Column({
        name: 'project_id',
        type: 'uuid',
        nullable: true,
    })
    projectId!: string | null;

    @Column({
        name: 'currency_id',
        type: 'uuid',
        nullable: true,
    })
    currencyId!: string | null;

    @Column({
        name: 'exchange_rate',
        type: 'numeric',
        precision: 20,
        scale: 8,
        nullable: true,
    })
    exchangeRate!: string | null;

    @Column({
        name: 'synced_at',
        type: 'timestamptz',
    })
    syncedAt!: Date;
}
