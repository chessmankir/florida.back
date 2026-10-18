import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { MoyskladProcessingPlansClient } from './clients/moysklad-processing-plans.client.js';
import { MoyskladProcessingPlansController } from './moysklad-processing-plans.controller.js';
import { MoyskladProcessingPlansRepository } from './moysklad-processing-plans.repository.js';
import { MoyskladProcessingPlansService } from './moysklad-processing-plans.service.js';
import { MoyskladProcessingPlan } from './models/moysklad-processing-plan.model.js';
import { MoyskladProcessingPlanMaterial } from './models/moysklad-processing-plan-material.model.js';

@Module({
    imports: [AuthModule, TypeOrmModule.forFeature([MoyskladProcessingPlan, MoyskladProcessingPlanMaterial], 'florida')],
    controllers: [MoyskladProcessingPlansController],
    providers: [MoyskladProcessingPlansClient, MoyskladProcessingPlansRepository, MoyskladProcessingPlansService],
    exports: [MoyskladProcessingPlansService],
})
export class MoyskladProcessingPlansModule {}
