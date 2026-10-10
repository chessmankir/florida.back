import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('moysklad_inventory_products')
@Index('ix_moysklad_inventory_name', ['name'])
@Index('ix_moysklad_inventory_type_archived', ['productType', 'archived'])
export class MoyskladInventoryProduct {
    @PrimaryColumn({ type: 'uuid' }) id: string;
    @Column({ name: 'product_type', type: 'varchar', length: 32 }) productType: string;
    @Column({ name: 'parent_product_id', type: 'uuid', nullable: true }) parentProductId: string | null;
    @Column({ type: 'varchar', length: 512 }) name: string;
    @Column({ type: 'varchar', length: 255, nullable: true }) code: string | null;
    @Column({ type: 'varchar', length: 255, nullable: true }) article: string | null;
    @Column({ name: 'external_code', type: 'varchar', length: 255, nullable: true }) externalCode: string | null;
    @Column({ name: 'path_name', type: 'varchar', length: 1024, nullable: true }) pathName: string | null;
    @Column({ name: 'uom_name', type: 'varchar', length: 64, nullable: true }) uomName: string | null;
    @Column({ type: 'boolean', nullable: true }) archived: boolean | null;
    @Column({ name: 'buy_price_minor', type: 'numeric', precision: 20, scale: 2, nullable: true }) buyPriceMinor: string | null;
    @Column({ name: 'sale_price_minor', type: 'numeric', precision: 20, scale: 2, nullable: true }) salePriceMinor: string | null;
    @Column({ name: 'minimum_price_minor', type: 'numeric', precision: 20, scale: 2, nullable: true }) minimumPriceMinor: string | null;
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 }) stock: string;
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 }) reserve: string;
    @Column({ name: 'in_transit', type: 'numeric', precision: 20, scale: 4, default: 0 }) inTransit: string;
    @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 }) available: string;
    @Column({ name: 'stock_cost_minor', type: 'numeric', precision: 20, scale: 2, nullable: true }) stockCostMinor: string | null;
    @Column({ name: 'stock_value_minor', type: 'numeric', precision: 20, scale: 2, nullable: true }) stockValueMinor: string | null;
    @Column({ name: 'minimum_balance', type: 'numeric', precision: 20, scale: 4, nullable: true }) minimumBalance: string | null;
    @Column({ name: 'days_on_stock', type: 'numeric', precision: 20, scale: 4, nullable: true }) daysOnStock: string | null;
    @Column({ name: 'source_updated_at', type: 'timestamptz', nullable: true }) sourceUpdatedAt: Date | null;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
