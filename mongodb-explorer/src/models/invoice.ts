import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Invoice Schema Type Definitions
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'square' | 'cash' | 'check' | 'other';
export type InvoiceType = 'standard' | 'recurring' | 'credit_note' | 'proforma';

export interface InvoiceLineItem {
  id: string;
  description: string;
  productId?: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // Amount or percentage
  discountType?: 'amount' | 'percentage';
  tax?: number; // Tax amount for this line
  taxRate?: number; // Tax rate as decimal (0.10 = 10%)
  subtotal: number; // quantity * unitPrice - discount
  total: number; // subtotal + tax
}

export interface BillingDetails {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  postCode: string;
  country: string;
  taxId?: string; // Customer's tax ID
}

export interface PaymentDetails {
  method: PaymentMethod;
  reference?: string; // Transaction ID, check number, etc.
  paidAt?: Date;
  amount: number;
  fees?: number;
  notes?: string;
}

export interface PaymentHistory {
  id: string;
  date: Date;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface Invoice {
  invoiceId: string; // UUID v4
  invoiceNumber: string; // Human-readable number (e.g., INV-2024-001)
  type: InvoiceType;
  status: InvoiceStatus;
  customerId: string;
  vendorId: string;
  orderId?: string; // Link to order if invoice is from an order
  billingDetails: BillingDetails;
  issueDate: Date;
  dueDate: Date;
  terms?: string; // Payment terms text
  lineItems: InvoiceLineItem[];
  subtotal: number; // Sum of all line item subtotals
  discountTotal: number; // Total discounts applied
  taxTotal: number; // Total tax
  shippingFee?: number;
  total: number; // Final amount due
  amountPaid: number; // Amount paid so far
  amountDue: number; // Remaining amount (total - amountPaid)
  currency: string; // ISO currency code (e.g., 'USD', 'AUD')
  exchangeRate?: number; // If multi-currency
  paymentDetails?: PaymentDetails;
  paymentHistory: PaymentHistory[];
  notes?: string; // Invoice notes
  internalNotes?: string; // Internal notes (not shown to customer)
  attachments?: string[]; // URLs to attached files
  sentAt?: Date;
  viewedAt?: Date;
  paidAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateInvoice(invoice: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!invoice.invoiceId || typeof invoice.invoiceId !== 'string') {
    errors.push('invoiceId is required and must be a string');
  } else if (!isValidUUID(invoice.invoiceId)) {
    errors.push('invoiceId must be a valid UUID v4');
  }

  if (!invoice.invoiceNumber || typeof invoice.invoiceNumber !== 'string') {
    errors.push('invoiceNumber is required and must be a string');
  }

  // Validate type enum
  const validTypes: InvoiceType[] = ['standard', 'recurring', 'credit_note', 'proforma'];
  if (!invoice.type || !validTypes.includes(invoice.type)) {
    errors.push(`type is required and must be one of: ${validTypes.join(', ')}`);
  }

  // Validate status enum
  const validStatuses: InvoiceStatus[] = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'];
  if (!invoice.status || !validStatuses.includes(invoice.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate IDs
  if (!invoice.customerId || typeof invoice.customerId !== 'string') {
    errors.push('customerId is required and must be a string');
  }

  if (!invoice.vendorId || typeof invoice.vendorId !== 'string') {
    errors.push('vendorId is required and must be a string');
  }

  // Validate billing details
  if (!invoice.billingDetails || typeof invoice.billingDetails !== 'object') {
    errors.push('billingDetails is required and must be an object');
  } else {
    const billing = invoice.billingDetails;
    if (!billing.name || typeof billing.name !== 'string') {
      errors.push('billingDetails.name is required and must be a string');
    }
    if (!billing.email || typeof billing.email !== 'string') {
      errors.push('billingDetails.email is required and must be a string');
    } else if (!isValidEmail(billing.email)) {
      errors.push('billingDetails.email must be a valid email address');
    }
    if (!billing.phone || typeof billing.phone !== 'string') {
      errors.push('billingDetails.phone is required and must be a string');
    }
    if (!billing.addressLine1 || typeof billing.addressLine1 !== 'string') {
      errors.push('billingDetails.addressLine1 is required and must be a string');
    }
    if (!billing.suburb || typeof billing.suburb !== 'string') {
      errors.push('billingDetails.suburb is required and must be a string');
    }
    if (!billing.state || typeof billing.state !== 'string') {
      errors.push('billingDetails.state is required and must be a string');
    }
    if (!billing.postCode || typeof billing.postCode !== 'string') {
      errors.push('billingDetails.postCode is required and must be a string');
    }
    if (!billing.country || typeof billing.country !== 'string') {
      errors.push('billingDetails.country is required and must be a string');
    }
  }

  // Validate dates
  if (!invoice.issueDate || !(invoice.issueDate instanceof Date)) {
    errors.push('issueDate is required and must be a Date');
  }

  if (!invoice.dueDate || !(invoice.dueDate instanceof Date)) {
    errors.push('dueDate is required and must be a Date');
  }

  // Validate that due date is after issue date
  if (invoice.issueDate && invoice.dueDate && invoice.dueDate < invoice.issueDate) {
    errors.push('dueDate must be after or equal to issueDate');
  }

  // Validate line items
  if (!Array.isArray(invoice.lineItems)) {
    errors.push('lineItems must be an array');
  } else if (invoice.lineItems.length === 0) {
    errors.push('lineItems must contain at least one item');
  } else {
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscounts = 0;

    invoice.lineItems.forEach((item: any, i: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`lineItems[${i}].id is required and must be a string`);
      }
      if (!item.description || typeof item.description !== 'string') {
        errors.push(`lineItems[${i}].description is required and must be a string`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`lineItems[${i}].quantity must be a positive number`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        errors.push(`lineItems[${i}].unitPrice must be a non-negative number`);
      }
      if (typeof item.subtotal !== 'number') {
        errors.push(`lineItems[${i}].subtotal must be a number`);
      }
      if (typeof item.total !== 'number') {
        errors.push(`lineItems[${i}].total must be a number`);
      }

      // Calculate expected values
      let expectedSubtotal = item.quantity * item.unitPrice;
      if (item.discount) {
        if (item.discountType === 'percentage') {
          expectedSubtotal -= expectedSubtotal * item.discount;
          calculatedDiscounts += expectedSubtotal * item.discount;
        } else {
          expectedSubtotal -= item.discount;
          calculatedDiscounts += item.discount;
        }
      }

      if (Math.abs(item.subtotal - expectedSubtotal) > 0.01) {
        errors.push(`lineItems[${i}].subtotal calculation error`);
      }

      const itemTax = item.tax || 0;
      const expectedTotal = item.subtotal + itemTax;
      if (Math.abs(item.total - expectedTotal) > 0.01) {
        errors.push(`lineItems[${i}].total must equal subtotal + tax`);
      }

      calculatedSubtotal += item.subtotal || 0;
      calculatedTax += itemTax;
    });

    // Validate totals
    if (Math.abs(invoice.subtotal - calculatedSubtotal) > 0.01) {
      errors.push(`subtotal must equal sum of line item subtotals. Expected ${calculatedSubtotal}, got ${invoice.subtotal}`);
    }
    if (Math.abs(invoice.taxTotal - calculatedTax) > 0.01) {
      errors.push(`taxTotal must equal sum of line item taxes. Expected ${calculatedTax}, got ${invoice.taxTotal}`);
    }
    if (Math.abs(invoice.discountTotal - calculatedDiscounts) > 0.01) {
      errors.push(`discountTotal must equal sum of line item discounts. Expected ${calculatedDiscounts}, got ${invoice.discountTotal}`);
    }
  }

  // Validate amounts
  if (typeof invoice.subtotal !== 'number' || invoice.subtotal < 0) {
    errors.push('subtotal must be a non-negative number');
  }

  if (typeof invoice.discountTotal !== 'number' || invoice.discountTotal < 0) {
    errors.push('discountTotal must be a non-negative number');
  }

  if (typeof invoice.taxTotal !== 'number' || invoice.taxTotal < 0) {
    errors.push('taxTotal must be a non-negative number');
  }

  if (typeof invoice.total !== 'number' || invoice.total < 0) {
    errors.push('total must be a non-negative number');
  }

  if (typeof invoice.amountPaid !== 'number' || invoice.amountPaid < 0) {
    errors.push('amountPaid must be a non-negative number');
  }

  if (typeof invoice.amountDue !== 'number') {
    errors.push('amountDue must be a number');
  }

  // Validate total calculation
  const shippingFee = invoice.shippingFee || 0;
  const expectedTotal = invoice.subtotal - invoice.discountTotal + invoice.taxTotal + shippingFee;
  if (Math.abs(invoice.total - expectedTotal) > 0.01) {
    errors.push(`total must equal subtotal - discountTotal + taxTotal + shippingFee. Expected ${expectedTotal}, got ${invoice.total}`);
  }

  // Validate amount due
  const expectedAmountDue = invoice.total - invoice.amountPaid;
  if (Math.abs(invoice.amountDue - expectedAmountDue) > 0.01) {
    errors.push(`amountDue must equal total - amountPaid. Expected ${expectedAmountDue}, got ${invoice.amountDue}`);
  }

  // Validate currency
  if (!invoice.currency || typeof invoice.currency !== 'string' || invoice.currency.length !== 3) {
    errors.push('currency must be a 3-letter ISO currency code');
  }

  // Validate payment history
  if (!Array.isArray(invoice.paymentHistory)) {
    errors.push('paymentHistory must be an array');
  }

  // Validate timestamps
  if (!invoice.createdAt || !(invoice.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!invoice.lastModifiedAt || !(invoice.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper functions
export function createInvoiceLineItem(data: {
  description: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  variantId?: string;
  discount?: number;
  discountType?: 'amount' | 'percentage';
  taxRate?: number;
}): InvoiceLineItem {
  let subtotal = data.quantity * data.unitPrice;
  
  if (data.discount) {
    if (data.discountType === 'percentage') {
      subtotal -= subtotal * data.discount;
    } else {
      subtotal -= data.discount;
    }
  }

  const tax = data.taxRate ? subtotal * data.taxRate : 0;
  const total = subtotal + tax;

  return {
    id: uuidv4(),
    description: data.description,
    productId: data.productId,
    variantId: data.variantId,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    discount: data.discount,
    discountType: data.discountType,
    tax,
    taxRate: data.taxRate,
    subtotal,
    total
  };
}

export function generateInvoiceNumber(prefix: string = 'INV', year?: number, sequence?: number): string {
  const currentYear = year || new Date().getFullYear();
  const seq = sequence || Math.floor(Math.random() * 9999) + 1;
  return `${prefix}-${currentYear}-${seq.toString().padStart(4, '0')}`;
}

export function createInvoice(data: {
  customerId: string;
  vendorId: string;
  billingDetails: BillingDetails;
  lineItems: InvoiceLineItem[];
  dueDate: Date;
  currency: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  invoiceNumber?: string;
  orderId?: string;
  issueDate?: Date;
  terms?: string;
  shippingFee?: number;
  notes?: string;
  internalNotes?: string;
  metadata?: Record<string, any>;
}): Invoice {
  const now = new Date();
  const subtotal = data.lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = data.lineItems.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxTotal = data.lineItems.reduce((sum, item) => sum + (item.tax || 0), 0);
  const total = subtotal - discountTotal + taxTotal + (data.shippingFee || 0);

  const invoice: Invoice = {
    invoiceId: uuidv4(),
    invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
    type: data.type || 'standard',
    status: data.status || 'draft',
    customerId: data.customerId,
    vendorId: data.vendorId,
    orderId: data.orderId,
    billingDetails: data.billingDetails,
    issueDate: data.issueDate || now,
    dueDate: data.dueDate,
    terms: data.terms,
    lineItems: data.lineItems,
    subtotal,
    discountTotal,
    taxTotal,
    shippingFee: data.shippingFee,
    total,
    amountPaid: 0,
    amountDue: total,
    currency: data.currency,
    paymentHistory: [],
    notes: data.notes,
    internalNotes: data.internalNotes,
    metadata: data.metadata,
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateInvoice(invoice);
  if (!validation.valid) {
    throw new Error(`Invalid invoice: ${validation.errors.join(', ')}`);
  }

  return invoice;
}

// Invoice Repository class for database operations
export class InvoiceRepository {
  private collection: Collection<Invoice>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Invoice>('invoice');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique indexes
    await this.collection.createIndex(
      { invoiceId: 1 },
      { unique: true }
    );
    
    await this.collection.createIndex(
      { invoiceNumber: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ customerId: 1 });
    await this.collection.createIndex({ vendorId: 1 });
    await this.collection.createIndex({ orderId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ issueDate: -1 });
    await this.collection.createIndex({ dueDate: 1 });
    await this.collection.createIndex({ 'billingDetails.email': 1 });
    
    // Compound indexes
    await this.collection.createIndex({ customerId: 1, status: 1 });
    await this.collection.createIndex({ vendorId: 1, status: 1 });
    await this.collection.createIndex({ status: 1, dueDate: 1 }); // For finding overdue invoices
  }

  async create(invoiceData: Parameters<typeof createInvoice>[0]): Promise<Invoice> {
    const invoice = createInvoice(invoiceData);

    // Validate before inserting
    const validation = validateInvoice(invoice);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid invoice: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(invoice as any);
    return invoice;
  }

  async findByInvoiceId(invoiceId: string): Promise<Invoice | null> {
    return this.collection.findOne({ invoiceId }) as Promise<Invoice | null>;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return this.collection.findOne({ invoiceNumber }) as Promise<Invoice | null>;
  }

  async findByCustomerId(customerId: string): Promise<Invoice[]> {
    return this.collection.find({ customerId })
      .sort({ issueDate: -1 })
      .toArray() as Promise<Invoice[]>;
  }

  async findByVendorId(vendorId: string): Promise<Invoice[]> {
    return this.collection.find({ vendorId })
      .sort({ issueDate: -1 })
      .toArray() as Promise<Invoice[]>;
  }

  async findByOrderId(orderId: string): Promise<Invoice | null> {
    return this.collection.findOne({ orderId }) as Promise<Invoice | null>;
  }

  async findByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return this.collection.find({ status })
      .sort({ issueDate: -1 })
      .toArray() as Promise<Invoice[]>;
  }

  async updateStatus(invoiceId: string, status: InvoiceStatus): Promise<Invoice | null> {
    const updateData: any = {
      status,
      lastModifiedAt: new Date()
    };

    // Set status-specific timestamps
    if (status === 'sent') updateData.sentAt = new Date();
    if (status === 'viewed') updateData.viewedAt = new Date();
    if (status === 'paid') updateData.paidAt = new Date();
    if (status === 'cancelled') updateData.cancelledAt = new Date();

    const result = await this.collection.findOneAndUpdate(
      { invoiceId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result as Invoice | null;
  }

  async recordPayment(invoiceId: string, payment: {
    amount: number;
    method: PaymentMethod;
    reference?: string;
    notes?: string;
  }): Promise<Invoice | null> {
    const invoice = await this.findByInvoiceId(invoiceId);
    if (!invoice) return null;

    const paymentRecord: PaymentHistory = {
      id: uuidv4(),
      date: new Date(),
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes
    };

    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newAmountDue = invoice.total - newAmountPaid;
    
    // Determine new status
    let newStatus = invoice.status;
    if (newAmountDue <= 0) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    }

    const result = await this.collection.findOneAndUpdate(
      { invoiceId },
      {
        $set: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: newStatus,
          lastModifiedAt: new Date(),
          ...(newStatus === 'paid' ? { paidAt: new Date() } : {})
        },
        $push: { paymentHistory: paymentRecord }
      },
      { returnDocument: 'after' }
    );

    return result as Invoice | null;
  }

  async findOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return this.collection.find({
      status: { $in: ['sent', 'viewed', 'partial'] },
      dueDate: { $lt: now }
    }).toArray() as Promise<Invoice[]>;
  }

  async markOverdueInvoices(): Promise<number> {
    const now = new Date();
    const result = await this.collection.updateMany(
      {
        status: { $in: ['sent', 'viewed', 'partial'] },
        dueDate: { $lt: now }
      },
      {
        $set: {
          status: 'overdue' as InvoiceStatus,
          lastModifiedAt: now
        }
      }
    );

    return result.modifiedCount;
  }

  async delete(invoiceId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ invoiceId });
    return result.deletedCount === 1;
  }

  async getNextInvoiceNumber(prefix: string = 'INV'): Promise<string> {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    
    const lastInvoice = await this.collection.findOne(
      { invoiceNumber: { $regex: pattern } },
      { sort: { invoiceNumber: -1 } }
    );

    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(pattern);
      if (match) {
        const nextSequence = parseInt(match[1]) + 1;
        return generateInvoiceNumber(prefix, year, nextSequence);
      }
    }

    return generateInvoiceNumber(prefix, year, 1);
  }

  async getInvoiceStats(vendorId?: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalInvoices: number;
    totalRevenue: number;
    totalPaid: number;
    totalOutstanding: number;
    averageInvoiceValue: number;
    statusBreakdown: Record<InvoiceStatus, number>;
  }> {
    const filter: any = {};
    if (vendorId) filter.vendorId = vendorId;
    if (dateFrom || dateTo) {
      filter.issueDate = {};
      if (dateFrom) filter.issueDate.$gte = dateFrom;
      if (dateTo) filter.issueDate.$lte = dateTo;
    }

    const invoices = await this.collection.find(filter).toArray();
    
    const statusBreakdown: Record<InvoiceStatus, number> = {
      draft: 0,
      sent: 0,
      viewed: 0,
      partial: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
      refunded: 0
    };

    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    invoices.forEach(invoice => {
      statusBreakdown[invoice.status]++;
      if (invoice.status !== 'cancelled' && invoice.status !== 'draft') {
        totalRevenue += invoice.total;
        totalPaid += invoice.amountPaid;
        totalOutstanding += invoice.amountDue;
      }
    });

    return {
      totalInvoices: invoices.length,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      averageInvoiceValue: invoices.length > 0 ? totalRevenue / invoices.length : 0,
      statusBreakdown
    };
  }

  async findAll(filter: Partial<Invoice> = {}): Promise<Invoice[]> {
    return this.collection.find(filter)
      .sort({ issueDate: -1 })
      .toArray() as Promise<Invoice[]>;
  }
}

export default InvoiceRepository;