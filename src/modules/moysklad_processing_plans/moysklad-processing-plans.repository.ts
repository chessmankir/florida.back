import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { MoyskladProcessingPlan } from './models/moysklad-processing-plan.model.js';
import { MoyskladProcessingPlanMaterial } from './models/moysklad-processing-plan-material.model.js';
import type { ProcessingPlanMaterialSnapshot, ProcessingPlanSnapshot } from './types/moysklad-processing-plans.types.js';

@Injectable()
export class MoyskladProcessingPlansRepository {
    public constructor(
        @InjectRepository(MoyskladProcessingPlan, 'florida') private readonly plans: Repository<MoyskladProcessingPlan>,
        @InjectRepository(MoyskladProcessingPlanMaterial, 'florida') private readonly materials: Repository<MoyskladProcessingPlanMaterial>
    ) {}

    public async savePlans(accountId: string, rows: ProcessingPlanSnapshot[]): Promise<number> {
        if (rows.length) await this.plans.upsert(rows.map((row) => ({ ...row, accountId })), ['id']);
        return rows.length;
    }

    public async replaceMaterials(accountId: string, planId: string, rows: ProcessingPlanMaterialSnapshot[]): Promise<number> {
        await this.plans.manager.transaction(async (manager) => {
            await manager.delete(MoyskladProcessingPlanMaterial, { accountId, processingPlanId: planId });
            if (rows.length) await manager.insert(MoyskladProcessingPlanMaterial, rows.map((row) => ({ ...row, accountId })));
        });
        return rows.length;
    }

    public async deleteMissing(accountId: string, ids: string[]): Promise<void> {
        if (!ids.length) { await this.plans.delete({ accountId }); return; }
        const obsolete = await this.plans.find({ select: { id: true }, where: { accountId } });
        const keep = new Set(ids);
        const remove = obsolete.map((row) => row.id).filter((id) => !keep.has(id));
        if (remove.length) await this.plans.delete({ accountId, id: In(remove) });
    }

    public async findPage(accountId: string, page: number, limit: number, search: string | null) {
        const query = this.plans.createQueryBuilder('plan')
            .where('plan.accountId = :accountId', { accountId })
            .andWhere('plan.archived = :archived', { archived: false });
        if (search) {
            search.split(/\s+/).filter(Boolean).forEach((term, index) => {
                query.andWhere(`(plan.name ILIKE :search${index} OR plan.code ILIKE :search${index})`, {
                    [`search${index}`]: `%${term}%`,
                });
            });
        }
        query.orderBy('plan.name', 'ASC').addOrderBy('plan.id', 'ASC').skip((page - 1) * limit).take(limit);
        const [items, total] = await query.getManyAndCount();
        return { items, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } };
    }

    public async findMaterials(accountId: string, planId: string) {
        const plan = await this.plans.findOneBy({ accountId, id: planId });
        if (!plan) return null;
        const items = await this.plans.query(`
            SELECT material.id::text AS "componentId", material.assortment_id::text AS "assortmentId",
                   material.assortment_type AS "assortmentType", COALESCE(inventory.name, 'Материал без названия') AS name,
                   inventory.code, inventory.article, material.quantity::text AS quantity,
                   COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor)::text AS "unitCostMinor",
                   (material.quantity * COALESCE(inventory.stock_cost_minor, inventory.buy_price_minor, 0))::text AS "totalCostMinor",
                   COALESCE(inventory.available, 0)::text AS available
            FROM moysklad_processing_plan_materials material
            LEFT JOIN moysklad_inventory_products inventory
              ON inventory.account_id = material.account_id AND inventory.id = material.assortment_id
            WHERE material.account_id = $1::uuid AND material.processing_plan_id = $2::uuid
            ORDER BY inventory.name ASC NULLS LAST, material.id ASC
        `, [accountId, planId]);
        const totalCostMinor = items.reduce((sum: number, item: { totalCostMinor?: string }) => sum + Number(item.totalCostMinor ?? 0), 0);
        return { plan, items, totalCostMinor: String(totalCostMinor) };
    }
}
