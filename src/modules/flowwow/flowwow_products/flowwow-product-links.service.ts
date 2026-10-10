import { BadRequestException, Injectable } from '@nestjs/common';

import { FlowwowProductLinksRepository, type LinkedInventoryBundle } from './flowwow-product-links.repository.js';

@Injectable()
export class FlowwowProductLinksService {
    public constructor(private readonly repository: FlowwowProductLinksRepository) {}

    public get(shopIdValue: string | undefined, productIdValue: string | undefined): Promise<LinkedInventoryBundle | null> {
        return this.repository.find(
            this.positiveInteger(shopIdValue, 'shopId'),
            this.positiveInteger(productIdValue, 'productId')
        );
    }

    public async save(body: unknown): Promise<{ shopId: number; productId: number; bundle: LinkedInventoryBundle }> {
        if (!body || typeof body !== 'object') throw new BadRequestException('Передайте JSON-тело');
        const source = body as Record<string, unknown>;
        const shopId = this.positiveInteger(String(source.shopId ?? ''), 'shopId');
        const productId = this.positiveInteger(String(source.productId ?? ''), 'productId');
        const bundleId = String(source.bundleId ?? '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bundleId)) {
            throw new BadRequestException('bundleId должен быть корректным UUID');
        }
        if (!(await this.repository.existsInInventory(bundleId))) {
            throw new BadRequestException('Товар с таким bundleId не найден в каталоге МойСклад');
        }
        await this.repository.replace(shopId, productId, bundleId);
        const bundle = await this.repository.find(shopId, productId);
        if (!bundle) throw new BadRequestException('Не удалось сохранить связь с букетом');
        return { shopId, productId, bundle };
    }

    private positiveInteger(value: string | undefined, field: string): number {
        if (!value || !/^\d+$/.test(value)) throw new BadRequestException(`${field} обязателен`);
        const result = Number(value);
        if (!Number.isSafeInteger(result) || result < 1) throw new BadRequestException(`${field} некорректен`);
        return result;
    }
}
