import { Db, ClientSession } from 'mongodb';

interface TransactionDocument {
  _id: number;
  functionId?: string;
  paymentId?: string;
  registrationId?: string;
  customerId?: string;
  registrationDate?: Date;
  registrationType?: string;
  paymentDate?: Date;
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
  invoice_object_createdAt?: Date;
  invoice_object_updatedAt?: Date;
  invoice_emailedTo?: string;
  invoice_emailedDateTime?: Date;
  invoice_emailedImpotencyKey?: string;
  invoice_fileName?: string;
  invoice_url?: string;
}

/**
 * Service for creating and managing transaction records with proper session support
 */
export class TransactionServiceAtomic {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get the next sequential transaction ID with session support
   */
  async getNextTransactionId(session?: ClientSession): Promise<number> {
    const options = session ? { session } : {};
    
    const result = await this.db.collection('counters').findOneAndUpdate(
      { _id: 'transaction_sequence' },
      { $inc: { sequence_value: 1 } },
      { 
        upsert: true, 
        returnDocument: 'after',
        projection: { sequence_value: 1 },
        ...options
      }
    );

    return result.sequence_value || 1;
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
    },
    session?: ClientSession
  ): Promise<number[]> {
    const transactionIds: number[] = [];
    const items = invoice.items || [];

    console.log(`Creating transactions for ${items.length} items with session:`, !!session);

    // Create a transaction for each line item
    for (const item of items) {
      const transactionId = await this.createTransaction(
        invoice,
        payment,
        registration,
        item,
        invoiceObjectId,
        emailData,
        session
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
    emailData?: any,
    session?: ClientSession
  ): Promise<number> {
    const transactionId = await this.getNextTransactionId(session);
    console.log(`Creating transaction ${transactionId} for item: ${item.description}`);

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

    // Insert the transaction with session support
    const options = session ? { session } : {};
    await this.db.collection('transactions').insertOne(transaction, options);
    
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
   * Extract payment method from payment object
   */
  private extractPaymentMethod(payment: any): string {
    if (payment?.payment?.method) return payment.payment.method;
    if (payment?.paymentMethod) return payment.paymentMethod;
    if (payment?.cardBrand) return 'credit_card';
    return 'unknown';
  }

  /**
   * Extract last 4 digits of card
   */
  private extractLast4(payment: any): string | undefined {
    return payment?.cardLast4 || payment?.payment?.last4 || payment?.last4;
  }

  /**
   * Extract card brand
   */
  private extractCardBrand(payment: any): string | undefined {
    return payment?.cardBrand || payment?.payment?.cardBrand || payment?.card_brand;
  }
}