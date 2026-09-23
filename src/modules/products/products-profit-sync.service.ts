import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProductProfitClient } from './clients/product-profit.client.js';
import { ProductProfitMapper } from './mappers/product-profit.mapper.js';
import { ProductsRepository } from './products.repository.js';
import { ProductProfitSyncResult } from './types/product-profit.types.js';

@Injectable()
export class ProductsProfitSyncService {
    private readonly logger = new Logger(ProductsProfitSyncService.name);

    public constructor(
        private readonly client: ProductProfitClient,
        private readonly repository: ProductsRepository,
        private readonly config: ConfigService
    ) {}

    /**
     * Синхронизирует один календарный день.
     *
     * day должен иметь формат YYYY-MM-DD.
     */
    public async syncDay(day: string): Promise<ProductProfitSyncResult> {
        this.assertDate(day);

        const pageSize = this.getPageSize();
        const syncedAt = new Date();
        const productIds = new Set<string>();

        let offset = 0;
        let received = 0;
        let saved = 0;

        while (true) {
            const page = await this.client.getPage({
                momentFrom: `${day} 00:00:00`,
                momentTo: `${day} 23:59:59`,
                limit: pageSize,
                offset,
            });

            const entities = page.rows.map((row) => ProductProfitMapper.toEntity(row, day, syncedAt));

            for (const entity of entities) {
                productIds.add(entity.productId);
            }

            saved += await this.repository.upsertProfit(entities);
            received += page.rows.length;
            offset += page.rows.length;

            this.logger.log(`Прибыль по товарам ${day}: получено ${received} из ${page.meta.size}`);

            if (offset >= page.meta.size) {
                break;
            }

            if (page.rows.length === 0) {
                throw new Error(`МойСклад вернул пустую страницу при offset=${offset}`);
            }
        }

        /*
         * Выполняем очистку только после успешного получения всех страниц.
         * Поэтому временная ошибка API не удалит уже сохранённые данные.
         */
        await this.repository.deleteMissingForDate(day, [...productIds]);

        return {
            periodDate: day,
            received,
            saved,
        };
    }

    /**
     * Используется ежедневной синхронизацией.
     * Берётся последний полностью завершённый день по Москве.
     */
    public async syncPreviousDay(): Promise<ProductProfitSyncResult> {
        return this.syncDay(this.getPreviousMoscowDate());
    }

    private getPageSize(): number {
        const configured = this.config.get<number>('MOYSKLAD_PROFIT_PAGE_SIZE', 1000);

        return Math.min(Math.max(configured, 1), 1000);
    }

    private getPreviousMoscowDate(now = new Date()): string {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now);

        const year = Number(parts.find((part) => part.type === 'year')?.value);
        const month = Number(parts.find((part) => part.type === 'month')?.value);
        const day = Number(parts.find((part) => part.type === 'day')?.value);

        const previousDate = new Date(Date.UTC(year, month - 1, day - 1));

        return [
            previousDate.getUTCFullYear(),
            String(previousDate.getUTCMonth() + 1).padStart(2, '0'),
            String(previousDate.getUTCDate()).padStart(2, '0'),
        ].join('-');
    }

    private assertDate(day: string): void {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            throw new Error(`Некорректная дата "${day}". Ожидается YYYY-MM-DD`);
        }
    }

    public async syncRange(
        dateFrom: string,
        dateTo: string,
    ): Promise<ProductProfitSyncResult[]> {
        this.assertDate(dateFrom);
        this.assertDate(dateTo);

        const from = new Date(`${dateFrom}T00:00:00.000Z`);
        const to = new Date(`${dateTo}T00:00:00.000Z`);

        if (from > to) {
            throw new Error(
                'Дата начала периода больше даты окончания',
            );
        }

        const results: ProductProfitSyncResult[] = [];

        for (
            let current = from;
            current <= to;
            current = new Date(
                current.getTime() + 24 * 60 * 60 * 1000,
            )
        ) {
            const day = this.formatDate(current);

            /*
             * Здесь обязательно await.
             * Дни синхронизируются строго последовательно.
             */
            const result = await this.syncDay(day);

            results.push(result);
        }

        return results;
    }

    public getCurrentMoscowDate(
        now = new Date(),
    ): string {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Moscow',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(now);

        const year = parts.find(
            (part) => part.type === 'year',
        )?.value;

        const month = parts.find(
            (part) => part.type === 'month',
        )?.value;

        const day = parts.find(
            (part) => part.type === 'day',
        )?.value;

        if (!year || !month || !day) {
            throw new Error(
                'Не удалось определить текущую дату по Москве',
            );
        }

        return `${year}-${month}-${day}`;
    }

    private formatDate(date: Date): string {
        return [
            date.getUTCFullYear(),
            String(date.getUTCMonth() + 1).padStart(2, '0'),
            String(date.getUTCDate()).padStart(2, '0'),
        ].join('-');
    }
}
