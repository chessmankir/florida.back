import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('sales_customer_orders')
export class SalesCustomerOrder {
    @PrimaryColumn('uuid') id: string;
    @Column('text') number: string;
    @Column({ name: 'external_code', type: 'text', nullable: true }) externalCode: string | null;
    @Column({ name: 'created_at_source', type: 'varchar', nullable: true }) createdAtSource: string | null;
    @Column({ name: 'document_at', type: 'varchar' }) documentAt: string;
    @Column({ name: 'source_updated_at', type: 'varchar' }) sourceUpdatedAt: string;
    @Column({ name: 'is_posted', type: 'boolean' }) isPosted: boolean;
    @Column({ name: 'state_id', type: 'uuid', nullable: true }) stateId: string | null;
    @Column({ name: 'customer_id', type: 'uuid', nullable: true }) customerId: string | null;
    @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId: string | null;
    @Column({ name: 'store_id', type: 'uuid', nullable: true }) storeId: string | null;
    @Column({ name: 'owner_id', type: 'uuid', nullable: true }) ownerId: string | null;
    @Column({ name: 'currency_id', type: 'uuid', nullable: true }) currencyId: string | null;
    @Column({ name: 'exchange_rate', type: 'numeric', nullable: true }) exchangeRate: string | null;
    @Column({ name: 'sum_minor', type: 'numeric', precision: 20, scale: 4 }) sumMinor: string;
    @Column({ name: 'paid_sum_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) paidSumMinor: string | null;
    @Column({ name: 'shipped_sum_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) shippedSumMinor: string | null;
    @Column({ name: 'invoiced_sum_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) invoicedSumMinor: string | null;
    @Column({ name: 'reserved_sum_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) reservedSumMinor: string | null;
    @Column({ name: 'vat_enabled', type: 'boolean', nullable: true }) vatEnabled: boolean | null;
    @Column({ name: 'vat_included', type: 'boolean', nullable: true }) vatIncluded: boolean | null;
    @Column({ name: 'vat_sum_minor', type: 'numeric', precision: 20, scale: 4, nullable: true }) vatSumMinor: string | null;
    @Column({ type: 'text', nullable: true }) description: string | null;
    @Column({ type: 'jsonb' }) attributes: unknown;
    @Column({ name: 'document_links', type: 'jsonb' }) documentLinks: { type: string; id: string | null }[];
    @Column({ name: 'raw_json', type: 'jsonb' }) rawJson: unknown;
    @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt: Date;
}
