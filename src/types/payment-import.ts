import type { ObjectId } from 'mongodb';

// Minimal types used by API routes and services in this app

export interface MatchCriteria {
  field?: string;
  matched: boolean;
  weight: number; // 0..1 multiplier used for scoring
  details?: string;
}

export interface PaymentImport {
  _id: ObjectId;
  importId?: string;
  customerEmail?: string;
  customerName?: string;
  amount: number;
  processingStatus?: 'pending' | 'matched' | 'processed' | 'failed' | string;
  matchedRegistrationId?: string;
  matchConfidence?: number;
  matchedBy?: string;
  matchedAt?: Date;
  createdAt?: Date;
  [key: string]: any;
}

export interface RegistrationData {
  id: string;
  email: string;
  full_name: string;
  total_amount: number;
  registration_type: string;
  created_at: string;
  confirmation_number?: string;
  [key: string]: any;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportQueueItem {
  queueId: string;
  createdAt: Date;
  createdBy: string;

  paymentImportId: ObjectId;
  paymentData: PaymentImport;

  supabaseRegistrationId: string;
  registrationData: RegistrationData;
  transformedRegistration: RegistrationData & { confirmationNumber: string };

  matchingCriteria: MatchCriteria[];
  matchMethod: 'auto' | 'manual';
  matchScore: number; // 0..100

  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors?: ValidationErrorItem[];
  importStatus: 'pending' | 'processed' | 'failed';

  generatedConfirmationNumber?: string;
}
