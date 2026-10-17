import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import type { SyncResult, SyncScope } from './types/synchronization.types.js';
import { SynchronizationRun } from './models/synchronization-run.model.js';

@Injectable()
export class SynchronizationRepository {
    constructor(
        @InjectDataSource('florida') private readonly database: DataSource,
        @InjectRepository(SynchronizationRun, 'florida')
        private readonly runs: Repository<SynchronizationRun>
    ) {}

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
            await this.runs.insert({
                id: runId,
                scope,
                status: 'running',
                finishedAt: null,
                counts: {},
                errors: [],
            });
            try {
                const result = await work();
                await this.runs.update(runId, {
                    status: Object.keys(result.errors).length ? 'failed' : 'completed',
                    finishedAt: new Date(),
                    counts: result.counts,
                    errors: result.errors,
                });
                return result;
            } catch (error) {
                await this.runs.update(runId, { status: 'failed', finishedAt: new Date() });
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
