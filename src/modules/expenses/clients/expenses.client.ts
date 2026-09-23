import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import axios, { type AxiosInstance } from 'axios';

import { setTimeout as sleep } from 'node:timers/promises';

import type { ExpenseDocumentRemote, ExpenseItemRemote, ExpensePageRequest, ExpenseRemotePage } from '../types/expenses.types.js';

@Injectable()
export class ExpensesClient {
    private readonly logger = new Logger(ExpensesClient.name);

    private readonly http: AxiosInstance;

    public constructor(config: ConfigService) {
        const token = config.getOrThrow<string>('MOYSKLAD').trim();

        this.http = axios.create({
            baseURL: 'https://api.moysklad.ru/api/remap/1.2',
            timeout: 30_000,
            maxRedirects: 0,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json;charset=utf-8',
                'Content-Type': 'application/json;charset=utf-8',
                'Accept-Encoding': 'gzip',
            },
        });
    }

    public getExpenseItems(request: ExpensePageRequest = {}): Promise<ExpenseRemotePage<ExpenseItemRemote>> {
        return this.getPage('/entity/expenseitem', request);
    }

    public getPaymentOuts(request: ExpensePageRequest = {}): Promise<ExpenseRemotePage<ExpenseDocumentRemote>> {
        return this.getPage('/entity/paymentout', request);
    }

    public getCashOuts(request: ExpensePageRequest = {}): Promise<ExpenseRemotePage<ExpenseDocumentRemote>> {
        return this.getPage('/entity/cashout', request);
    }

    private async getPage<T>(path: string, request: ExpensePageRequest): Promise<ExpenseRemotePage<T>> {
        const limit = Math.min(Math.max(request.limit ?? 1000, 1), 1000);

        const offset = request.offset ?? 0;

        if (!Number.isInteger(offset) || offset < 0) {
            throw new Error('Некорректный offset пагинации');
        }

        for (let attempt = 0; ; attempt++) {
            try {
                const response = await this.http.get<ExpenseRemotePage<T>>(path, {
                    params: {
                        limit,
                        offset,
                    },
                });

                this.validatePage(response.data, limit, offset);

                return response.data;
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
                        event: 'expenses_request_failed',
                        path,
                        status,
                        code: error.code,
                        apiErrors,
                    });

                    throw new BadGatewayException(`МойСклад: ошибка чтения ${path}` + (status ? ` (HTTP ${status})` : ' (сеть)'));
                }

                await sleep(this.retryDelay(error.response?.headers['retry-after'], attempt));
            }
        }
    }

    private validatePage<T>(page: ExpenseRemotePage<T>, limit: number, offset: number): void {
        if (
            !page ||
            !Array.isArray(page.rows) ||
            !Number.isInteger(page.meta?.size) ||
            page.meta.size < 0 ||
            page.meta.offset !== offset ||
            page.rows.length > limit ||
            (page.rows.length === 0 && offset < page.meta.size)
        ) {
            throw new BadGatewayException('МойСклад вернул некорректную страницу расходов');
        }
    }

    private retryDelay(retryAfter: unknown, attempt: number): number {
        const seconds = typeof retryAfter === 'string' ? Number(retryAfter) : Number.NaN;

        const dateDelay = typeof retryAfter === 'string' ? Date.parse(retryAfter) - Date.now() : Number.NaN;

        const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(dateDelay) ? dateDelay : 1000 * 2 ** attempt;

        return Math.max(1000, Math.min(delay, 60_000));
    }
}
