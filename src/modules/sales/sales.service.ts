import { Injectable } from '@nestjs/common';

import type { SalesCustomerOrder } from './models/customerorder.model.js';
import type { SalesCustomerOrderPosition } from './models/customerorder-position.model.js';
import { SalesCustomerOrderSyncService } from './services/sales-customerorder-sync.service.js';
import { SalesRepository } from './sales.repository.js';

@Injectable()
export class SalesService {
    constructor(
        private readonly repository: SalesRepository,
        private readonly customerOrderSync: SalesCustomerOrderSyncService
    ) {}

    public syncAll(): Promise<number> {
        return this.customerOrderSync.syncAll();
    }

    public findOne(id: string): Promise<SalesCustomerOrder | null> {
        return this.repository.findOne(id);
    }

    public findPositions(orderId: string): Promise<SalesCustomerOrderPosition[]> {
        return this.repository.findPositions(orderId);
    }
}
