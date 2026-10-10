import { Module } from '@nestjs/common';

import { FlowwowOrdersModule } from './flowwow_orders/flowwow-orders.module.js';
import { FlowwowProductsModule } from './flowwow_products/flowwow-products.module.js';

@Module({
    imports: [FlowwowOrdersModule, FlowwowProductsModule],
    exports: [FlowwowOrdersModule, FlowwowProductsModule],
})
export class FlowwowModule {}
