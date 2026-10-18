import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { setTimeout as sleep } from 'node:timers/promises';
import type { MoyskladPage, MoyskladProcessingPlanMaterialRow, MoyskladProcessingPlanRow } from '../types/moysklad-processing-plans.types.js';

@Injectable()
export class MoyskladProcessingPlansClient {
    private static readonly MAX_RETRIES = 5;
    private readonly logger = new Logger(MoyskladProcessingPlansClient.name);
    private readonly http: AxiosInstance = axios.create({
        baseURL: 'https://api.moysklad.ru/api/remap/1.2', timeout: 60_000,
        headers: { Accept: 'application/json;charset=utf-8', 'Content-Type': 'application/json' },
    });

    public getPlans(token: string, limit: number, offset: number) {
        return this.getPage<MoyskladProcessingPlanRow>(token, '/entity/processingplan', limit, offset);
    }

    public getMaterials(token: string, planId: string, limit: number, offset: number) {
        return this.getPage<MoyskladProcessingPlanMaterialRow>(token, `/entity/processingplan/${planId}/materials`, limit, offset);
    }

    private async getPage<T>(token: string, path: string, limit: number, offset: number): Promise<MoyskladPage<T>> {
        const normalizedToken = token.trim().replace(/^Bearer\s+/i, '').trim();
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await this.http.get<MoyskladPage<T>>(path, {
                    params: { limit, offset }, headers: { Authorization: `Bearer ${normalizedToken}` },
                });
                if (!response.data || !Array.isArray(response.data.rows) || !Number.isInteger(response.data.meta?.size)) {
                    throw new BadGatewayException(`МойСклад вернул некорректные данные ${path}`);
                }
                return response.data;
            } catch (error: unknown) {
                if (!axios.isAxiosError(error)) throw error;
                const status = error.response?.status;
                const headers = error.response?.headers ? { ...error.response.headers } as Record<string, unknown> : undefined;
                if ((!status || status === 429 || status >= 500) && attempt < MoyskladProcessingPlansClient.MAX_RETRIES) {
                    const waitMs = this.retryDelay(headers, attempt);
                    this.logger.warn({ event: 'moysklad_processing_plans_retry', path, limit, offset, status, attempt: attempt + 1, waitMs, responseHeaders: headers });
                    await sleep(waitMs);
                    continue;
                }
                this.logger.error({ event: 'moysklad_processing_plans_request_failed', path, limit, offset, status, responseHeaders: headers, response: error.response?.data });
                throw new BadGatewayException(`МойСклад не вернул данные ${path}${status ? ` (HTTP ${status})` : ''}`);
            }
        }
    }

    private retryDelay(headers: Record<string, unknown> | undefined, attempt: number): number {
        const value = Number(headers?.['x-lognex-retry-after'] ?? headers?.['x-lognex-reset'] ?? headers?.['retry-after']);
        return Math.max(1_000, (Number.isFinite(value) && value > 0 ? value * 1_000 : 1_000 * 2 ** attempt) + 250);
    }
}
