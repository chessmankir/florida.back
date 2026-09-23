import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_profit_daily')
@Index('idx_product_profit_daily_period', ['periodDate'])
@Index('idx_product_profit_daily_product', ['productId'])
@Index('idx_product_profit_daily_period_product', ['periodDate', 'productId'])
export class ProductProfit {
    @PrimaryColumn({
        name: 'product_id',
        type: 'uuid',
    })
    productId!: string;

    @PrimaryColumn({
        name: 'period_date',
        type: 'date',
    })
    periodDate!: string;

    @Column({
        name: 'product_type',
        type: 'varchar',
        length: 32,
    })
    productType!: string;

    @Column({
        name: 'name',
        type: 'varchar',
        length: 512,
    })
    name!: string;

    @Column({
        name: 'code',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    code!: string | null;

    @Column({
        name: 'article',
        type: 'varchar',
        length: 255,
        nullable: true,
    })
    article!: string | null;

    @Column({
        name: 'sell_quantity',
        type: 'numeric',
        precision: 20,
        scale: 4,
        default: 0,
    })
    sellQuantity!: string;

    @Column({
        name: 'sell_sum_minor',
        type: 'numeric',
        precision: 20,
        scale: 2,
        default: 0,
    })
    sellSumMinor!: string;

    @Column({
        name: 'sell_cost_sum_minor',
        type: 'numeric',
        precision: 20,
        scale: 2,
        default: 0,
    })
    sellCostSumMinor!: string;

    @Column({
        name: 'return_quantity',
        type: 'numeric',
        precision: 20,
        scale: 4,
        default: 0,
    })
    returnQuantity!: string;

    @Column({
        name: 'return_sum_minor',
        type: 'numeric',
        precision: 20,
        scale: 2,
        default: 0,
    })
    returnSumMinor!: string;

    @Column({
        name: 'return_cost_sum_minor',
        type: 'numeric',
        precision: 20,
        scale: 2,
        default: 0,
    })
    returnCostSumMinor!: string;

    @Column({
        name: 'profit_minor',
        type: 'numeric',
        precision: 20,
        scale: 2,
        default: 0,
    })
    profitMinor!: string;

    @Column({
        name: 'margin_percent',
        type: 'numeric',
        precision: 12,
        scale: 4,
        default: 0,
    })
    marginPercent!: string;

    @Column({
        name: 'synced_at',
        type: 'timestamptz',
    })
    syncedAt!: Date;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz',
    })
    createdAt!: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'timestamptz',
    })
    updatedAt!: Date;
}
