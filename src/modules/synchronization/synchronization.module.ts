import { Module } from '@nestjs/common';

import { ProductsModule } from '../products/products.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { SynchronizationController } from './synchronization.controller.js';
import { SynchronizationRepository } from './synchronization.repository.js';
import { SynchronizationScheduler } from './synchronization.scheduler.js';
import { SynchronizationService } from './synchronization.service.js';

@Module({
    imports: [SalesModule, ProductsModule],
    controllers: [SynchronizationController],
    providers: [SynchronizationRepository, SynchronizationService, SynchronizationScheduler],
    exports: [SynchronizationService],
})
export class SynchronizationModule {}
