import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FlowwowCommissionCalculation {
    price: number;
    rates: {
        fixedCommissionPercent: number;
        variableCommissionPercent: number;
        customerBonusPercent: number;
        vatMultiplier: number;
    };
    fixedCommission: number;
    variableCommission: number;
    customerBonus: number;
    flowwowExpenses: number;
}

@Injectable()
export class FlowwowCommissionService {
    private static readonly VAT_MULTIPLIER = 1.22;

    private readonly fixedCommissionPercent: number;
    private readonly variableCommissionPercent: number;
    private readonly customerBonusPercent: number;

    public constructor(config: ConfigService) {
        this.fixedCommissionPercent = config.get<number>('FLOWWOW_FIXED_COMMISSION_PERCENT', 27);
        this.variableCommissionPercent = config.get<number>('FLOWWOW_VARIABLE_COMMISSION_PERCENT', 2.5);
        this.customerBonusPercent = config.get<number>('FLOWWOW_CUSTOMER_BONUS_PERCENT', 4);
    }

    public calculate(priceValue: unknown): FlowwowCommissionCalculation {
        const price = typeof priceValue === 'number' ? priceValue : Number(priceValue);
        if (!Number.isFinite(price) || price < 0) {
            throw new BadRequestException('price должен быть неотрицательным числом');
        }

        const normalizedPrice = this.money(price);
        const fixedCommission = this.money(
            normalizedPrice * this.toRate(this.fixedCommissionPercent) * FlowwowCommissionService.VAT_MULTIPLIER
        );
        const variableCommission = this.money(
            normalizedPrice * this.toRate(this.variableCommissionPercent) * FlowwowCommissionService.VAT_MULTIPLIER
        );
        const customerBonus = this.money(normalizedPrice * this.toRate(this.customerBonusPercent));

        return {
            price: normalizedPrice,
            rates: {
                fixedCommissionPercent: this.fixedCommissionPercent,
                variableCommissionPercent: this.variableCommissionPercent,
                customerBonusPercent: this.customerBonusPercent,
                vatMultiplier: FlowwowCommissionService.VAT_MULTIPLIER,
            },
            fixedCommission,
            variableCommission,
            customerBonus,
            flowwowExpenses: this.money(fixedCommission + variableCommission + customerBonus),
        };
    }

    private toRate(percent: number): number {
        return percent / 100;
    }

    private money(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }
}
