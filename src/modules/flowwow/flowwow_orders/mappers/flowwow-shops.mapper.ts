import { BadGatewayException, Injectable } from '@nestjs/common';

import type { FlowwowRemoteShop, FlowwowShopSnapshot } from '../types/flowwow-orders.types.js';

@Injectable()
export class FlowwowShopsMapper {
    public mapSnapshot(remote: FlowwowRemoteShop, syncedAt: Date): FlowwowShopSnapshot {
        if (!Number.isInteger(remote.shopId) || remote.shopId <= 0 || typeof remote.name !== 'string') {
            throw new BadGatewayException('Flowwow вернул некорректный магазин');
        }

        return {
            shopId: remote.shopId,
            name: remote.name,
            status: remote.status,
            address: typeof remote.address === 'string' ? remote.address : null,
            currency: typeof remote.currency === 'string' ? remote.currency : null,
            isVerified: typeof remote.isVerified === 'boolean' ? remote.isVerified : null,
            workingDays: Array.isArray(remote.workingDays)
                ? remote.workingDays.filter((day): day is string => typeof day === 'string')
                : [],
            rawJson: remote,
            syncedAt,
        };
    }
}
