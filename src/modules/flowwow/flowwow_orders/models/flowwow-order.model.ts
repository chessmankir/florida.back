import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('flowwow_orders')
@Index('ix_flowwow_orders_delivery_from', ['deliveryDateFrom'])
@Index('ix_flowwow_orders_status', ['status'])
@Index('ix_flowwow_orders_created_at_source', ['createdAtSource'])
@Index('ix_flowwow_orders_shop_created_at_source', ['shopId', 'createdAtSource'])
export class FlowwowOrder {
    @PrimaryColumn({ name: 'shop_id', type: 'integer' }) shopId: number;
    @PrimaryColumn({ name: 'order_id', type: 'integer' }) orderId: number;
    @Column('smallint') status: number;
    @Column({ name: 'delivery_type', type: 'smallint' }) deliveryType: number;
    @Column({ name: 'delivery_time_type', type: 'smallint' }) deliveryTimeType: number;
    @Column({ name: 'created_at_source', type: 'timestamptz' }) createdAtSource: Date;
    @Column({ name: 'delivery_date_from', type: 'timestamptz' }) deliveryDateFrom: Date;
    @Column({ name: 'delivery_date_to', type: 'timestamptz' }) deliveryDateTo: Date;
    @Column({ name: 'gross_product_amount', type: 'numeric', precision: 20, scale: 2 }) grossProductAmount: string;
    @Column({ name: 'customer_paid_amount', type: 'numeric', precision: 20, scale: 2, nullable: true })
    customerPaidAmount?: string | null;
    @Column({ name: 'bonus_amount', type: 'numeric', precision: 20, scale: 2, nullable: true })
    bonusAmount?: string | null;
    @Column({ name: 'fixed_commission_amount', type: 'numeric', precision: 20, scale: 2, nullable: true })
    fixedCommissionAmount?: string | null;
    @Column({ name: 'variable_commission_amount', type: 'numeric', precision: 20, scale: 2, nullable: true })
    variableCommissionAmount?: string | null;
    @Column({ name: 'source_host', type: 'varchar', nullable: true }) sourceHost: string | null;
    @Column({ name: 'raw_json', type: 'jsonb' }) rawJson: unknown;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
}
