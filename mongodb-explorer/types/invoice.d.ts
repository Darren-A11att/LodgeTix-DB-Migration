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
    last4?: string;
    cardBrand?: string;
    receiptUrl?: string;
    status: 'completed' | 'processing' | 'failed' | 'refunded';
    source?: string;
    statementDescriptor?: string;
}
export interface Invoice {
    _id?: string;
    invoiceNumber: string;
    invoiceType?: 'customer' | 'supplier';
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
//# sourceMappingURL=invoice.d.ts.map