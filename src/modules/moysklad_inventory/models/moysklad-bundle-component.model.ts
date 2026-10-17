import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('moysklad_bundle_components')
@Index('ix_moysklad_bundle_components_assortment', ['assortmentId'])
export class MoyskladBundleComponent {
    @PrimaryColumn({ name: 'bundle_id', type: 'uuid' }) bundleId: string;
    @PrimaryColumn({ name: 'component_id', type: 'uuid' }) componentId: string;
    @Column({ name: 'assortment_id', type: 'uuid' }) assortmentId: string;
    @Column({ name: 'assortment_type', type: 'varchar', length: 32 }) assortmentType: string;
    @Column({ type: 'numeric', precision: 20, scale: 4 }) quantity: string;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
}
