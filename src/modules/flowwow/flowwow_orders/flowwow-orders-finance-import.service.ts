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

@Injectable()
export class FlowwowOrdersFinanceImportService {
    private static readonly SHOP_ID = 191599;

    public constructor(private readonly repository: FlowwowOrdersRepository) {}

    public async import(file: UploadedFlowwowFinanceFile | undefined): Promise<FlowwowOrdersFinanceImportResult> {
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
        const operationColumn = header.get('Тип операции');
        const amountColumn = header.get('Сумма транзакции');
        if (!orderColumn || !operationColumn || !amountColumn) {
            throw new BadRequestException(
                'В файле обязательны колонки: Номер заказа, Тип операции, Сумма транзакции'
            );
        }

        const orders = new Map<number, Record<FinanceField, number>>();
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
        const result = await this.repository.updateFinanceAmounts(
            FlowwowOrdersFinanceImportService.SHOP_ID,
            financeRows
        );

        return {
            shopId: FlowwowOrdersFinanceImportService.SHOP_ID,
            rowsRead,
            recognizedRows,
            ignoredRows,
            ordersInFile: financeRows.length,
            ...result,
        };
    }

    private operationField(operation: string): FinanceField | null {
        if (operation === 'Оплачено клиентом') return 'customerPaidAmount';
        if (operation === 'Бонусы') return 'bonusAmount';
        if (operation.startsWith('Фиксированная комиссия')) return 'fixedCommissionAmount';
        if (operation.startsWith('Переменная комиссия')) return 'variableCommissionAmount';
        return null;
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
}
