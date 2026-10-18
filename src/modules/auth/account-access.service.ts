import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import { AuthSessionService } from './auth-session.service.js';

@Injectable()
export class AccountAccessService {
    public constructor(
        private readonly accounts: AuthRepository,
        private readonly sessions: AuthSessionService
    ) {}

    public authorize(accountIdValue: string | undefined, authorization: string | undefined): string {
        const accountId = this.validateId(accountIdValue);
        const session = this.sessions.verifyAuthorization(authorization);
        if (session.accountId !== accountId) {
            throw new ForbiddenException('Аккаунт запроса не совпадает с аккаунтом сессии');
        }
        return accountId;
    }

    public validateId(value: string | undefined): string {
        if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
            throw new BadRequestException('Заголовок X-Account-Id должен содержать корректный UUID аккаунта');
        }
        return value;
    }

    public async flowwowToken(accountId: string): Promise<string> {
        const account = await this.account(accountId);
        if (!account.flowwowToken) throw new ServiceUnavailableException('Для аккаунта не настроен токен Flowwow');
        return account.flowwowToken;
    }

    public async moyskladToken(accountId: string): Promise<string> {
        const account = await this.account(accountId);
        if (!account.moyskladToken) throw new ServiceUnavailableException('Для аккаунта не настроен токен МойСклад');
        return account.moyskladToken;
    }

    public findAllWithTokens() { return this.accounts.findAllWithTokens(); }

    private async account(accountId: string) {
        const account = await this.accounts.findTokensById(accountId);
        if (!account) throw new NotFoundException('Аккаунт не найден');
        return account;
    }
}
