import { Injectable, Logger } from '@nestjs/common';
import axios, {
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios';

interface RetriableConfig extends InternalAxiosRequestConfig {
    __flowwowRetryCount?: number;
    __flowwowGatewayRetryCount?: number;
    __flowwowTokenKey?: string;
}

interface FlowwowRequestConfig extends AxiosRequestConfig {
    __flowwowTokenKey?: string;
}

@Injectable()
export class FlowwowAxiosService {
    private static readonly TIMEOUT_MS = 90_000;
    private static readonly MAX_RETRIES = 5;
    private static readonly MIN_RETRY_DELAY_MS = 5_000;
    private static readonly FALLBACK_RETRY_AFTER_SEC = 60;
    private static readonly MAX_GATEWAY_RETRIES = 2;

    private readonly logger = new Logger(FlowwowAxiosService.name);
    private readonly http: AxiosInstance;
    private readonly cookiesByToken = new Map<string, Map<string, string>>();

    public constructor() {
        this.http = axios.create({
            baseURL: 'https://apis.flowwow.com',
            timeout: FlowwowAxiosService.TIMEOUT_MS,
            maxRedirects: 0,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        this.registerInterceptors();
    }

    public get<TResponse>(token: string, url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        const requestConfig = this.withToken(token, config);
        this.logRequest('get', url, requestConfig, undefined, token);
        return this.http.get<TResponse>(url, requestConfig);
    }

    public post<TResponse>(token: string, url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        const requestConfig = this.withToken(token, config);
        this.logRequest('post', url, requestConfig, data, token);
        return this.http.post<TResponse>(url, data, requestConfig);
    }

    public request<TResponse>(config: AxiosRequestConfig): Promise<AxiosResponse<TResponse>> {
        return this.http.request<TResponse>(config);
    }

    private withToken(token: string, config?: AxiosRequestConfig): FlowwowRequestConfig {
        const normalizedToken = this.normalizeToken(token);
        const cookie = this.cookieHeader(normalizedToken);
        return {
            ...config,
            __flowwowTokenKey: normalizedToken,
            headers: {
                ...config?.headers,
                Authorization: `Bearer ${normalizedToken}`,
                ...(cookie ? { Cookie: cookie } : {}),
            },
        };
    }

    private normalizeToken(token: string): string {
        return token
            .trim()
            .replace(/^Bearer\s+/i, '')
            .trim()
            .replace(/^(["'])(.*)\1$/, '$2')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, '')
            .trim();
    }

    private logRequest(
        method: string,
        url: string,
        config: AxiosRequestConfig,
        data: unknown,
        originalToken: string
    ): void {
        const token = this.normalizeToken(originalToken);
        const maskedToken = token.length <= 10
            ? '*'.repeat(token.length)
            : `${token.slice(0, 5)}…${token.slice(-5)}`;

        this.logger.log({
            event: 'flowwow_request',
            method,
            url: `${this.http.defaults.baseURL ?? ''}${url}`,
            params: config.params,
            body: data,
            authorization: `Bearer ${maskedToken}`,
            tokenLength: token.length,
        });
    }

    private registerInterceptors(): void {
        this.http.interceptors.response.use(
            (response: AxiosResponse) => {
                const tokenKey = (response.config as RetriableConfig).__flowwowTokenKey;
                this.captureCookies(response.headers, tokenKey);
                return response;
            },
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
        const tokenKey = config?.__flowwowTokenKey;
        const receivedCookies = this.captureCookies(error.response?.headers, tokenKey);

        if (status === 423 && config) {
            const retryCount = (config.__flowwowGatewayRetryCount ?? 0) + 1;
            if (receivedCookies && retryCount <= FlowwowAxiosService.MAX_GATEWAY_RETRIES) {
                const waitMs = retryCount * 1_000;
                config.__flowwowGatewayRetryCount = retryCount;
                config.headers.set('Cookie', this.cookieHeader(tokenKey));
                this.logger.warn({
                    event: 'flowwow_gateway_cookie_retry_scheduled',
                    method: config.method,
                    url: config.url,
                    params: config.params,
                    retryCount,
                    maxRetries: FlowwowAxiosService.MAX_GATEWAY_RETRIES,
                    waitMs,
                    cookieNames: [...this.cookiesFor(tokenKey).keys()],
                });
                await this.sleep(waitMs);
                return this.http.request(config);
            }
        }

        if (status !== 429 || !config) {
            this.logRequestError(error);
            const details = this.responseDetails(error.response?.data);
            if (details) error.message = `${error.message}. Flowwow: ${details}`;
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
        response?: { status?: number; data?: unknown; headers?: unknown };
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
            responseHeaders: error.response?.headers,
        });
    }

    private captureCookies(headers: unknown, tokenKey: string | undefined): boolean {
        if (!tokenKey || !headers || typeof headers !== 'object') return false;
        const source = headers as Record<string, unknown> & { getSetCookie?: () => string[] };
        const setCookie = typeof source.getSetCookie === 'function'
            ? source.getSetCookie()
            : source['set-cookie'];
        const values = Array.isArray(setCookie)
            ? setCookie
            : typeof setCookie === 'string'
                ? [setCookie]
                : [];
        let changed = false;
        const cookies = this.cookiesFor(tokenKey);
        for (const value of values) {
            const pair = value.split(';', 1)[0];
            const separator = pair.indexOf('=');
            if (separator < 1) continue;
            const name = pair.slice(0, separator).trim();
            const cookieValue = pair.slice(separator + 1).trim();
            if (!name) continue;
            if (cookies.get(name) !== cookieValue) changed = true;
            cookies.set(name, cookieValue);
        }
        return changed;
    }

    private cookieHeader(tokenKey: string | undefined): string {
        return [...this.cookiesFor(tokenKey).entries()]
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }

    private cookiesFor(tokenKey: string | undefined): Map<string, string> {
        if (!tokenKey) return new Map<string, string>();
        let cookies = this.cookiesByToken.get(tokenKey);
        if (!cookies) {
            cookies = new Map<string, string>();
            this.cookiesByToken.set(tokenKey, cookies);
        }
        return cookies;
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

    private responseDetails(value: unknown): string | null {
        if (value === undefined || value === null || value === '') return null;
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        return text.length > 500 ? `${text.slice(0, 500)}…` : text;
    }
}
