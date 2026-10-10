import { BadGatewayException, Injectable } from '@nestjs/common';

import { FlowwowAxiosService } from '../../flowwow_orders/clients/flowwow-axios.service.js';
import type {
    FlowwowOfferMappingsRequest,
    FlowwowOfferMappingsResponse,
    FlowwowProductsPage,
    FlowwowProductsRequest,
    FlowwowProductStatusRequest,
    FlowwowProductStatusResponse,
} from '../types/flowwow-products.types.js';

@Injectable()
export class FlowwowProductsClient {
    public constructor(private readonly http: FlowwowAxiosService) {}

    public async getProducts(shopId: number, request: FlowwowProductsRequest): Promise<FlowwowProductsPage> {
        const response = await this.http.post<FlowwowProductsPage>(
            '/apiseller/products',
            request,
            { params: { shopId } }
        );
        this.validatePage(response.data, request.page, request.limit);
        return response.data;
    }

    public async mapOffers(
        shopId: number,
        request: FlowwowOfferMappingsRequest
    ): Promise<FlowwowOfferMappingsResponse> {
        const response = await this.http.post<FlowwowOfferMappingsResponse>(
            '/apiseller/products/offersMappings',
            request,
            { params: { shopId } }
        );
        if (!response.data || !Array.isArray(response.data.errors)) {
            throw new BadGatewayException('Flowwow вернул некорректный результат назначения offerId');
        }
        return response.data;
    }

    public async hideProducts(
        shopId: number,
        request: FlowwowProductStatusRequest
    ): Promise<FlowwowProductStatusResponse> {
        return this.changeStatus('/apiseller/products/hide', shopId, request);
    }

    public async unhideProducts(
        shopId: number,
        request: FlowwowProductStatusRequest
    ): Promise<FlowwowProductStatusResponse> {
        return this.changeStatus('/apiseller/products/unhide', shopId, request);
    }

    private async changeStatus(
        path: string,
        shopId: number,
        request: FlowwowProductStatusRequest
    ): Promise<FlowwowProductStatusResponse> {
        const response = await this.http.post<FlowwowProductStatusResponse>(path, request, {
            params: { shopId },
        });
        if (
            !response.data ||
            response.data.shopId !== shopId ||
            !Array.isArray(response.data.data) ||
            !Array.isArray(response.data.errors)
        ) {
            throw new BadGatewayException('Flowwow вернул некорректный результат изменения видимости товаров');
        }
        return response.data;
    }

    private validatePage(page: FlowwowProductsPage, requestedPage: number, limit: number): void {
        if (
            !page ||
            !Array.isArray(page.items) ||
            !Number.isInteger(page.total) ||
            page.total < 0 ||
            page.items.length > limit ||
            (page.items.length === 0 && requestedPage * limit < page.total)
        ) {
            throw new BadGatewayException('Flowwow вернул некорректную страницу товаров');
        }
    }
}
