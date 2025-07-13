import { ObjectId } from 'mongodb';

/**
 * Payment Import Types
 * 
 * Defines the structure for payment imports from Square
 * and the import queue for processing matched payments
 */

export interface PaymentImport {
  _id?: ObjectId;
  importId: string;              // Unique import batch ID
  importedAt: Date;              // When imported from Square
  importedBy: string;            // User who initiated import
  
  // Square Payment Data
  squarePaymentId: string;       // Square's payment ID
  transactionId: string;         // Square transaction ID
  amount: number;                // Payment amount in cents
  amountFormatted: string;       // Formatted amount (e.g., "$100.00")
  currency: string;              // Currency code (e.g., "USD")
  status: string;                // Payment status from Square
  createdAt: Date;               // Payment creation time in Square
  updatedAt: Date;               // Payment last update time
  
  // Customer Information
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  buyerId?: string;              // Square buyer ID
  
  // Payment Details
  paymentMethod?: string;        // Card, cash, etc.
  cardBrand?: string;            // Visa, Mastercard, etc.
  last4?: string;                // Last 4 of card
  receiptUrl?: string;           // Square receipt URL
  
  // Processing Status
  processingStatus: 'pending' | 'matched' | 'imported' | 'failed' | 'skipped';
  matchedRegistrationId?: string;
  matchConfidence?: number;      // 0-100 confidence score
  matchedBy?: string;            // User or 'auto'
  matchedAt?: Date;
  skipReason?: string;           // Why payment was skipped
  
  // Location Info
  locationId?: string;           // Square location ID
  locationName?: string;
  
  // Order Info
  orderId?: string;              // Square order ID
  orderReference?: string;       // Custom reference
  
  // Metadata
  metadata?: Record<string, any>; // Additional Square metadata
  
  // Original payment gateway response
  paymentGatewayData: any;
}

export interface ImportQueueItem {
  _id?: ObjectId;
  queueId: string;               // Unique queue item ID
  createdAt: Date;
  createdBy: string;             // User who queued the item
  
  // Payment Reference
  paymentImportId: ObjectId;
  paymentData: PaymentImport;
  
  // Matched Registration
  supabaseRegistrationId: string;
  registrationData: any;          // Raw from Supabase
  transformedRegistration: any;   // After transformation
  
  // Matching Information
  matchingCriteria: MatchCriteria[];
  matchMethod: 'auto' | 'manual';
  matchScore: number;             // Overall match confidence
  
  // Validation
  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors?: ValidationError[];
  validatedBy?: string;
  validatedAt?: Date;
  
  // Import Status
  importStatus: 'pending' | 'processing' | 'imported' | 'failed' | 'cancelled';
  importedAt?: Date;
  importError?: string;
  importAttempts?: number;        // Number of import attempts
  
  // Generated IDs
  generatedPaymentId?: string;    // ID that will be used in main DB
  generatedRegistrationId?: string;
  generatedConfirmationNumber?: string;
  
  // User Actions
  notes?: string;                 // User notes about the match
  reviewRequired?: boolean;       // Flagged for manual review
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface MatchCriteria {
  field: string;                  // Field being matched
  paymentValue: any;              // Value from payment
  registrationValue: any;         // Value from registration
  matchType: 'exact' | 'fuzzy' | 'range' | 'contains';
  weight: number;                 // Weight in overall score (0-1)
  matched: boolean;               // Whether this criteria matched
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

// Import batch tracking
export interface ImportBatch {
  _id?: ObjectId;
  batchId: string;
  startedAt: Date;
  startedBy: string;
  completedAt?: Date;
  
  // Batch Configuration
  dateRange: {
    start: Date;
    end: Date;
  };
  locationIds?: string[];
  
  // Batch Statistics
  totalPayments: number;
  importedPayments: number;
  skippedPayments: number;
  failedPayments: number;
  
  // Status
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  
  // Performance
  processingTimeMs?: number;
  averageTimePerPayment?: number;
}

// Search criteria for finding registrations
export interface RegistrationSearchCriteria {
  email?: string;
  confirmationNumber?: string;
  amount?: {
    value: number;
    tolerance: number;  // Percentage tolerance
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  customerName?: string;
  registrationType?: string;
  customFields?: Record<string, any>;
}

// Matching configuration
export interface MatchingConfig {
  emailWeight: number;          // Default: 0.4
  amountWeight: number;         // Default: 0.3
  nameWeight: number;           // Default: 0.2
  dateWeight: number;           // Default: 0.1
  minConfidenceScore: number;   // Default: 70
  amountTolerancePercent: number; // Default: 1%
  dateToleranceDays: number;    // Default: 7
}

// API Response types
export interface ImportPaymentsResponse {
  batchId: string;
  imported: number;
  skipped: number;
  errors: string[];
  duplicates: string[];
}

export interface SearchRegistrationsResponse {
  registrations: any[];         // Supabase registration format
  totalCount: number;
  searchCriteria: RegistrationSearchCriteria;
  executionTime: number;
}

export interface QueueItemResponse {
  queueId: string;
  transformedData: any;
  validationResult: {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  };
}

export interface ProcessQueueResponse {
  paymentId: string;
  registrationId: string;
  confirmationNumber: string;
  updatedReports: string[];
  processingTime: number;
}