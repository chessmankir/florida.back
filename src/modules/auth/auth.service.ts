import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AuthPasswordService } from './auth-password.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthSessionService } from './auth-session.service.js';

export interface AuthAccountResponse { accountId: string; email: string; sessionToken: string; }
export interface AuthAccountLookupResponse { accountId: string; email: string; }
export interface AuthTokensResponse { saved: true; }
export interface AuthTokensDataResponse { flowwowToken: string | null; moyskladToken: string | null; flowwowOrderMarkupPercent: number; }

@Injectable()
export class AuthService {
    public constructor(
        private readonly repository: AuthRepository,
        private readonly passwords: AuthPasswordService,
        private readonly sessions: AuthSessionService
    ) {}

    public async register(body: unknown): Promise<AuthAccountResponse> {
        const input = this.credentials(body, true);
        if (await this.repository.existsByEmail(input.email)) {
            throw new ConflictException('Аккаунт с такой почтой уже зарегистрирован');
        }
        try {
            const account = await this.repository.create({
                email: input.email,
                passwordHash: await this.passwords.hash(input.password),
                flowwowToken: input.flowwowToken,
                moyskladToken: input.moyskladToken,
            });
            return this.accountResponse(account.id, account.email);
        } catch (error: unknown) {
            if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
                throw new ConflictException('Аккаунт с такой почтой уже зарегистрирован');
            }
            throw error;
        }
    }

    public async login(body: unknown): Promise<AuthAccountResponse> {
        const input = this.credentials(body, false);
        const account = await this.repository.findByEmailWithPassword(input.email);
        if (!account || !(await this.passwords.verify(input.password, account.passwordHash))) {
            throw new UnauthorizedException('Неверная почта или пароль');
        }
        return this.accountResponse(account.id, account.email);
    }

    public async registered(emailValue: unknown): Promise<{ email: string; registered: boolean }> {
        const email = this.email(emailValue);
        return { email, registered: await this.repository.existsByEmail(email) };
    }

    public async accountId(emailValue: unknown): Promise<AuthAccountLookupResponse> {
        const email = this.email(emailValue);
        const account = await this.repository.findByEmail(email);
        if (!account) throw new NotFoundException('Аккаунт не зарегистрирован');
        return { accountId: account.id, email: account.email };
    }

    public async updateTokens(authorization: string | undefined, body: unknown): Promise<AuthTokensResponse> {
        const session = this.sessions.verifyAuthorization(authorization);
        if (!body || typeof body !== 'object') throw new BadRequestException('Тело запроса обязательно');
        const value = body as Record<string, unknown>;
        const tokens: { flowwowToken?: string; moyskladToken?: string; flowwowOrderMarkupPercent?: string } = {};
        const flowwowToken = this.optionalToken(value.flowwowToken, 'flowwowToken');
        const moyskladToken = this.optionalToken(value.moyskladToken, 'moyskladToken');
        if (flowwowToken) tokens.flowwowToken = flowwowToken;
        if (moyskladToken) tokens.moyskladToken = moyskladToken;
        if (value.flowwowOrderMarkupPercent !== undefined) {
            const percent = Number(value.flowwowOrderMarkupPercent);
            if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
                throw new BadRequestException('Процент на заказ Flowwow должен быть числом от 0 до 1000');
            }
            tokens.flowwowOrderMarkupPercent = percent.toFixed(2);
        }
        if (Object.keys(tokens).length === 0) throw new BadRequestException('Введите хотя бы один токен');
        const updated = await this.repository.updateTokens(session.accountId, tokens);
        if (!updated) throw new NotFoundException('Аккаунт не найден');
        return { saved: true };
    }

    public async getTokens(
        authorization: string | undefined,
        accountIdValue: unknown
    ): Promise<AuthTokensDataResponse> {
        const session = this.sessions.verifyAuthorization(authorization);
        if (typeof accountIdValue !== 'string' || accountIdValue !== session.accountId) {
            throw new UnauthorizedException('Аккаунт не соответствует текущей сессии');
        }
        const account = await this.repository.findTokensById(accountIdValue);
        if (!account) throw new NotFoundException('Аккаунт не найден');
        return {
            flowwowToken: account.flowwowToken,
            moyskladToken: account.moyskladToken,
            flowwowOrderMarkupPercent: Number(account.flowwowOrderMarkupPercent ?? 40),
        };
    }

    private accountResponse(accountId: string, email: string): AuthAccountResponse {
        return { accountId, email, sessionToken: this.sessions.create(accountId, email) };
    }

    private credentials(body: unknown, withTokens: boolean) {
        if (!body || typeof body !== 'object') throw new BadRequestException('Тело запроса обязательно');
        const value = body as Record<string, unknown>;
        if (typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 128) {
            throw new BadRequestException('Пароль должен содержать от 8 до 128 символов');
        }
        return {
            email: this.email(value.email),
            password: value.password,
            flowwowToken: withTokens ? this.optionalToken(value.flowwowToken, 'flowwowToken') : null,
            moyskladToken: withTokens ? this.optionalToken(value.moyskladToken, 'moyskladToken') : null,
        };
    }

    private email(value: unknown): string {
        if (typeof value !== 'string') throw new BadRequestException('email обязателен');
        const email = value.trim().toLowerCase();
        if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new BadRequestException('Некорректный email');
        }
        return email;
    }

    private optionalToken(value: unknown, field: string): string | null {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value !== 'string' || value.trim().length > 4096) {
            throw new BadRequestException(`${field} должен быть строкой длиной до 4096 символов`);
        }
        return value.trim();
    }
}
