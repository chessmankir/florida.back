import { Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Account } from './account.model.js';

export abstract class AccountOwnedEntity {
    @Index()
    @Column({ name: 'account_id', type: 'uuid', nullable: true })
    accountId?: string | null;

    @ManyToOne(() => Account, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'account_id' })
    account?: Account | null;
}
