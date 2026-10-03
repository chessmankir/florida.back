import { Module } from '@nestjs/common';

import { FlowwowOrdersModule } from './flowwow_orders/flowwow-orders.module.js';

@Module({
    imports: [FlowwowOrdersModule],
    exports: [FlowwowOrdersModule],
})
export class FlowwowModule {}
