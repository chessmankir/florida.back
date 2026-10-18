import { AccountOwnedEntity } from '../../auth/models/account-owned.model.js';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('synchronization_runs')
@Index('synchronization_runs_started_idx', ['startedAt'])
export class SynchronizationRun extends AccountOwnedEntity {
    @PrimaryColumn({ type: 'uuid' })
    id!: string;

    @Column({ type: 'varchar', length: 64, nullable: true })
    scope!: string | null;

    @Column({ type: 'varchar', length: 16 })
    status!: string;

    @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
    startedAt!: Date;

    @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
    finishedAt!: Date | null;

    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    counts!: Record<string, number>;

    @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
    errors!: string[];
}

