import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import { setTimeout as sleep } from 'node:timers/promises';

import type { CustomerOrder, CustomerOrderPosition, PageRequest, RemotePage } from '../types/customerorder.types.js';

@Injectable()
export class CustomerOrderClient {
    private readonly logger = new Logger(CustomerOrderClient.name);
    private readonly http: AxiosInstance;

    constructor(config: ConfigService) {
        this.http = axios.create({
            baseURL: 'https://api.moysklad.ru/api/remap/1.2',
            timeout: 30_000,
            maxRedirects: 0,
            headers: {
                Authorization: 'Bearer ' + config.getOrThrow<string>('MOYSKLAD').trim(),
                'Accept-Encoding': 'gzip',
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/json;charset=utf-8',
            },
        });
    }

    public getOrders(request: PageRequest = {}): Promise<RemotePage<CustomerOrder>> {
        return this.getPage('/entity/customerorder', this.pageParams(request, 100), {
            expand: 'positions',
        });
    }

    public getPositions(orderId: string, request: PageRequest = {}): Promise<RemotePage<CustomerOrderPosition>> {
        return this.getPage('/entity/customerorder/' + encodeURIComponent(orderId) + '/positions', this.pageParams(request, 1000));
    }

    private pageParams(request: PageRequest, maximum: number): Required<PageRequest> {
        const limit = request.limit ?? maximum;
        const offset = request.offset ?? 0;

        if (!Number.isInteger(limit) || !Number.isInteger(offset) || offset < 0) {
            throw new Error('Некорректные параметры пагинации');
        }

        return { limit: Math.min(Math.max(limit, 1), maximum), offset };
    }

    private async getPage<T>(path: string, request: Required<PageRequest>, params: Record<string, string> = {}): Promise<RemotePage<T>> {
        for (let attempt = 0; ; attempt++) {
            try {
                const { data } = await this.http.get<RemotePage<T>>(path, {
                    params: {
                        ...request,
                        ...params,
                    },
                });

                this.validatePage(data, request);

                return data;
            } catch (error: unknown) {
                if (!axios.isAxiosError(error)) {
                    throw error;
                }

                const status = error.response?.status;
                const retryable = !status || status === 429 || status >= 500;

                if (!retryable || attempt >= 4) {
                    const responseData = error.response?.data as
                        | {
                              errors?: Array<{
                                  error?: string;
                                  code?: number;
                                  parameter?: string;
                              }>;
                          }
                        | undefined;

                    const apiErrors = responseData?.errors?.map((item) => ({
                        message: item.error,
                        code: item.code,
                        parameter: item.parameter,
                    }));

                    this.logger.error({
                        event: 'customerorder_request_failed',
                        path,
                        status,
                        code: error.code,
                        apiErrors,
                    });

                    throw new BadGatewayException('МойСклад: ошибка чтения ' + path + (status ? ` (HTTP ${status})` : ' (сеть)'));
                }

                await sleep(this.retryDelay(error.response?.headers['retry-after'], attempt));
            }
        }
    }

    private validatePage<T>(page: RemotePage<T>, request: Required<PageRequest>): void {
        if (
            !page ||
            !Array.isArray(page.rows) ||
            !Number.isInteger(page.meta?.size) ||
            page.meta.size < 0 ||
            page.meta.offset !== request.offset ||
            page.rows.length > request.limit ||
            (page.rows.length === 0 && request.offset < page.meta.size)
        ) {
            throw new BadGatewayException('МойСклад вернул некорректную или неполную страницу');
        }
    }

    private retryDelay(retryAfter: unknown, attempt: number): number {
        const seconds = typeof retryAfter === 'string' ? Number(retryAfter) : NaN;
        const dateDelay = typeof retryAfter === 'string' ? Date.parse(retryAfter) - Date.now() : NaN;
        const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(dateDelay) ? dateDelay : 1000 * 2 ** attempt;

        return Math.max(1000, Math.min(delay, 60_000));
    }
}
