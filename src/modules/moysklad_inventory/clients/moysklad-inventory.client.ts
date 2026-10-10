import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { MoyskladAssortmentRow, MoyskladPage, MoyskladStockRow } from '../types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryClient {
    private readonly logger = new Logger(MoyskladInventoryClient.name);
    private readonly http: AxiosInstance;

    public constructor(config: ConfigService) {
        this.http = axios.create({
            baseURL: 'https://api.moysklad.ru/api/remap/1.2',
            timeout: 60_000,
            headers: {
                Authorization: `Bearer ${config.getOrThrow<string>('MOYSKLAD')}`,
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/json',
            },
        });
    }

    public getAssortmentPage(limit: number, offset: number): Promise<MoyskladPage<MoyskladAssortmentRow>> {
        return this.getPage('/entity/assortment', limit, offset);
    }
    public getStockPage(limit: number, offset: number): Promise<MoyskladPage<MoyskladStockRow>> {
        return this.getPage('/report/stock/all', limit, offset);
    }
    private async getPage<T>(path: string, limit: number, offset: number): Promise<MoyskladPage<T>> {
        try {
            const response = await this.http.get<MoyskladPage<T>>(path, { params: { limit, offset } });
            if (!response.data || !Array.isArray(response.data.rows) || !Number.isInteger(response.data.meta?.size)) {
                throw new Error('Некорректный формат страницы');
            }
            return response.data;
        } catch (error) {
            this.logger.error({
                event: 'moysklad_inventory_request_failed', path, limit, offset,
                status: axios.isAxiosError(error) ? error.response?.status : undefined,
                response: axios.isAxiosError(error) ? error.response?.data : undefined,
            });
            throw new BadGatewayException(`МойСклад не вернул данные ${path}`);
        }
    }
}
