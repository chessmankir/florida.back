import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sales_customer_order_positions')
export class SalesCustomerOrderPosition {
    @PrimaryColumn({ name: 'order_id', type: 'uuid' }) orderId: string;
    @PrimaryColumn('uuid') id: string;
    @Column({ name: 'assortment_id', type: 'uuid', nullable: true }) assortmentId: string | null;
    @Column({ name: 'assortment_type', type: 'varchar', nullable: true }) assortmentType: string | null;
    @Column('numeric') quantity: string;
    @Column({ name: 'price_minor', type: 'numeric', precision: 20, scale: 4 }) priceMinor: string;
    @Column({ type: 'numeric', nullable: true }) discount: string | null;
    @Column({ type: 'numeric', nullable: true }) vat: string | null;
    @Column({ name: 'vat_enabled', type: 'boolean', nullable: true }) vatEnabled: boolean | null;
    @Column({ type: 'numeric', nullable: true }) reserve: string | null;
    @Column({ name: 'raw_json', type: 'jsonb' }) rawJson: unknown;
}
