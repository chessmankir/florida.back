import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoyskladInventoryClient } from './clients/moysklad-inventory.client.js';
import { MoyskladInventoryController } from './moysklad-inventory.controller.js';
import { MoyskladInventoryMapper } from './mappers/moysklad-inventory.mapper.js';
import { MoyskladInventoryProduct } from './models/moysklad-inventory-product.model.js';
import { MoyskladInventoryRepository } from './moysklad-inventory.repository.js';
import { MoyskladInventoryService } from './moysklad-inventory.service.js';

@Module({
    imports: [TypeOrmModule.forFeature([MoyskladInventoryProduct], 'seller')],
    controllers: [MoyskladInventoryController],
    providers: [MoyskladInventoryClient, MoyskladInventoryMapper, MoyskladInventoryRepository, MoyskladInventoryService],
    exports: [MoyskladInventoryService, MoyskladInventoryRepository],
})
export class MoyskladInventoryModule {}
