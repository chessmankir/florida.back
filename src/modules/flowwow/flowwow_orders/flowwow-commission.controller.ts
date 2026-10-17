import { Body, Controller, Post } from '@nestjs/common';

import {
    FlowwowCommissionService,
    type FlowwowCommissionCalculation,
} from './flowwow-commission.service.js';

@Controller('analytics/flowwow/commission')
export class FlowwowCommissionController {
    public constructor(private readonly commission: FlowwowCommissionService) {}

    @Post('calculate')
    public calculate(@Body() body: { price?: unknown }): FlowwowCommissionCalculation {
        return this.commission.calculate(body?.price);
    }
}
