import { Injectable, Logger } from '@nestjs/common';

import { FlowwowOrdersClient } from './clients/flowwow-orders.client.js';
import { FlowwowShopsRepository } from './flowwow-shops.repository.js';
import { FlowwowShopsMapper } from './mappers/flowwow-shops.mapper.js';
import { FLOWWOW_SHOP_STATUSES } from './types/flowwow-orders.types.js';

export interface FlowwowShopsSyncResult {
    saved: number;
    activeShopIds: number[];
}

@Injectable()
export class FlowwowShopsService {
    private readonly logger = new Logger(FlowwowShopsService.name);
    private readonly pageSize = 50;

    public constructor(
        private readonly client: FlowwowOrdersClient,
        private readonly mapper: FlowwowShopsMapper,
        private readonly repository: FlowwowShopsRepository
    ) {}

    public async syncAll(): Promise<FlowwowShopsSyncResult> {
        let saved = 0;

        for (const status of FLOWWOW_SHOP_STATUSES) {
            let received = 0;
            for (let page = 0; ; page++) {
                const response = await this.client.getShops({ status, page, limit: this.pageSize });
                const syncedAt = new Date();
                await this.repository.saveChunk(response.shops.map((shop) => this.mapper.mapSnapshot(shop, syncedAt)));
                received += response.shops.length;
                saved += response.shops.length;
                this.logger.log({ event: 'flowwow_shops_chunk_saved', status, received, total: response.total });
                if (received >= response.total) break;
            }
        }

        return { saved, activeShopIds: await this.repository.findActiveShopIds() };
    }

    public findActiveShops(): Promise<Array<{ shopId: number; name: string; address: string | null }>> {
        return this.repository.findActiveShops();
    }
}
