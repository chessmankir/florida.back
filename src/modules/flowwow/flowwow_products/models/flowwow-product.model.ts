import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('flowwow_products')
@Index('ix_flowwow_products_shop_active', ['shopId', 'isActive'])
@Index('ix_flowwow_products_shop_archived', ['shopId', 'isArchived'])
@Index('ix_flowwow_products_shop_category', ['shopId', 'categoryId'])
export class FlowwowProduct {
    @PrimaryColumn({ name: 'shop_id', type: 'integer' }) shopId: number;
    @PrimaryColumn({ name: 'product_id', type: 'integer' }) productId: number;
    @Column({ name: 'offer_id', type: 'varchar', length: 50, nullable: true }) offerId: string | null;
    @Column({ name: 'is_active', type: 'boolean' }) isActive: boolean;
    @Column({ name: 'is_archived', type: 'boolean' }) isArchived: boolean;
    @Column({ name: 'product_type', type: 'smallint' }) type: number;
    @Column({ name: 'category_id', type: 'integer' }) categoryId: number;
    @Column({ name: 'subcategory_id', type: 'integer' }) subCategoryId: number;
    @Column({ type: 'varchar', length: 500 }) name: string;
    @Column({ type: 'text', nullable: true }) description: string | null;
    @Column({ type: 'text' }) url: string;
    @Column({ type: 'integer' }) available: number;
    @Column({ type: 'integer' }) stock: number;
    @Column({ name: 'min_order', type: 'integer' }) minOrder: number;
    @Column({ type: 'numeric', precision: 20, scale: 2 }) price: string;
    @Column({ type: 'numeric', precision: 10, scale: 4 }) discount: string;
    @Column({ name: 'currency_code', type: 'varchar', length: 3 }) currencyCode: string;
    @Column({ type: 'jsonb' }) images: string[];
    @Column({ name: 'production_time', type: 'integer' }) productionTime: number;
    @Column({ name: 'shipment_time', type: 'integer' }) shipmentTime: number;
    @Column({ name: 'can_rent', type: 'smallint' }) canRent: number;
    @Column({ name: 'original_id', type: 'integer' }) originalId: number;
    @Column({ name: 'is_delivery_post', type: 'boolean' }) isDeliveryPost: boolean;
    @Column({ name: 'is_starred', type: 'boolean' }) isStarred: boolean;
    @Column({ type: 'varchar', length: 32 }) vat: string;
    @Column({ type: 'jsonb', nullable: true }) stats: Record<string, unknown> | null;
    @Column({ type: 'jsonb', nullable: true }) properties: Record<string, unknown> | null;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
}
