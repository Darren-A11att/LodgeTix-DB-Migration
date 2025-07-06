import { Db } from 'mongodb';
import { TransactionSequence } from '@/utils/transaction-sequence';

interface TransactionDocument {
  _id: number;
  functionId?: string;
  paymentId?: string;
  registrationId?: string;
  customerId?: string;
  registrationDate?: Date | string;
  registrationType?: string;
  paymentDate?: Date | string;
  paymentStatus?: string;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  invoiceDueDate?: Date | string;
  invoiceType?: string;
  billTo_businessName?: string;
  billTo_businessNumber?: string;
  billTo_firstName?: string;
  billTo_lastName?: string;
  billTo_email?: string;
  billTo_phone?: string;
  billTo_addressLine1?: string;
  billTo_addressLine2?: string;
  billTo_city?: string;
  billTo_postalCode?: string;
  billTo_stateProvince?: string;
  supplier_name?: string;
  supplier_abn?: string;
  supplier_address?: string;
  supplier_issuedBy?: string;
  item_description?: string;
  item_quantity?: number;
  item_price?: number;
  invoice_subtotal?: number;
  invoice_processingFees?: number;
  invoice_total?: number;
  payment_method?: string;
  payment_transactionId?: string;
  payment_paidDate?: Date | string;
  payment_amount?: number;
  payment_currency?: string;
  payment_status?: string;
  payment_source?: string;
  payment_last4?: string;
  payment_cardBrand?: string;
  registration_objectId?: string;
  payment_objectId?: string;
  invoice_objectId?: string;
  invoice_object_createdAt?: Date | string;
  invoice_object_updatedAt?: Date | string;
  invoice_emailedTo?: string;
  invoice_emailedDateTime?: Date | string;
  invoice_emailedImpotencyKey?: string;
  invoice_fileName?: string;
  invoice_url?: string;
}

export class TransactionService {
  private db: Db;
  private sequence: TransactionSequence;

  constructor(db: Db) {
    this.db = db;
    this.sequence = new TransactionSequence(db);
  }

  /**
   * Create transaction documents for all line items in an invoice
   */
  async createTransactionsFromInvoice(
    invoice: any,
    payment: any,
    registration: any,
    invoiceObjectId: string,
    emailData?: {
      emailedTo?: string;
      emailedDateTime?: Date;
      emailedImpotencyKey?: string;
    }
  ): Promise<number[]> {
    const transactionIds: number[] = [];
    const items = invoice.items || [];

    // Create a transaction for each line item
    for (const item of items) {
      const transactionId = await this.createTransaction(
        invoice,
        payment,
        registration,
        item,
        invoiceObjectId,
        emailData
      );
      transactionIds.push(transactionId);
    }

    return transactionIds;
  }

  /**
   * Create a single transaction document
   */
  private async createTransaction(
    invoice: any,
    payment: any,
    registration: any,
    item: any,
    invoiceObjectId: string,
    emailData?: any
  ): Promise<number> {
    const transactionId = await this.sequence.getNextTransactionId();

    const transaction: TransactionDocument = {
      _id: transactionId,
      
      // Function and IDs
      functionId: registration?.functionId || registration?.registrationData?.functionId,
      paymentId: payment?.paymentId || payment?.transactionId,
      registrationId: registration?.registrationId || registration?.confirmationNumber,
      customerId: registration?.customerId || payment?.customerId,
      
      // Registration fields
      registrationDate: registration?.registrationDate || registration?.createdAt,
      registrationType: registration?.registrationType || registration?.registrationData?.registrationType,
      
      // Payment fields
      paymentDate: payment?.timestamp || payment?.createdAt,
      paymentStatus: payment?.status || payment?.paymentStatus || 'paid',
      
      // Invoice fields
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date || invoice.createdAt,
      invoiceDueDate: invoice.dueDate,
      invoiceType: invoice.invoiceType,
      
      // Bill To fields (flattened)
      billTo_businessName: invoice.billTo?.businessName,
      billTo_businessNumber: invoice.billTo?.businessNumber,
      billTo_firstName: invoice.billTo?.firstName,
      billTo_lastName: invoice.billTo?.lastName,
      billTo_email: invoice.billTo?.email,
      billTo_phone: invoice.billTo?.phone,
      billTo_addressLine1: invoice.billTo?.addressLine1,
      billTo_addressLine2: invoice.billTo?.addressLine2,
      billTo_city: invoice.billTo?.city,
      billTo_postalCode: invoice.billTo?.postalCode,
      billTo_stateProvince: invoice.billTo?.stateProvince,
      
      // Supplier fields (flattened) - check both supplier and billFrom
      supplier_name: invoice.supplier?.name || invoice.billFrom?.name,
      supplier_abn: invoice.supplier?.abn || invoice.billFrom?.abn,
      supplier_address: invoice.supplier?.address || invoice.billFrom?.address,
      supplier_issuedBy: invoice.supplier?.issuedBy || invoice.billFrom?.issuedBy || invoice.issuedBy,
      
      // Item fields
      item_description: item.description || item.name,
      item_quantity: item.quantity || 1,
      item_price: this.extractNumericValue(item.price),
      
      // Invoice totals
      invoice_subtotal: this.extractNumericValue(invoice.subtotal),
      invoice_processingFees: this.extractNumericValue(invoice.processingFees),
      invoice_total: this.extractNumericValue(invoice.total),
      
      // Payment method details
      payment_method: this.extractPaymentMethod(payment),
      payment_transactionId: payment?.transactionId || payment?.paymentId,
      payment_paidDate: payment?.timestamp || payment?.createdAt,
      payment_amount: this.extractNumericValue(payment?.amount || payment?.grossAmount),
      payment_currency: payment?.currency || 'AUD',
      payment_status: payment?.status || payment?.paymentStatus || 'paid',
      payment_source: payment?.source || payment?.paymentSource,
      payment_last4: this.extractLast4(payment),
      payment_cardBrand: this.extractCardBrand(payment),
      
      // Object IDs
      registration_objectId: registration?._id?.toString(),
      payment_objectId: payment?._id?.toString(),
      invoice_objectId: invoiceObjectId,
      invoice_object_createdAt: invoice.createdAt || new Date(),
      invoice_object_updatedAt: invoice.updatedAt || new Date(),
      
      // Email tracking fields (from invoice.email object or legacy fields)
      invoice_emailedTo: invoice.email?.to || invoice.emailedTo || emailData?.emailedTo,
      invoice_emailedDateTime: invoice.email?.sent || invoice.emailedDateTime || emailData?.emailedDateTime,
      invoice_emailedImpotencyKey: invoice.email?.idempotencyKey || invoice.emailedImpotencyKey || emailData?.emailedImpotencyKey,
      
      // File fields (to be populated later if needed)
      invoice_fileName: undefined,
      invoice_url: undefined
    };

    // Insert the transaction
    await this.db.collection('transactions').insertOne(transaction);
    
    return transactionId;
  }

  /**
   * Extract numeric value from various formats (Decimal128, number, string)
   */
  private extractNumericValue(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (value.$numberDecimal) return parseFloat(value.$numberDecimal);
    return undefined;
  }

  /**
   * Extract payment method from payment data
   */
  private extractPaymentMethod(payment: any): string | undefined {
    if (payment?.paymentMethod) return payment.paymentMethod;
    if (payment?.method) return payment.method;
    if (payment?.source?.toLowerCase().includes('stripe')) return 'card';
    if (payment?.source?.toLowerCase().includes('paypal')) return 'paypal';
    if (payment?.cardBrand || payment?.last4) return 'card';
    return payment?.source || 'unknown';
  }

  /**
   * Extract last 4 digits of card from payment
   */
  private extractLast4(payment: any): string | undefined {
    if (payment?.last4) return payment.last4;
    if (payment?.cardLast4) return payment.cardLast4;
    // Try to extract from payment method details
    if (payment?.paymentMethodDetails?.card?.last4) {
      return payment.paymentMethodDetails.card.last4;
    }
    return undefined;
  }

  /**
   * Extract card brand from payment
   */
  private extractCardBrand(payment: any): string | undefined {
    if (payment?.cardBrand) return payment.cardBrand;
    if (payment?.brand) return payment.brand;
    // Try to extract from payment method details
    if (payment?.paymentMethodDetails?.card?.brand) {
      return payment.paymentMethodDetails.card.brand;
    }
    return undefined;
  }

  /**
   * Update transaction email fields after email is sent
   */
  async updateTransactionEmailData(
    invoiceObjectId: string,
    emailData: {
      emailedTo: string;
      emailedDateTime: Date;
      emailedImpotencyKey: string;
    }
  ): Promise<void> {
    await this.db.collection('transactions').updateMany(
      { invoice_objectId: invoiceObjectId },
      { 
        $set: {
          invoice_emailedTo: emailData.emailedTo,
          invoice_emailedDateTime: emailData.emailedDateTime,
          invoice_emailedImpotencyKey: emailData.emailedImpotencyKey
        }
      }
    );
  }
}