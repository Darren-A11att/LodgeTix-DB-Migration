export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface InvoiceSupplier {
  name: string;
  abn: string;
  address: string;
}

export interface InvoiceBillTo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface InvoicePayment {
  method: 'credit_card' | 'debit_card' | 'bank_transfer' | 'paypal' | 'stripe' | 'other';
  transactionId: string;
  paidDate: Date;
  amount: number;
  currency: string;
  last4?: string;
  cardBrand?: string;
  receiptUrl?: string;
  status: 'completed' | 'processing' | 'failed' | 'refunded';
}

export interface Invoice {
  _id?: string;
  invoiceNumber: string;
  date: Date;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  supplier: InvoiceSupplier;
  billTo: InvoiceBillTo;
  items: InvoiceItem[];
  subtotal: number;
  processingFees: number;
  gstIncluded: number;
  total: number;
  payment?: InvoicePayment;
  paymentId?: string;
  registrationId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}