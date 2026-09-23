import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';

import { SalesCustomerOrder } from './models/customerorder.model.js';
import { SalesCustomerOrderPosition } from './models/customerorder-position.model.js';
import type { SalesOrderSnapshot } from './types/sales.types.js';

@Injectable()
export class SalesRepository {
    private readonly batchSize = 100;

    constructor(@InjectDataSource('seller') private readonly database: DataSource) {}

    public async saveChunk(snapshots: SalesOrderSnapshot[]): Promise<void> {
        if (snapshots.length === 0) return;

        const orders = snapshots.map((snapshot) => snapshot.order);
        const positions = snapshots.flatMap((snapshot) => snapshot.positions);

        // Replacing positions and updating orders must commit together.
        await this.database.transaction(async (manager) => {
            for (let offset = 0; offset < orders.length; offset += this.batchSize) {
                await manager.upsert(SalesCustomerOrder, orders.slice(offset, offset + this.batchSize), ['id']);
            }

            await manager.delete(SalesCustomerOrderPosition, { orderId: In(orders.map((order) => order.id)) });

            for (let offset = 0; offset < positions.length; offset += this.batchSize) {
                await manager.insert(SalesCustomerOrderPosition, positions.slice(offset, offset + this.batchSize));
            }
        });
    }

    public findOne(id: string): Promise<SalesCustomerOrder | null> {
        return this.database.getRepository(SalesCustomerOrder).findOneBy({ id });
    }

    public findPositions(orderId: string): Promise<SalesCustomerOrderPosition[]> {
        return this.database.getRepository(SalesCustomerOrderPosition).find({
            where: { orderId },
            order: { id: 'ASC' },
        });
    }
}
