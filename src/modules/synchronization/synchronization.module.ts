import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExpensesModule } from '../expenses/expenses.module.js';
import { FlowwowModule } from '../flowwow/flowwow.module.js';
import { ProductsModule } from '../products/products.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { MoyskladInventoryModule } from '../moysklad_inventory/moysklad-inventory.module.js';
import { SynchronizationController } from './synchronization.controller.js';
import { SynchronizationRepository } from './synchronization.repository.js';
import { SynchronizationScheduler } from './synchronization.scheduler.js';
import { SynchronizationService } from './synchronization.service.js';
import { SynchronizationRun } from './models/synchronization-run.model.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([SynchronizationRun], 'florida'),
        SalesModule,
        ProductsModule,
        ExpensesModule,
        FlowwowModule,
        MoyskladInventoryModule,
    ],
    controllers: [SynchronizationController],
    providers: [SynchronizationRepository, SynchronizationService, SynchronizationScheduler],
    exports: [SynchronizationService],
})
export class SynchronizationModule {}
