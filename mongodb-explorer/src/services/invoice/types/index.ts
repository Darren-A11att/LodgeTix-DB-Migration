/**
 * Type definitions for the invoice generation system
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
  total?: number;
  type?: 'header' | 'attendee' | 'ticket' | 'lodge' | 'other';
  subItems?: InvoiceItem[];
}

export interface InvoiceBillTo {
  businessName?: string;
  businessNumber?: string;
  title?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  stateProvince?: string;
  country?: string;
}

export interface InvoiceSupplier {
  name: string;
  abn: string;
  address: string;
  issuedBy?: string;
}

export interface InvoicePayment {
  method: string;
  transactionId: string;
  paidDate: string | Date;
  amount: number;
  currency: string;
  last4?: string;
  cardBrand?: string;
  status: string;
  source: string;
}

export interface Invoice {
  invoiceType: 'customer' | 'supplier';
  invoiceNumber: string;
  paymentId?: string;
  registrationId?: string;
  relatedInvoiceId?: string;
  date: string | Date;
  dueDate?: string | Date;
  billTo: InvoiceBillTo;
  supplier: InvoiceSupplier;
  items: InvoiceItem[];
  subtotal: number;
  processingFees: number;
  gstIncluded?: number;
  totalBeforeGST?: number;
  total: number;
  payment: InvoicePayment;
  status: 'paid' | 'pending' | 'cancelled';
  notes?: string;
}

export interface ProcessedAttendee {
  id: string;
  name: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  lodgeInfo?: string;
  lodgeNameNumber?: string;
  tickets: ProcessedTicket[];
}

export interface ProcessedTicket {
  id: string;
  attendeeId?: string;
  ownerId?: string;
  ownerType?: 'attendee' | 'registration';
  name: string;
  price: number;
  quantity: number;
  description?: string;
  eventTicketId?: string;
}

export interface LodgeInfo {
  lodgeName?: string;
  lodgeNumber?: string;
  lodgeNameNumber?: string;
  membershipType?: string;
}

export interface BillingDetails {
  businessName?: string;
  businessNumber?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  stateProvince?: string;
  country?: string;
}

export interface RegistrationData {
  _id?: string;
  registrationId?: string;
  confirmationNumber?: string;
  registrationType?: 'individuals' | 'lodge' | 'delegation';
  functionId?: string;
  functionName?: string;
  registrationData?: any;
  attendees?: any[];
  selectedTickets?: any[];
  bookingContact?: any;
  metadata?: {
    billingDetails?: BillingDetails;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PaymentData {
  _id?: string;
  paymentId?: string;
  transactionId?: string;
  amount?: number;
  grossAmount?: number;
  fees?: number;
  currency?: string;
  paymentMethod?: string;
  paymentDate?: string | Date;
  timestamp?: string | Date;
  createdAt?: string | Date;
  customerEmail?: string;
  customerName?: string;
  cardLast4?: string;
  cardBrand?: string;
  status?: string;
  source?: string;
  sourceFile?: string;
  originalData?: any;
  [key: string]: any;
}

export interface InvoiceGeneratorOptions {
  payment: PaymentData;
  registration: RegistrationData;
  invoiceNumbers?: {
    customerInvoiceNumber?: string;
    supplierInvoiceNumber?: string;
  };
  functionName?: string;
  relatedDocuments?: {
    eventTickets?: any[];
    functionDetails?: any;
    [key: string]: any;
  };
  customerInvoice?: Invoice; // For supplier invoice generation
}

export interface ProcessedRegistrationData {
  attendees: ProcessedAttendee[];
  tickets: ProcessedTicket[];
  billingDetails: BillingDetails;
  lodgeInfo?: LodgeInfo;
  functionName?: string;
  confirmationNumber?: string;
}