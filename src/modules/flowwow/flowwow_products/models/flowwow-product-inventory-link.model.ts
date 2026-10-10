import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('flowwow_product_inventory_links')
@Index('ix_flowwow_product_inventory_links_moysklad', ['bundleId'])
export class FlowwowProductInventoryLink {
    @PrimaryColumn({ name: 'shop_id', type: 'integer' }) shopId: number;
    @PrimaryColumn({ name: 'flowwow_product_id', type: 'integer' }) flowwowProductId: number;
    @PrimaryColumn({ name: 'moysklad_product_id', type: 'uuid' }) bundleId: string;
    @Column({ type: 'integer', default: 1 }) quantity: number;
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
