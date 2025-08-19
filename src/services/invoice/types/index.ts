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
  amount: number;                     // Amount in dollars (unified)
  currency: string;                   // Uppercase currency code
  last4?: string;                     // Unified field name
  cardBrand?: string;
  status: string;                     // Normalized status
  source: 'stripe' | 'square';       // Payment source
  sourcePaymentId?: string;           // Original ID from source
  receiptUrl?: string;                // Square receipt URL
  fees?: number;                      // Total fees
}

// Comprehensive unified payment structure
export interface UnifiedPayment {
  // Core Identity
  id: string;
  sourcePaymentId: string;
  source: 'stripe' | 'square';
  
  // Import Metadata
  importId: string;
  importedAt: Date;
  importedBy: string;
  processingStatus: string;
  processed: boolean;
  processedAt?: Date;
  
  // Account/Location
  accountName?: string;
  accountNumber?: number;
  locationId?: string;
  
  // Amounts (normalized to dollars)
  amount: number;
  amountFormatted: string;
  currency: string;
  fees: number;
  netAmount: number;
  
  // Fees Breakdown
  feeDetails: {
    platformFee?: number;
    stripeFee?: number;
    squareFee?: number;
    platformFeePercentage?: number;
    processingFees?: Array<{
      type: string;
      amount: number;
      effectiveAt: Date;
    }>;
  };
  
  // Status
  status: string;
  statusOriginal: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  paymentDate: Date;
  closedAt?: Date;
  
  // Customer Data
  customer: {
    id?: string;
    email?: string;
    name?: string;
    givenName?: string;
    familyName?: string;
    phone?: string;
    creationSource?: string;
    preferences?: {
      emailUnsubscribed?: boolean;
    };
  };
  
  // Billing Address
  billingAddress?: {
    line1?: string;
    line2?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    firstName?: string;
    lastName?: string;
  };
  
  // Payment Method
  paymentMethod: {
    type: string;
    id?: string;
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    fingerprint?: string;
    cardType?: string;
    prepaidType?: string;
    bin?: string;
    entryMethod?: string;
    cvvStatus?: string;
    avsStatus?: string;
    authResultCode?: string;
    statementDescriptor?: string;
  };
  
  // Order Details
  order?: {
    id: string;
    reference?: string;
    state?: string;
    lineItems?: Array<{
      id: string;
      name?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      note?: string;
      type?: string;
    }>;
    totalAmount?: number;
    totalTax?: number;
    totalDiscount?: number;
    totalTip?: number;
    totalServiceCharge?: number;
    source?: {
      name: string;
    };
  };
  
  // Receipt Info
  receipt?: {
    url?: string;
    number?: string;
    email?: string;
  };
  
  // Event/Function Context
  event?: {
    id?: string;
    functionId?: string;
    registrationId?: string;
    registrationType?: string;
    confirmationNumber?: string;
    sessionId?: string;
  };
  
  // Organization Context
  organization?: {
    id?: string;
    name?: string;
    type?: string;
  };
  
  // Metadata
  metadata?: {
    appVersion?: string;
    deviceType?: string;
    environment?: string;
    isDomestic?: string;
    ticketsCount?: number;
    totalAttendees?: number;
    subtotal?: number;
    [key: string]: any;
  };
  
  // Risk Evaluation
  risk?: {
    level?: string;
    score?: number;
    evaluatedAt?: Date;
  };
  
  // Transfer/Destination
  transfer?: {
    destinationAccount?: string;
    transferGroup?: string;
    amount?: number;
  };
  
  // Raw Data Preservation
  rawData: {
    stripe?: any;
    square?: any;
  };
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
  id?: string;                        // Unified payment ID
  paymentId?: string;                 // Legacy field, now maps to id
  sourcePaymentId?: string;           // Original ID from source system
  source: 'stripe' | 'square';       // Payment source
  transactionId?: string;             // Legacy field
  amount: number;                     // Amount in dollars (unified structure)
  grossAmount?: number;               // Legacy field
  fees?: number;
  currency: string;                   // Uppercase currency code
  paymentMethod?: string;
  paymentDate?: string | Date;        // Legacy field
  createdAt: Date;                    // ISO 8601 timestamp (unified)
  timestamp?: string | Date;          // Legacy field
  customerEmail: string;              // Unified customer email
  customerName?: string;              // Unified customer name
  customerId?: string;                // Unified customer ID
  orderId?: string;                   // Square order reference
  registrationId?: string;            // From metadata (Stripe) or order ref
  receiptEmail?: string;              // For invoice delivery
  cardLast4?: string;
  cardBrand?: string;
  last4?: string;                     // Unified field name
  status: string;                     // Normalized status
  statusOriginal?: string;            // Original status from source
  billingAddress?: {                  // Complete address object
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    country?: string;
  };
  sourceFile?: string;                // Legacy field
  originalData?: any;                 // Legacy field
  rawData?: any;                      // Complete original response (unified)
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