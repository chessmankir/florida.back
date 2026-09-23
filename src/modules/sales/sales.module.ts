import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerOrderClient } from './clients/customerorder.client.js';
import { CustomerOrderMapper } from './mappers/customerorder.mapper.js';
import { SalesCustomerOrder } from './models/customerorder.model.js';
import { SalesCustomerOrderPosition } from './models/customerorder-position.model.js';
import { SalesCustomerOrderSyncService } from './services/sales-customerorder-sync.service.js';
import { SalesRepository } from './sales.repository.js';
import { SalesService } from './sales.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([SalesCustomerOrder, SalesCustomerOrderPosition], 'seller')],
    providers: [CustomerOrderClient, CustomerOrderMapper, SalesRepository, SalesCustomerOrderSyncService, SalesService],
    exports: [SalesRepository, SalesService],
})
export class SalesModule {}
