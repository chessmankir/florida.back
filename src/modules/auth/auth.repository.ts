import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Account } from './models/account.model.js';

@Injectable()
export class AuthRepository {
    public constructor(
        @InjectRepository(Account, 'florida') private readonly accounts: Repository<Account>
    ) {}

    public create(data: Pick<Account, 'email' | 'passwordHash' | 'flowwowToken' | 'moyskladToken'>): Promise<Account> {
        return this.accounts.save(this.accounts.create(data));
    }

    public findByEmail(email: string): Promise<Account | null> {
        return this.accounts.findOneBy({ email });
    }

    public findByEmailWithPassword(email: string): Promise<Account | null> {
        return this.accounts.createQueryBuilder('account')
            .addSelect('account.passwordHash')
            .where('account.email = :email', { email })
            .getOne();
    }

    public findTokensById(accountId: string): Promise<Account | null> {
        return this.accounts.createQueryBuilder('account')
            .addSelect(['account.flowwowToken', 'account.moyskladToken', 'account.flowwowOrderMarkupPercent'])
            .where('account.id = :accountId', { accountId })
            .getOne();
    }

    public findAllWithTokens(): Promise<Account[]> {
        return this.accounts.createQueryBuilder('account')
            .addSelect(['account.flowwowToken', 'account.moyskladToken'])
            .orderBy('account.createdAt', 'ASC')
            .getMany();
    }

    public existsByEmail(email: string): Promise<boolean> {
        return this.accounts.existsBy({ email });
    }

    public async updateTokens(
        accountId: string,
        tokens: Partial<Pick<Account, 'flowwowToken' | 'moyskladToken' | 'flowwowOrderMarkupPercent'>>
    ): Promise<boolean> {
        const result = await this.accounts.update({ id: accountId }, tokens);
        return (result.affected ?? 0) > 0;
    }
}
