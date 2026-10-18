import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';

import { ProductProfitClient } from './clients/product-profit.client.js';
import { ProductProfit } from './models/product-profit.model.js';
import { ProductsProfitSyncService } from './products-profit-sync.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

@Module({
    imports: [AuthModule, TypeOrmModule.forFeature([ProductProfit], 'florida')],
    controllers: [ProductsController],
    providers: [ProductProfitClient, ProductsRepository, ProductsProfitSyncService, ProductsService],
    exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}

