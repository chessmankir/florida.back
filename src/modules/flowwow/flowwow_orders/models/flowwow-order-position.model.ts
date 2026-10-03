import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('flowwow_order_positions')
@Index('ix_flowwow_order_positions_product', ['productId'])
export class FlowwowOrderPosition {
    @PrimaryColumn({ name: 'shop_id', type: 'integer' }) shopId: number;
    @PrimaryColumn({ name: 'order_id', type: 'integer' }) orderId: number;
    @PrimaryColumn({ name: 'line_index', type: 'integer' }) lineIndex: number;
    @Column({ name: 'product_id', type: 'integer', nullable: true }) productId: number | null;
    @Column({ name: 'offer_id', type: 'varchar', nullable: true }) offerId: string | null;
    @Column({ name: 'product_type', type: 'smallint', nullable: true }) productType: number | null;
    @Column({ name: 'category_id', type: 'integer', nullable: true }) categoryId: number | null;
    @Column({ name: 'subcategory_id', type: 'integer', nullable: true }) subcategoryId: number | null;
    @Column('text') name: string;
    @Column('integer') quantity: number;
    @Column({ name: 'cost_amount', type: 'numeric', precision: 20, scale: 2 }) costAmount: string;
    @Column({ name: 'base_amount', type: 'numeric', precision: 20, scale: 2, default: 0 }) baseAmount: string;
    @Column({ name: 'actual_amount', type: 'numeric', precision: 20, scale: 2, default: 0 }) actualAmount: string;
    @Column({ name: 'discount_amount', type: 'numeric', precision: 20, scale: 2, default: 0 }) discountAmount: string;
    @Column({ name: 'price_after_discount_amount', type: 'numeric', precision: 20, scale: 2, default: 0 })
    priceAfterDiscountAmount: string;
    @Column({ name: 'catalog_price_amount', type: 'numeric', precision: 20, scale: 2, nullable: true }) catalogPriceAmount: string | null;
    @Column({ name: 'discount_percent', type: 'numeric', precision: 10, scale: 4, nullable: true }) discountPercent: string | null;
    @Column({ name: 'currency_code', type: 'varchar', length: 3, nullable: true }) currencyCode: string | null;
    @Column({ name: 'raw_json', type: 'jsonb' }) rawJson: unknown;
}
