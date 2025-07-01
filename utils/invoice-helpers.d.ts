import { Invoice, InvoiceItem, InvoiceBillTo, InvoicePayment } from '../types/invoice';
import { Db } from 'mongodb';
interface CreateInvoiceParams {
    invoiceNumber?: string;
    date: Date;
    status: Invoice['status'];
    billTo: InvoiceBillTo;
    items: InvoiceItem[];
    payment?: InvoicePayment;
    paymentId?: string;
    registrationId?: string;
}
interface CreateInvoiceWithSequenceParams extends CreateInvoiceParams {
    db: Db;
}
export declare function createInvoice(params: CreateInvoiceParams): Invoice;
export declare function createInvoiceWithSequence(params: CreateInvoiceWithSequenceParams): Promise<Invoice>;
export declare function calculateInvoiceTotals(items: InvoiceItem[]): {
    subtotal: number;
    processingFees: number;
    gstIncluded: number;
    total: number;
};
export {};
//# sourceMappingURL=invoice-helpers.d.ts.map