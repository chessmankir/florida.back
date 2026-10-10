import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FlowwowAxiosService } from './clients/flowwow-axios.service.js';
import { FlowwowOrdersClient } from './clients/flowwow-orders.client.js';
import { FlowwowOrdersController } from './flowwow-orders.controller.js';
import { FlowwowOrdersFinanceImportService } from './flowwow-orders-finance-import.service.js';
import { FlowwowOrdersMapper } from './mappers/flowwow-orders.mapper.js';
import { FlowwowShopsMapper } from './mappers/flowwow-shops.mapper.js';
import { FlowwowOrder } from './models/flowwow-order.model.js';
import { FlowwowOrderPosition } from './models/flowwow-order-position.model.js';
import { FlowwowShop } from './models/flowwow-shop.model.js';
import { FlowwowOrdersRepository } from './flowwow-orders.repository.js';
import { FlowwowOrdersService } from './flowwow-orders.service.js';
import { FlowwowShopsRepository } from './flowwow-shops.repository.js';
import { FlowwowShopsService } from './flowwow-shops.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([FlowwowOrder, FlowwowOrderPosition, FlowwowShop], 'seller')],
    controllers: [FlowwowOrdersController],
    providers: [
        FlowwowAxiosService,
        FlowwowOrdersClient,
        FlowwowOrdersMapper,
        FlowwowOrdersFinanceImportService,
        FlowwowShopsMapper,
        FlowwowOrdersRepository,
        FlowwowShopsRepository,
        FlowwowShopsService,
        FlowwowOrdersService,
    ],
    exports: [
        FlowwowAxiosService,
        FlowwowOrdersRepository,
        FlowwowShopsRepository,
        FlowwowOrdersService,
        FlowwowShopsService,
    ],
})
export class FlowwowOrdersModule {}
