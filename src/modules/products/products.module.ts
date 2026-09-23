import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductProfitClient } from './clients/product-profit.client.js';
import { ProductProfit } from './models/product-profit.model.js';
import { ProductsProfitSyncService } from './products-profit-sync.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([ProductProfit], 'seller')],
    controllers: [ProductsController],
    providers: [ProductProfitClient, ProductsRepository, ProductsProfitSyncService, ProductsService],
    exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
