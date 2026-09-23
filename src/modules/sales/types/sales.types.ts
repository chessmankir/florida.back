import type { SalesCustomerOrder } from '../models/customerorder.model.js';
import type { SalesCustomerOrderPosition } from '../models/customerorder-position.model.js';
import type { CustomerOrder, CustomerOrderPosition } from './customerorder.types.js';

export type SalesOrderRecord = Omit<SalesCustomerOrder, 'attributes' | 'rawJson'> & {
    attributes: unknown[];
    rawJson: CustomerOrder;
};

export type SalesOrderPositionRecord = Omit<SalesCustomerOrderPosition, 'rawJson'> & {
    rawJson: CustomerOrderPosition;
};

export interface SalesOrderSnapshot {
    order: SalesOrderRecord;
    positions: SalesOrderPositionRecord[];
}
