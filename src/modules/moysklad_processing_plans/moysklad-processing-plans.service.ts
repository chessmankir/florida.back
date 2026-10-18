import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountAccessService } from '../auth/account-access.service.js';
import { MoyskladProcessingPlansClient } from './clients/moysklad-processing-plans.client.js';
import { MoyskladProcessingPlansRepository } from './moysklad-processing-plans.repository.js';
import type { MoyskladMetaRef, ProcessingPlanMaterialSnapshot, ProcessingPlanSnapshot, ProcessingPlansSyncResult } from './types/moysklad-processing-plans.types.js';

@Injectable()
export class MoyskladProcessingPlansService {
    private readonly pageSize: number;

    public constructor(
        config: ConfigService,
        private readonly client: MoyskladProcessingPlansClient,
        private readonly repository: MoyskladProcessingPlansRepository,
        private readonly accounts: AccountAccessService
    ) {
        this.pageSize = Math.min(Math.max(config.get<number>('MOYSKLAD_SYNC_PAGE_SIZE', 100), 1), 1000);
    }

    public async syncAll(accountId: string, token?: string): Promise<ProcessingPlansSyncResult> {
        const moyskladToken = token ?? await this.accounts.moyskladToken(accountId);
        const plans: ProcessingPlanSnapshot[] = [];
        for (let offset = 0; ; offset += this.pageSize) {
            const page = await this.client.getPlans(moyskladToken, this.pageSize, offset);
            const syncedAt = new Date();
            for (const row of page.rows) {
                const id = row.id ?? this.idFromMeta(row.meta);
                if (!id || !row.name) continue;
                plans.push({
                    id, name: row.name, code: row.code ?? null, externalCode: row.externalCode ?? null,
                    pathName: row.pathName ?? null, archived: row.archived ?? false,
                    productionCostMinor: Number.isFinite(row.cost) ? String(row.cost) : null,
                    sourceUpdatedAt: row.updated ? this.date(row.updated) : null, syncedAt,
                });
            }
            if (offset + page.rows.length >= page.meta.size || page.rows.length === 0) break;
        }

        await this.repository.savePlans(accountId, plans);
        let materialsCount = 0;
        for (const plan of plans) {
            const materials: ProcessingPlanMaterialSnapshot[] = [];
            for (let offset = 0; ; offset += this.pageSize) {
                const page = await this.client.getMaterials(moyskladToken, plan.id, this.pageSize, offset);
                const syncedAt = new Date();
                for (const row of page.rows) {
                    const id = row.id ?? this.idFromMeta(row.meta);
                    const assortmentMeta = row.assortment?.meta ?? row.product?.meta;
                    const assortmentId = this.idFromMeta(assortmentMeta);
                    if (!id || !assortmentId || !Number.isFinite(row.quantity)) continue;
                    materials.push({
                        id, processingPlanId: plan.id, assortmentId,
                        assortmentType: assortmentMeta?.type ?? 'product',
                        quantity: String(row.quantity), syncedAt,
                    });
                }
                if (offset + page.rows.length >= page.meta.size || page.rows.length === 0) break;
            }
            materialsCount += await this.repository.replaceMaterials(accountId, plan.id, materials);
        }
        await this.repository.deleteMissing(accountId, plans.map((plan) => plan.id));
        return { plans: plans.length, materials: materialsCount };
    }

    public getPlans(accountId: string, query: { page?: string; limit?: string; search?: string }) {
        const page = this.positiveInteger(query.page, 1, 'page');
        const limit = this.positiveInteger(query.limit, 50, 'limit');
        if (limit > 100) throw new BadRequestException('limit не может быть больше 100');
        const search = query.search?.trim() || null;
        if (search && search.length > 200) throw new BadRequestException('search не может быть длиннее 200 символов');
        return this.repository.findPage(accountId, page, limit, search);
    }

    public async getMaterials(accountId: string, planId: string) {
        if (!this.isUuid(planId)) throw new BadRequestException('Некорректный id техкарты');
        const result = await this.repository.findMaterials(accountId, planId);
        if (!result) throw new NotFoundException('Техкарта не найдена');
        return result;
    }

    private idFromMeta(meta: MoyskladMetaRef | undefined): string | null {
        const match = meta?.href?.match(/\/([0-9a-f-]{36})(?:\?|$)/i);
        return match && this.isUuid(match[1]) ? match[1] : null;
    }
    private isUuid(value: string): boolean { return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value); }
    private date(value: string): Date | null { const date = new Date(value.replace(' ', 'T') + (value.includes('Z') || /[+-]\d\d:\d\d$/.test(value) ? '' : '+03:00')); return Number.isNaN(date.getTime()) ? null : date; }
    private positiveInteger(value: string | undefined, fallback: number, field: string): number {
        if (value === undefined) return fallback;
        if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw new BadRequestException(`${field} должен быть положительным целым числом`);
        return Number(value);
    }
}
