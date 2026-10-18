import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AccountOwnedEntity } from '../../auth/models/account-owned.model.js';
import { MoyskladProcessingPlan } from './moysklad-processing-plan.model.js';

@Entity('moysklad_processing_plan_materials')
@Index('moysklad_processing_plan_materials_plan_idx', ['accountId', 'processingPlanId'])
@Index('moysklad_processing_plan_materials_assortment_idx', ['accountId', 'assortmentId'])
export class MoyskladProcessingPlanMaterial extends AccountOwnedEntity {
    @PrimaryColumn({ type: 'uuid' }) id!: string;
    @Column({ name: 'processing_plan_id', type: 'uuid' }) processingPlanId!: string;
    @Column({ name: 'assortment_id', type: 'uuid' }) assortmentId!: string;
    @Column({ name: 'assortment_type', type: 'varchar', length: 64 }) assortmentType!: string;
    @Column({ type: 'numeric', precision: 20, scale: 6 }) quantity!: string;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt!: Date;

    @ManyToOne(() => MoyskladProcessingPlan, (plan) => plan.materials, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'processing_plan_id' })
    processingPlan?: Relation<MoyskladProcessingPlan>;
}
