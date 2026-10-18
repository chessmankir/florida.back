import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { AccountOwnedEntity } from '../../auth/models/account-owned.model.js';
import { MoyskladProcessingPlanMaterial } from './moysklad-processing-plan-material.model.js';

@Entity('moysklad_processing_plans')
@Index('moysklad_processing_plans_account_name_idx', ['accountId', 'name'])
export class MoyskladProcessingPlan extends AccountOwnedEntity {
    @PrimaryColumn({ type: 'uuid' }) id!: string;
    @Column({ type: 'varchar', length: 512 }) name!: string;
    @Column({ type: 'varchar', length: 255, nullable: true }) code!: string | null;
    @Column({ name: 'external_code', type: 'varchar', length: 255, nullable: true }) externalCode!: string | null;
    @Column({ name: 'path_name', type: 'varchar', length: 1024, nullable: true }) pathName!: string | null;
    @Column({ type: 'boolean', default: false }) archived!: boolean;
    @Column({ name: 'production_cost_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) productionCostMinor!: string | null;
    @Column({ name: 'source_updated_at', type: 'timestamptz', nullable: true }) sourceUpdatedAt!: Date | null;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt!: Date;

    @OneToMany(() => MoyskladProcessingPlanMaterial, (material) => material.processingPlan)
    materials?: Relation<MoyskladProcessingPlanMaterial[]>;
}
