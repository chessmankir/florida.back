import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SessionPayload { accountId: string; email: string; expiresAt: number; }

@Injectable()
export class AuthSessionService {
    private readonly secret: string;

    public constructor(config: ConfigService) {
        this.secret = config.get<string>('AUTH_SESSION_SECRET')
            ?? config.getOrThrow<string>('POSTGRES_PASSWORD');
    }

    public create(accountId: string, email: string): string {
        const payload = Buffer.from(JSON.stringify({
            accountId,
            email,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        } satisfies SessionPayload)).toString('base64url');
        return `${payload}.${this.sign(payload)}`;
    }

    public verifyAuthorization(value: string | undefined): SessionPayload {
        if (!value?.startsWith('Bearer ')) throw new UnauthorizedException('Требуется авторизация');
        const token = value.slice(7);
        const [payload, signature, extra] = token.split('.');
        if (!payload || !signature || extra || !this.validSignature(payload, signature)) {
            throw new UnauthorizedException('Недействительная сессия');
        }
        try {
            const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
            if (!parsed.accountId || !parsed.email || parsed.expiresAt <= Date.now()) {
                throw new Error('invalid');
            }
            return parsed;
        } catch {
            throw new UnauthorizedException('Недействительная или истёкшая сессия');
        }
    }

    private sign(payload: string): string {
        return createHmac('sha256', this.secret).update(payload).digest('base64url');
    }

    private validSignature(payload: string, signature: string): boolean {
        const expected = Buffer.from(this.sign(payload));
        const received = Buffer.from(signature);
        return expected.length === received.length && timingSafeEqual(expected, received);
    }
}
