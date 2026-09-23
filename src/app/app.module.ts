import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SynchronizationModule } from '../modules/synchronization/synchronization.module.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                PORT: Joi.number().port().default(3017),
                MOYSKLAD: Joi.string().min(1).required(),
                POSTGRES_HOST: Joi.string().required(),
                POSTGRES_PORT: Joi.number().port().default(5432),
                POSTGRES_DATABASE: Joi.string().required(),
                POSTGRES_USER: Joi.string().required(),
                POSTGRES_PASSWORD: Joi.string().required(),
                POSTGRES_POOL_MAX: Joi.number().integer().min(2).default(5),
                MOYSKLAD_SYNC_ENABLED: Joi.boolean().default(true),
                MOYSKLAD_SYNC_CRON: Joi.string().default('0 0 3 * * *'),
                MOYSKLAD_SYNC_TIMEZONE: Joi.string().default('Europe/Moscow'),
                MOYSKLAD_SYNC_PAGE_SIZE: Joi.number().integer().min(1).max(100).default(100),
            }),
        }),

        ScheduleModule.forRoot(),
        SynchronizationModule,
        TypeOrmModule.forRootAsync({
            name: 'seller',

            inject: [ConfigService],

            useFactory: (configService: ConfigService) => ({
                type: 'postgres' as const,
                name: 'seller',

                host: configService.getOrThrow<string>('POSTGRES_HOST'),

                port: configService.getOrThrow<number>('POSTGRES_PORT'),

                database: configService.getOrThrow<string>('POSTGRES_DATABASE'),

                username: configService.getOrThrow<string>('POSTGRES_USER'),

                password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),

                autoLoadEntities: true,
                synchronize: true,
                migrationsRun: false,

                extra: {
                    max: configService.get<number>('POSTGRES_POOL_MAX', 5),
                },
            }),
        }),
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
