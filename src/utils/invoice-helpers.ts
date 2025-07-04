import { Invoice, InvoiceItem, InvoiceBillTo, InvoicePayment } from '../types/invoice';
import { DEFAULT_INVOICE_SUPPLIER } from '../constants/invoice';
import { InvoiceSequence } from './invoice-sequence';
import { Db } from 'mongodb';

interface CreateInvoiceParams {
  invoiceNumber?: string; // Made optional - will auto-generate if not provided
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

export function createInvoice(params: CreateInvoiceParams): Invoice {
  const { items } = params;
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Calculate processing fees (2.5% of subtotal as example)
  const processingFees = Math.round(subtotal * 0.025 * 100) / 100;
  
  // Calculate GST (10% of subtotal + fees)
  const totalBeforeGST = subtotal + processingFees;
  const gstIncluded = Math.round(totalBeforeGST * 0.10 * 100) / 100;
  
  // Total
  const total = Math.round((subtotal + processingFees) * 100) / 100;
  
  return {
    invoiceNumber: params.invoiceNumber || '', // Will be set by createInvoiceWithSequence if not provided
    date: params.date,
    status: params.status,
    supplier: DEFAULT_INVOICE_SUPPLIER,
    billTo: params.billTo,
    items: params.items,
    subtotal,
    processingFees,
    gstIncluded,
    total,
    payment: params.payment,
    paymentId: params.paymentId,
    registrationId: params.registrationId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export async function createInvoiceWithSequence(params: CreateInvoiceWithSequenceParams): Promise<Invoice> {
  const { db, ...invoiceParams } = params;
  
  // Generate invoice number if not provided
  if (!invoiceParams.invoiceNumber) {
    const invoiceSequence = new InvoiceSequence(db);
    invoiceParams.invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
  }
  
  return createInvoice(invoiceParams);
}

export function calculateInvoiceTotals(items: InvoiceItem[]) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const processingFees = Math.round(subtotal * 0.025 * 100) / 100;
  const totalBeforeGST = subtotal + processingFees;
  const gstIncluded = Math.round(totalBeforeGST * 0.10 * 100) / 100;
  const total = Math.round((subtotal + processingFees) * 100) / 100;
  
  return {
    subtotal,
    processingFees,
    gstIncluded,
    total
  };
}