import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SynchronizationService } from './synchronization.service.js';

@Injectable()
export class SynchronizationScheduler implements OnApplicationBootstrap {
    private readonly logger = new Logger(SynchronizationScheduler.name);

    constructor(
        private readonly config: ConfigService,
        private readonly registry: SchedulerRegistry,
        private readonly synchronization: SynchronizationService
    ) {}

    onApplicationBootstrap(): void {
        if (!this.config.get<boolean>('MOYSKLAD_SYNC_ENABLED', true)) return;
        const cronTime = this.config.get<string>('MOYSKLAD_SYNC_CRON', '0 0 3 * * *');
        const timeZone = this.config.get<string>('MOYSKLAD_SYNC_TIMEZONE', 'Europe/Moscow');
        const job = CronJob.from({
            cronTime,
            timeZone,
            start: false,
            waitForCompletion: true,
            onTick: async () => {
                try {
                    await this.synchronization.run();
                } catch {
                    this.logger.error('Не удалось выполнить синхронизацию. Проверьте соединение с БД и применение миграций.');
                }
            },
        });
        this.registry.addCronJob('moysklad-daily', job);
        job.start();
        this.logger.log('Синхронизация: ' + cronTime + ' (' + timeZone + ')');
    }
}
