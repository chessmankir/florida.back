import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FlowwowOrdersClient } from './clients/flowwow-orders.client.js';
import { FlowwowOrdersMapper } from './mappers/flowwow-orders.mapper.js';
import { FlowwowOrdersRepository } from './flowwow-orders.repository.js';
import { FlowwowShopsService } from './flowwow-shops.service.js';
import type {
    FlowwowOrdersSyncResult,
    FlowwowOrdersListResponse,
    FlowwowRemoteOrder,
} from './types/flowwow-orders.types.js';

@Injectable()
export class FlowwowOrdersService {
    private readonly logger = new Logger(FlowwowOrdersService.name);
    private readonly pageSize: number;

    public constructor(
        config: ConfigService,
        private readonly client: FlowwowOrdersClient,
        private readonly mapper: FlowwowOrdersMapper,
        private readonly repository: FlowwowOrdersRepository,
        private readonly shopsService: FlowwowShopsService
    ) {
        this.pageSize = config.get<number>('FLOWWOW_SYNC_PAGE_SIZE', 100);
    }

    public async syncAll(): Promise<FlowwowOrdersSyncResult> {
        const shopsResult = await this.shopsService.syncAll();
        const shopIds = shopsResult.activeShopIds;
        if (shopIds.length === 0) {
            throw new BadGatewayException('Flowwow: активные магазины не найдены');
        }

        // Сначала полностью читаем доступные заказы. До окончания чтения в базу не пишем.
        const remoteOrders: FlowwowRemoteOrder[] = [];
        for (const shopId of shopIds) {
            remoteOrders.push(...(await this.fetchAllShopOrders(shopId)));
        }

        const uniqueOrders = new Map<string, FlowwowRemoteOrder>();
        for (const order of remoteOrders) {
            uniqueOrders.set(`${order.shopId}:${order.id}`, order);
        }
        const orders = [...uniqueOrders.values()];

        this.logger.log({
            event: 'flowwow_orders_received',
            shops: shopIds.length,
            received: remoteOrders.length,
            unique: orders.length,
        });

        // Затем группируем весь результат по дню создания и последовательно сохраняем.
        for (const [periodDate, periodOrders] of this.groupByCreatedDate(orders)) {
            const syncedAt = new Date();
            const snapshots = periodOrders.map((order) => this.mapper.mapSnapshot(order, syncedAt));
            await this.repository.saveChunk(snapshots);
            this.logger.log({ event: 'flowwow_orders_day_saved', periodDate, saved: snapshots.length });
        }

        const shops: Record<number, number> = {};
        for (const shopId of shopIds) {
            shops[shopId] = orders.filter((order) => order.shopId === shopId).length;
        }

        return {
            shops,
            shopsSynced: shopsResult.saved,
            total: orders.length,
        };
    }

    public getOrders(query: {
        dateFrom?: string;
        dateTo?: string;
        shopId?: string;
        page?: string;
        limit?: string;
    }): Promise<FlowwowOrdersListResponse> {
        const dateFrom = this.validateDate(query.dateFrom, 'dateFrom');
        const dateTo = this.validateDate(query.dateTo, 'dateTo');
        if (dateFrom > dateTo) {
            throw new BadRequestException('dateFrom не может быть больше dateTo');
        }

        const page = this.parsePositiveInteger(query.page, 1, 'page');
        const limit = this.parsePositiveInteger(query.limit, 50, 'limit');
        if (limit > 100) {
            throw new BadRequestException('limit не может быть больше 100');
        }

        const shopId = query.shopId === undefined
            ? null
            : this.parsePositiveInteger(query.shopId, 0, 'shopId');

        return this.repository.findOrders({ dateFrom, dateTo, shopId, page, limit });
    }

    private async fetchAllShopOrders(shopId: number): Promise<FlowwowRemoteOrder[]> {
        const orders: FlowwowRemoteOrder[] = [];
        for (let page = 1; ; page++) {
            const response = await this.client.getOrders(shopId, {
                page,
                limit: this.pageSize,
            });
            orders.push(...response.items);
            this.logger.log({
                event: 'flowwow_orders_page_received',
                shopId,
                page,
                receivedOnPage: response.items.length,
                received: orders.length,
                total: response.total,
            });
            if (orders.length >= response.total) return orders;
        }
    }

    private groupByCreatedDate(orders: FlowwowRemoteOrder[]): Map<string, FlowwowRemoteOrder[]> {
        const groups = new Map<string, FlowwowRemoteOrder[]>();
        for (const order of orders) {
            const periodDate = this.orderCreatedDate(order);
            const group = groups.get(periodDate) ?? [];
            group.push(order);
            groups.set(periodDate, group);
        }
        return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
    }

    private orderCreatedDate(order: FlowwowRemoteOrder): string {
        const date = new Date(order.createdDate * 1_000);
        if (Number.isNaN(date.getTime())) {
            throw new BadGatewayException(`Flowwow вернул некорректную дату заказа ${order.id}`);
        }
        return date.toISOString().slice(0, 10);
    }

    private validateDate(value: string | undefined, field: string): string {
        if (!value) throw new BadRequestException(`Параметр ${field} обязателен`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new BadRequestException(`${field} должен иметь формат YYYY-MM-DD`);
        }
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new BadRequestException(`Параметр ${field} содержит некорректную дату`);
        }
        return value;
    }

    private parsePositiveInteger(value: string | undefined, defaultValue: number, field: string): number {
        if (value === undefined) return defaultValue;
        if (!/^\d+$/.test(value)) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            throw new BadRequestException(`${field} должен быть положительным целым числом`);
        }
        return parsed;
    }
}
