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

    public syncAll(accountId: string, token: string): Promise<number> {
        return this.customerOrderSync.syncAll(accountId, token);
    }

    public findOne(accountId: string, id: string): Promise<SalesCustomerOrder | null> {
        return this.repository.findOne(accountId, id);
    }

    public findPositions(accountId: string, orderId: string): Promise<SalesCustomerOrderPosition[]> {
        return this.repository.findPositions(accountId, orderId);
    }
}
