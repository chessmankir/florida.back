import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FlowwowShop } from './models/flowwow-shop.model.js';
import type { FlowwowShopSnapshot } from './types/flowwow-orders.types.js';

@Injectable()
export class FlowwowShopsRepository {
    public constructor(
        @InjectRepository(FlowwowShop, 'florida') private readonly shops: Repository<FlowwowShop>
    ) {}

    public async saveChunk(accountId: string, shops: FlowwowShopSnapshot[]): Promise<void> {
        if (shops.length === 0) return;
        await this.shops.upsert(shops.map((shop) => ({ ...shop, accountId })), ['shopId']);
    }

    public async findActiveShopIds(accountId: string): Promise<number[]> {
        const shops = await this.shops.find({
            select: { shopId: true },
            where: { status: 'active', accountId },
            order: { shopId: 'ASC' },
        });
        return shops.map((shop) => shop.shopId);
    }

    public exists(accountId: string, shopId: number): Promise<boolean> {
        return this.shops.existsBy({ accountId, shopId });
    }

    public async findActiveShops(accountId: string): Promise<Array<{ shopId: number; name: string; address: string | null }>> {
        return this.shops.find({
            select: { shopId: true, name: true, address: true },
            where: { status: 'active', accountId },
            order: { shopId: 'ASC' },
        });
    }
}

