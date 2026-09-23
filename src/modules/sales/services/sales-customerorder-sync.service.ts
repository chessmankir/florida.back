import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CustomerOrderClient } from '../clients/customerorder.client.js';
import { CustomerOrderMapper } from '../mappers/customerorder.mapper.js';
import { SalesRepository } from '../sales.repository.js';
import type { CustomerOrder, CustomerOrderPosition } from '../types/customerorder.types.js';
import type { SalesOrderSnapshot } from '../types/sales.types.js';

@Injectable()
export class SalesCustomerOrderSyncService {
    private readonly logger = new Logger(SalesCustomerOrderSyncService.name);
    private readonly pageSize: number;

    constructor(
        config: ConfigService,
        private readonly client: CustomerOrderClient,
        private readonly mapper: CustomerOrderMapper,
        private readonly repository: SalesRepository
    ) {
        this.pageSize = config.get<number>('MOYSKLAD_SYNC_PAGE_SIZE', 100);
    }

    public async syncAll(): Promise<number> {
        let offset = 0;

        while (true) {
            const page = await this.client.getOrders({ limit: this.pageSize, offset });
            const snapshots: SalesOrderSnapshot[] = [];
            const syncedAt = new Date();

            for (const order of page.rows) {
                const positions = await this.loadPositions(order);
                snapshots.push(this.mapper.mapSnapshot(order, positions, syncedAt));
            }

            await this.repository.saveChunk(snapshots);
            offset += page.rows.length;
            this.logger.log({ event: 'customerorder_chunk_saved', saved: offset, total: page.meta.size });

            if (offset >= page.meta.size) return offset;
        }
    }

    private async loadPositions(order: CustomerOrder): Promise<CustomerOrderPosition[]> {
        const expected = order.positions?.meta.size;

        if (!Number.isInteger(expected) || expected < 0) {
            throw new BadGatewayException('МойСклад: отсутствуют метаданные позиций заказа ' + order.id);
        }

        if (order.positions.rows?.length === expected) {
            this.validatePositions(order.id, order.positions.rows, expected);
            return order.positions.rows;
        }

        // Expanded collections may be truncated; reload them from their own endpoint.
        const positions: CustomerOrderPosition[] = [];
        let offset = 0;

        while (true) {
            const page = await this.client.getPositions(order.id, { limit: 1000, offset });
            positions.push(...page.rows);
            offset += page.rows.length;

            if (offset >= page.meta.size) break;
        }

        this.validatePositions(order.id, positions, expected);
        return positions;
    }

    private validatePositions(orderId: string, positions: CustomerOrderPosition[], expected: number): void {
        if (positions.length !== expected || new Set(positions.map((position) => position.id)).size !== positions.length) {
            throw new BadGatewayException('Состав заказа изменился во время загрузки: ' + orderId + '. Нужен повторный запуск.');
        }
    }
}
