import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('auth_accounts')
@Index('uq_auth_accounts_email', ['email'], { unique: true })
export class Account {
    @PrimaryGeneratedColumn('uuid') id!: string;
    @Column({ type: 'varchar', length: 320 }) email!: string;
    @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false }) passwordHash!: string;
    @Column({ name: 'flowwow_token', type: 'text', nullable: true, select: false }) flowwowToken!: string | null;
    @Column({ name: 'moysklad_token', type: 'text', nullable: true, select: false }) moyskladToken!: string | null;
    @Column({ name: 'flowwow_order_markup_percent', type: 'numeric', precision: 8, scale: 2, default: 40 }) flowwowOrderMarkupPercent!: string;
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
