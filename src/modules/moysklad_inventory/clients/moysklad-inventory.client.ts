import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { setTimeout as sleep } from 'node:timers/promises';
import type { MoyskladAssortmentRow, MoyskladBundleComponentRow, MoyskladPage, MoyskladStockRow } from '../types/moysklad-inventory.types.js';

@Injectable()
export class MoyskladInventoryClient {
    private static readonly MAX_RETRIES = 5;

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
    public getBundleComponentsPage(bundleId: string, limit: number, offset: number): Promise<MoyskladPage<MoyskladBundleComponentRow>> {
        return this.getPage(`/entity/bundle/${bundleId}/components`, limit, offset);
    }
    private async getPage<T>(path: string, limit: number, offset: number): Promise<MoyskladPage<T>> {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await this.http.get<MoyskladPage<T>>(path, { params: { limit, offset } });
                if (!response.data || !Array.isArray(response.data.rows) || !Number.isInteger(response.data.meta?.size)) {
                    throw new BadGatewayException(`МойСклад вернул некорректные данные ${path}`);
                }

                return response.data;
            } catch (error: unknown) {
                if (!axios.isAxiosError(error)) throw error;

                const status = error.response?.status;
                const headers = error.response?.headers
                    ? { ...error.response.headers } as Record<string, unknown>
                    : undefined;
                const retryable = !status || status === 429 || status >= 500;

                if (retryable && attempt < MoyskladInventoryClient.MAX_RETRIES) {
                    const waitMs = this.retryDelay(headers, attempt);

                    this.logger.warn({
                        event: 'moysklad_inventory_request_retry_scheduled',
                        path,
                        limit,
                        offset,
                        status,
                        attempt: attempt + 1,
                        maxRetries: MoyskladInventoryClient.MAX_RETRIES,
                        waitMs,
                        responseHeaders: headers,
                    });

                    await sleep(waitMs);
                    continue;
                }

                this.logger.error({
                    event: 'moysklad_inventory_request_failed', path, limit, offset,
                    status,
                    code: error.code,
                    responseHeaders: headers,
                    response: error.response?.data,
                });
                throw new BadGatewayException(`МойСклад не вернул данные ${path}${status ? ` (HTTP ${status})` : ''}`);
            }
        }
    }

    private retryDelay(headers: Record<string, unknown> | undefined, attempt: number): number {
        const retryAfter = headers?.['retry-after'];
        const retryAfterSeconds = Number(retryAfter);
        const retryAfterDate = typeof retryAfter === 'string' ? Date.parse(retryAfter) - Date.now() : Number.NaN;
        const lognexRetryAfterMs = Number(headers?.['x-lognex-retry-after']);
        const lognexResetMs = Number(headers?.['x-lognex-reset']);
        const lognexIntervalMs = Number(headers?.['x-lognex-retry-timeinterval']);

        const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : Number.isFinite(retryAfterDate) && retryAfterDate > 0
                ? retryAfterDate
                : Number.isFinite(lognexRetryAfterMs) && lognexRetryAfterMs > 0
                    ? lognexRetryAfterMs
                    : Number.isFinite(lognexResetMs) && lognexResetMs > 0
                        ? lognexResetMs
                        : Number.isFinite(lognexIntervalMs) && lognexIntervalMs > 0
                            ? lognexIntervalMs
                            : 1000 * 2 ** attempt;

        return Math.max(250, delay + 250);
    }
}
