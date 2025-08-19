import { Invoice } from '../src/types/invoice';
import { DEFAULT_INVOICE_SUPPLIER } from '../src/constants/invoice';

export const sampleInvoice: Invoice = {
  _id: '507f1f77bcf86cd799439011',
  invoiceNumber: 'LT-2024-001234',
  date: new Date('2024-01-15'),
  status: 'paid',
  supplier: DEFAULT_INVOICE_SUPPLIER,
  billTo: {
    businessName: 'ABC Company Pty Ltd',
    businessNumber: '123 456 789 78',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    addressLine1: '456 Customer Lane',
    city: 'Melbourne',
    postalCode: '3000',
    stateProvince: 'Victoria',
    country: 'AU'
  },
  items: [
    {
      description: 'Event Registration - Premium Package',
      quantity: 2,
      price: 250.00
    },
    {
      description: 'Workshop Add-on',
      quantity: 2,
      price: 50.00
    }
  ],
  subtotal: 600.00,
  processingFees: 15.00,
  gstIncluded: 61.50,
  total: 615.00,
  payment: {
    method: 'credit_card',
    transactionId: 'ch_3O5QK2LkdIwHu7ix0KQBwGmr',
    paidDate: new Date('2024-01-15T10:30:00Z'),
    amount: 615.00,
    currency: 'AUD',
    last4: '4242',
    cardBrand: 'Visa',
    receiptUrl: 'https://pay.stripe.com/receipts/payment/example',
    status: 'completed'
  },
  paymentId: '507f1f77bcf86cd799439012',
  registrationId: '507f1f77bcf86cd799439013',
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15')
};