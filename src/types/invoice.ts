export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface InvoiceSupplier {
  name: string;
  abn: string;
  address: string;
  issuedBy: string;
}

export interface InvoiceBillTo {
  businessName?: string;
  businessNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  stateProvince: string;
  country: string;
}

export interface InvoicePayment {
  method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'other';
  transactionId: string;
  paidDate: Date;
  amount: number;
  currency: string;
  last4?: string; // Last 4 digits of card
  cardBrand?: string; // Visa, Mastercard, etc.
  receiptUrl?: string;
  status: 'completed' | 'processing' | 'failed' | 'refunded';
  source?: 'square' | 'stripe'; // Payment gateway source
  statementDescriptor?: string; // Statement descriptor from payment processor
}

export interface Invoice {
  _id?: string;
  invoiceNumber: string; // This will be the confirmation number
  invoiceType?: 'customer' | 'supplier'; // Type of invoice
  date: Date;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  supplier: InvoiceSupplier;
  billTo: InvoiceBillTo;
  items: InvoiceItem[];
  subtotal: number;
  processingFees: number;
  gstIncluded: number;
  total: number;
  payment?: InvoicePayment; // Payment details
  paymentId?: string; // Reference to payment document
  registrationId?: string; // Reference to registration document
  createdAt?: Date;
  updatedAt?: Date;
}