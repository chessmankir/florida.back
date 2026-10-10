import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import { FlowwowOrdersRepository } from './flowwow-orders.repository.js';
import type {
    FlowwowOrderFinanceAmounts,
    FlowwowOrdersFinanceImportResult,
} from './types/flowwow-orders.types.js';

export interface UploadedFlowwowFinanceFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

type FinanceField = Exclude<keyof FlowwowOrderFinanceAmounts, 'orderId'>;

interface ImportedOrderMetadata {
    paidAt: Date;
    deliveryAt: Date;
}

@Injectable()
export class FlowwowOrdersFinanceImportService {
    public constructor(
        private readonly repository: FlowwowOrdersRepository
    ) {}

    public async import(
        file: UploadedFlowwowFinanceFile | undefined,
        shopIdValue?: string
    ): Promise<FlowwowOrdersFinanceImportResult> {
        const shopId = this.shopId(shopIdValue);
        if (!file?.buffer?.length) throw new BadRequestException('Передайте XLSX-файл в поле file');
        if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
            throw new BadRequestException('Поддерживаются только файлы .xlsx');
        }

        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(
                file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
            );
        } catch {
            throw new BadRequestException('Не удалось прочитать XLSX-файл');
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) throw new BadRequestException('В XLSX-файле нет листов');

        const header = new Map<string, number>();
        worksheet.getRow(1).eachCell((cell, column) => header.set(cell.text.trim(), column));
        const orderColumn = header.get('Номер заказа');
        const paidAtColumn = header.get('Дата оплаты заказа');
        const deliveryAtColumn = header.get('Дата доставки заказа');
        const operationColumn = header.get('Тип операции');
        const amountColumn = header.get('Сумма транзакции');
        if (!orderColumn || !paidAtColumn || !deliveryAtColumn || !operationColumn || !amountColumn) {
            throw new BadRequestException(
                'В файле обязательны колонки: Номер заказа, Дата оплаты заказа, Дата доставки заказа, Тип операции, Сумма транзакции'
            );
        }

        const orders = new Map<number, Record<FinanceField, number>>();
        const metadata = new Map<number, ImportedOrderMetadata>();
        let recognizedRows = 0;
        let ignoredRows = 0;
        const rowsRead = Math.max(0, worksheet.actualRowCount - 1);

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const field = this.operationField(row.getCell(operationColumn).text.trim());
            if (!field) {
                ignoredRows++;
                return;
            }

            const orderId = this.orderId(row.getCell(orderColumn).value, rowNumber);
            const amount = this.amountInKopecks(row.getCell(amountColumn).value, rowNumber);
            if (!metadata.has(orderId)) {
                const paidAt = this.date(row.getCell(paidAtColumn).value, rowNumber, 'оплаты');
                const deliveryAt = this.optionalDate(row.getCell(deliveryAtColumn).value, rowNumber, 'доставки') ?? paidAt;
                metadata.set(orderId, { paidAt, deliveryAt });
            }
            const totals = orders.get(orderId) ?? {
                customerPaidAmount: 0,
                bonusAmount: 0,
                fixedCommissionAmount: 0,
                variableCommissionAmount: 0,
            };
            totals[field] += amount;
            orders.set(orderId, totals);
            recognizedRows++;
        });

        const financeRows: FlowwowOrderFinanceAmounts[] = [...orders.entries()].map(([orderId, totals]) => ({
            orderId,
            customerPaidAmount: this.fromKopecks(totals.customerPaidAmount),
            bonusAmount: this.fromKopecks(totals.bonusAmount),
            fixedCommissionAmount: this.fromKopecks(totals.fixedCommissionAmount),
            variableCommissionAmount: this.fromKopecks(totals.variableCommissionAmount),
        }));
        const existingResult = await this.repository.updateFinanceAmounts(
            shopId,
            financeRows
        );
        let createdOrders = 0;
        for (const orderId of existingResult.missingOrderIds) {
            const finance = financeRows.find((row) => row.orderId === orderId);
            const dates = metadata.get(orderId);
            if (!finance || !dates || Number(finance.customerPaidAmount) <= 0) continue;

            const syncedAt = new Date();
            await this.repository.saveChunk([{
                order: {
                    shopId,
                    orderId,
                    status: 3,
                    deliveryType: 0,
                    deliveryTimeType: 0,
                    createdAtSource: dates.paidAt,
                    deliveryDateFrom: dates.deliveryAt,
                    deliveryDateTo: dates.deliveryAt,
                    grossProductAmount: finance.customerPaidAmount,
                    customerPaidAmount: finance.customerPaidAmount,
                    bonusAmount: finance.bonusAmount,
                    fixedCommissionAmount: finance.fixedCommissionAmount,
                    variableCommissionAmount: finance.variableCommissionAmount,
                    sourceHost: 'finance-xlsx',
                    rawJson: {
                        source: 'flowwow-finance-xlsx',
                        orderId,
                        paidAt: dates.paidAt.toISOString(),
                        deliveryAt: dates.deliveryAt.toISOString(),
                    } as never,
                    syncedAt,
                },
                positions: [],
            }]);
            createdOrders++;
        }
        const missingRows = financeRows.filter((row) =>
            existingResult.missingOrderIds.includes(row.orderId)
        );
        const createdResult = await this.repository.updateFinanceAmounts(
            shopId,
            missingRows
        );

        return {
            shopId,
            rowsRead,
            recognizedRows,
            ignoredRows,
            ordersInFile: financeRows.length,
            createdOrders,
            updatedOrders: existingResult.updatedOrders + createdResult.updatedOrders,
            missingOrderIds: createdResult.missingOrderIds,
        };
    }

    private operationField(operation: string): FinanceField | null {
        if (operation === 'Оплачено клиентом') return 'customerPaidAmount';
        if (operation === 'Бонусы') return 'bonusAmount';
        if (operation.startsWith('Фиксированная комиссия')) return 'fixedCommissionAmount';
        if (operation.startsWith('Переменная комиссия')) return 'variableCommissionAmount';
        return null;
    }

    private shopId(value: string | undefined): number {
        if (!value || !/^\d+$/.test(value)) {
            throw new BadRequestException('Параметр shopId обязателен');
        }
        const result = Number(value);
        if (!Number.isSafeInteger(result) || result < 1) {
            throw new BadRequestException('Параметр shopId должен быть положительным целым числом');
        }
        return result;
    }

    private orderId(value: ExcelJS.CellValue, rowNumber: number): number {
        const parsed = Number(typeof value === 'object' && value && 'result' in value ? value.result : value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            throw new BadRequestException(`Некорректный номер заказа в строке ${rowNumber}`);
        }
        return parsed;
    }

    private amountInKopecks(value: ExcelJS.CellValue, rowNumber: number): number {
        const source = typeof value === 'object' && value && 'result' in value ? value.result : value;
        const normalized = typeof source === 'string'
            ? source.replace(/\s/g, '').replace(',', '.')
            : source;
        const amount = Number(normalized);
        if (!Number.isFinite(amount)) {
            throw new BadRequestException(`Некорректная сумма транзакции в строке ${rowNumber}`);
        }
        const kopecks = Math.round(amount * 100);
        if (!Number.isSafeInteger(kopecks)) {
            throw new BadRequestException(`Слишком большая сумма транзакции в строке ${rowNumber}`);
        }
        return kopecks;
    }

    private fromKopecks(value: number): string {
        const sign = value < 0 ? '-' : '';
        const absolute = Math.abs(value);
        return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
    }

    private optionalDate(value: ExcelJS.CellValue, rowNumber: number, label: string): Date | null {
        const source = typeof value === 'object' && value && 'result' in value ? value.result : value;
        if (source == null || source === '') return null;
        return this.date(source, rowNumber, label);
    }

    private date(value: ExcelJS.CellValue, rowNumber: number, label: string): Date {
        const source = typeof value === 'object' && value && 'result' in value ? value.result : value;
        if (source instanceof Date && !Number.isNaN(source.getTime())) return source;
        if (typeof source !== 'string') {
            throw new BadRequestException(`Некорректная дата ${label} в строке ${rowNumber}`);
        }
        const match = source.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (!match) throw new BadRequestException(`Некорректная дата ${label} в строке ${rowNumber}`);
        const [, day, month, year, hours, minutes, seconds] = match;
        const result = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`);
        if (Number.isNaN(result.getTime())) {
            throw new BadRequestException(`Некорректная дата ${label} в строке ${rowNumber}`);
        }
        return result;
    }
}
