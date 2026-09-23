import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

import { ProductProfitPage, ProductProfitRequest } from '../types/product-profit.types.js';

@Injectable()
export class ProductProfitClient {
    private readonly logger = new Logger(ProductProfitClient.name);
    private readonly http: AxiosInstance;

    public constructor(private readonly config: ConfigService) {
        const token = this.config.getOrThrow<string>('MOYSKLAD');

        this.http = axios.create({
            baseURL: 'https://api.moysklad.ru/api/remap/1.2',
            timeout: 30_000,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/json',
            },
        });
    }

    public async getPage(request: ProductProfitRequest): Promise<ProductProfitPage> {
        try {
            const response = await this.http.get<ProductProfitPage>('/report/profit/byproduct', {
                params: request,
            });

            return response.data;
        } catch (error) {
            this.logger.error('Не удалось получить отчёт /report/profit/byproduct', error instanceof Error ? error.stack : undefined);

            throw new BadGatewayException('МойСклад не вернул отчёт прибыльности по товарам');
        }
    }
}
