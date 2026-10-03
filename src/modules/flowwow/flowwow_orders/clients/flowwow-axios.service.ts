import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios';

interface RetriableConfig extends InternalAxiosRequestConfig {
    __flowwowRetryCount?: number;
}

@Injectable()
export class FlowwowAxiosService {
    private static readonly TIMEOUT_MS = 90_000;
    private static readonly MAX_RETRIES = 5;
    private static readonly MIN_RETRY_DELAY_MS = 5_000;
    private static readonly FALLBACK_RETRY_AFTER_SEC = 60;

    private readonly logger = new Logger(FlowwowAxiosService.name);
    private readonly http: AxiosInstance;

    public constructor(config: ConfigService) {
        const token = config.get<string>('FLOWWOW_TOKEN', '').trim();
        if (!token) throw new ServiceUnavailableException('FLOWWOW_TOKEN не настроен');

        this.http = axios.create({
            baseURL: 'https://apis.flowwow.com',
            timeout: FlowwowAxiosService.TIMEOUT_MS,
            maxRedirects: 0,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        this.registerInterceptors();
    }

    public get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        return this.http.get<TResponse>(url, config);
    }

    public post<TResponse>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        return this.http.post<TResponse>(url, data, config);
    }

    public request<TResponse>(config: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        return this.http.request<TResponse>(config);
    }

    private registerInterceptors(): void {
        this.http.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: unknown) => this.handleResponseError(error)
        );
    }

    private async handleResponseError(error: unknown): Promise<AxiosResponse> {
        if (!axios.isAxiosError(error)) {
            this.logger.error({ event: 'flowwow_unknown_error', error: String(error) });
            return Promise.reject(error);
        }

        const status = error.response?.status;
        const config = error.config as RetriableConfig | undefined;
        if (status !== 429 || !config) {
            this.logRequestError(error);
            return Promise.reject(error);
        }

        const retryCount = (config.__flowwowRetryCount ?? 0) + 1;
        if (retryCount > FlowwowAxiosService.MAX_RETRIES) {
            this.logger.error({
                event: 'flowwow_rate_limit_retries_exhausted',
                method: config.method,
                url: config.url,
                params: config.params,
                retryCount: FlowwowAxiosService.MAX_RETRIES,
                status,
                response: error.response?.data,
            });
            return Promise.reject(error);
        }

        const retryAfterSec = this.getRetryAfterSeconds(error.response?.headers);
        const waitMs = Math.max((retryAfterSec + 1) * 1_000, FlowwowAxiosService.MIN_RETRY_DELAY_MS);
        this.logger.warn({
            event: 'flowwow_rate_limit_retry_scheduled',
            method: config.method,
            url: config.url,
            params: config.params,
            retryCount,
            maxRetries: FlowwowAxiosService.MAX_RETRIES,
            retryAfterSec,
            waitMs,
            rateLimit: {
                limit: error.response?.headers['x-rate-limit-limit'],
                remaining: error.response?.headers['x-rate-limit-remaining'],
                reset: error.response?.headers['x-rate-limit-reset'],
            },
        });

        await this.sleep(waitMs);
        config.__flowwowRetryCount = retryCount;
        return this.http.request(config);
    }

    private logRequestError(error: {
        code?: string;
        message?: string;
        config?: AxiosRequestConfig;
        response?: { status?: number; data?: unknown };
    }): void {
        this.logger.error({
            event: 'flowwow_request_failed',
            status: error.response?.status,
            code: error.code,
            message: error.message,
            method: error.config?.method,
            url: error.config?.url,
            params: error.config?.params,
            response: error.response?.data,
        });
    }

    private getRetryAfterSeconds(headers: Record<string, unknown> | undefined): number {
        const value = headers?.['x-rate-limit-reset'] ?? headers?.['retry-after'];
        const seconds = Number.parseInt(String(value ?? ''), 10);
        if (Number.isFinite(seconds) && seconds > 0) return seconds;

        const retryDate = Date.parse(String(value ?? ''));
        if (Number.isFinite(retryDate)) {
            return Math.max(1, Math.ceil((retryDate - Date.now()) / 1_000));
        }
        return FlowwowAxiosService.FALLBACK_RETRY_AFTER_SEC;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
