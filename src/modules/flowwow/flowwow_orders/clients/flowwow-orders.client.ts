import { BadGatewayException, Injectable } from '@nestjs/common';

import { FlowwowAxiosService } from './flowwow-axios.service.js';
import type {
    FlowwowOrdersPage,
    FlowwowOrdersRequest,
    FlowwowShopsPage,
    FlowwowShopsRequest,
} from '../types/flowwow-orders.types.js';

@Injectable()
export class FlowwowOrdersClient {
    public constructor(private readonly http: FlowwowAxiosService) {}

    public async getShops(request: FlowwowShopsRequest): Promise<FlowwowShopsPage> {
        const page = request.page ?? 0;
        const limit = Math.min(Math.max(request.limit ?? 50, 1), 50);
        const response = await this.http.post<FlowwowShopsPage>('/apiseller/shops', {
            ...request,
            page,
            limit,
        });
        this.validateShopsPage(response.data, page, limit);
        return response.data;
    }

    public async getOrders(shopId: number, request: FlowwowOrdersRequest = {}): Promise<FlowwowOrdersPage> {
        const page = request.page ?? 1;
        const limit = Math.min(Math.max(request.limit ?? 100, 1), 100);
        const response = await this.http.get<FlowwowOrdersPage>('/apiseller/orders/list', {
            params: { shopId, ...request, page, limit },
        });
        this.validateOrdersPage(response.data, page, limit);
        return response.data;
    }

    private validateOrdersPage(page: FlowwowOrdersPage, requestedPage: number, limit: number): void {
        if (
            !page ||
            !Array.isArray(page.items) ||
            !Number.isInteger(page.total) ||
            page.total < 0 ||
            page.items.length > limit ||
            (page.items.length === 0 && (requestedPage - 1) * limit < page.total)
        ) {
            throw new BadGatewayException('Flowwow вернул некорректную страницу заказов');
        }
    }

    private validateShopsPage(page: FlowwowShopsPage, requestedPage: number, limit: number): void {
        if (
            !page ||
            !Array.isArray(page.shops) ||
            !Number.isInteger(page.total) ||
            page.total < 0 ||
            page.shops.length > limit ||
            (page.shops.length === 0 && requestedPage * limit < page.total)
        ) {
            throw new BadGatewayException('Flowwow вернул некорректную страницу магазинов');
        }
    }
}
