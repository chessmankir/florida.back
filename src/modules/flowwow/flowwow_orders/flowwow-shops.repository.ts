import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FlowwowShop } from './models/flowwow-shop.model.js';
import type { FlowwowShopSnapshot } from './types/flowwow-orders.types.js';

@Injectable()
export class FlowwowShopsRepository {
    public constructor(
        @InjectRepository(FlowwowShop, 'seller') private readonly shops: Repository<FlowwowShop>
    ) {}

    public async saveChunk(shops: FlowwowShopSnapshot[]): Promise<void> {
        if (shops.length === 0) return;
        await this.shops.upsert(shops, ['shopId']);
    }

    public async findActiveShopIds(): Promise<number[]> {
        const shops = await this.shops.find({
            select: { shopId: true },
            where: { status: 'active' },
            order: { shopId: 'ASC' },
        });
        return shops.map((shop) => shop.shopId);
    }
}
