import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { SyncResult, SyncScope } from './types/synchronization.types.js';

@Injectable()
export class SynchronizationRepository {
    constructor(@InjectDataSource('seller') private readonly database: DataSource) {}

    public async withLock(scope: SyncScope, work: () => Promise<SyncResult>): Promise<SyncResult | null> {
        const runner = this.database.createQueryRunner();
        let locked = false;
        const runId = randomUUID();
        try {
            await runner.connect();
            const rows: { locked: boolean }[] = await runner.query('SELECT pg_try_advisory_lock(19770421, 1) AS locked');
            locked = rows[0].locked;
            if (!locked) return null;
            // Acquiring the lock proves no previous compliant worker still owns a run.
            await runner.query("UPDATE synchronization_runs SET status = 'interrupted', finished_at = now() WHERE status = 'running'");
            await runner.query("INSERT INTO synchronization_runs(id, scope, status) VALUES ($1, $2, 'running')", [runId, scope]);
            try {
                const result = await work();
                await runner.query(
                    'UPDATE synchronization_runs SET status = $2, finished_at = now(), counts = $3::jsonb, errors = $4::jsonb WHERE id = $1',
                    [
                        runId,
                        Object.keys(result.errors).length ? 'failed' : 'completed',
                        JSON.stringify(result.counts),
                        JSON.stringify(result.errors),
                    ]
                );
                return result;
            } catch (error) {
                await runner.query("UPDATE synchronization_runs SET status = 'failed', finished_at = now() WHERE id = $1", [runId]);
                throw error;
            }
        } finally {
            try {
                if (locked) await runner.query('SELECT pg_advisory_unlock(19770421, 1)');
            } finally {
                await runner.release();
            }
        }
    }
}
