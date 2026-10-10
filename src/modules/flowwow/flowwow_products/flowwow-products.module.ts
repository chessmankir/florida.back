import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FlowwowOrdersModule } from '../flowwow_orders/flowwow-orders.module.js';
import { FlowwowProductsClient } from './clients/flowwow-products.client.js';
import { FlowwowProductsController } from './flowwow-products.controller.js';
import { FlowwowProductsMapper } from './mappers/flowwow-products.mapper.js';
import { FlowwowProduct } from './models/flowwow-product.model.js';
import { FlowwowProductInventoryLink } from './models/flowwow-product-inventory-link.model.js';
import { FlowwowProductLinksRepository } from './flowwow-product-links.repository.js';
import { FlowwowProductLinksService } from './flowwow-product-links.service.js';
import { FlowwowProductsRepository } from './flowwow-products.repository.js';
import { FlowwowProductsService } from './flowwow-products.service.js';

@Module({
    imports: [FlowwowOrdersModule, TypeOrmModule.forFeature([FlowwowProduct, FlowwowProductInventoryLink], 'seller')],
    controllers: [FlowwowProductsController],
    providers: [
        FlowwowProductsClient,
        FlowwowProductsMapper,
        FlowwowProductsRepository,
        FlowwowProductsService,
        FlowwowProductLinksRepository,
        FlowwowProductLinksService,
    ],
    exports: [FlowwowProductsRepository, FlowwowProductsService],
})
export class FlowwowProductsModule {}
