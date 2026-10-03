import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { FlowwowShopStatus } from '../types/flowwow-orders.types.js';

@Entity('flowwow_shops')
@Index('ix_flowwow_shops_status', ['status'])
export class FlowwowShop {
    @PrimaryColumn({ name: 'shop_id', type: 'integer' }) shopId: number;
    @Column({ type: 'text' }) name: string;
    @Column({ type: 'varchar', length: 16 }) status: FlowwowShopStatus;
    @Column({ type: 'text', nullable: true }) address: string | null;
    @Column({ type: 'varchar', length: 8, nullable: true }) currency: string | null;
    @Column({ name: 'is_verified', type: 'boolean', nullable: true }) isVerified: boolean | null;
    @Column({ name: 'working_days', type: 'jsonb' }) workingDays: string[];
    @Column({ name: 'raw_json', type: 'jsonb' }) rawJson: unknown;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
}
