# Payment Import and Reconciliation Workflow Design

**Date**: January 2025  
**Status**: In Development  
**Version**: 1.0

## Overview

This document outlines the design for a comprehensive payment import and reconciliation workflow that allows users to:
1. Import payments from Square
2. Match payments to registrations in Supabase
3. Transform and validate data
4. Import matched payment-registration pairs
5. Update reports and inventory

## Workflow Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Square API     │────▶│ Payment Import   │────▶│ Import Queue    │
│   Payments      │     │   Collection     │     │  Collection     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   Supabase       │     │  Main Database  │
                        │  Registration    │────▶│  - Payments     │
                        │    Lookup        │     │  - Registrations│
                        └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Reports/Inventory│
                                                 │     Update      │
                                                 └─────────────────┘
```

## Database Collections

### 1. Payment Import Collection (`payment_imports`)

```typescript
interface PaymentImport {
  _id: ObjectId;
  importId: string;              // Unique import batch ID
  importedAt: Date;              // When imported from Square
  importedBy: string;            // User who initiated import
  
  // Square Payment Data
  squarePaymentId: string;       // Square's payment ID
  transactionId: string;         // Square transaction ID
  amount: number;                // Payment amount
  currency: string;              // Currency code
  status: string;                // Payment status
  createdAt: Date;               // Payment creation time
  
  // Customer Information
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  
  // Processing Status
  processingStatus: 'pending' | 'matched' | 'imported' | 'failed';
  matchedRegistrationId?: string;
  matchConfidence?: number;
  matchedBy?: string;
  matchedAt?: Date;
  
  // Raw Square data for reference
  rawSquareData: any;
}
```

### 2. Import Queue Collection (`import_queue`)

```typescript
interface ImportQueueItem {
  _id: ObjectId;
  queueId: string;
  createdAt: Date;
  createdBy: string;
  
  // Payment Reference
  paymentImportId: ObjectId;
  paymentData: PaymentImport;
  
  // Matched Registration
  supabaseRegistrationId: string;
  registrationData: any;          // Raw from Supabase
  transformedRegistration: any;   // After transformation
  
  // Matching Information
  matchingCriteria: {
    field: string;
    paymentValue: any;
    registrationValue: any;
  }[];
  
  // Validation
  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors?: string[];
  validatedBy?: string;
  validatedAt?: Date;
  
  // Import Status
  importStatus: 'pending' | 'imported' | 'failed';
  importedAt?: Date;
  importError?: string;
}
```

## User Interface Components

### 1. Payment Import Dashboard

Location: `/mongodb-explorer/src/app/payment-import/page.tsx`

Features:
- Import payments from Square button
- List of imported payments with status
- Filtering and search capabilities
- Bulk actions

### 2. Payment Matching Interface

Location: `/mongodb-explorer/src/app/payment-import/match/[id]/page.tsx`

Features:
- Payment details display
- Supabase registration search
- Field mapping configuration
- Match confidence scoring
- Manual override options

### 3. Import Queue Manager

Location: `/mongodb-explorer/src/app/import-queue/page.tsx`

Features:
- Queue items list
- Transformation preview
- Validation results
- Import actions
- Error handling

## API Endpoints

### 1. Import Payments from Square

```typescript
POST /api/payment-import/square
Body: {
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
  limit?: number;
}
Response: {
  imported: number;
  skipped: number;
  errors: string[];
}
```

### 2. Search Supabase Registrations

```typescript
POST /api/payment-import/search-registrations
Body: {
  searchCriteria: {
    email?: string;
    amount?: number;
    confirmationNumber?: string;
    dateRange?: { start: Date; end: Date };
    customFields?: Record<string, any>;
  }
}
Response: {
  registrations: Registration[];
  totalCount: number;
}
```

### 3. Queue Registration for Import

```typescript
POST /api/import-queue/add
Body: {
  paymentImportId: string;
  registrationId: string;
  matchingCriteria: MatchCriteria[];
}
Response: {
  queueId: string;
  transformedData: any;
  validationResult: ValidationResult;
}
```

### 4. Process Import Queue Item

```typescript
POST /api/import-queue/process/:queueId
Body: {
  confirmTransformation: boolean;
  overrides?: Record<string, any>;
}
Response: {
  paymentId: string;
  registrationId: string;
  confirmationNumber: string;
  updatedReports: string[];
}
```

## Matching Algorithm

### 1. Direct Field Matching
- Email address
- Amount (with tolerance)
- Confirmation number
- Transaction ID in metadata

### 2. Fuzzy Matching
- Name similarity
- Date proximity
- Amount within percentage

### 3. Confidence Scoring
```typescript
interface MatchConfidence {
  score: number;        // 0-100
  factors: {
    field: string;
    weight: number;
    matched: boolean;
  }[];
}
```

## Transformation Rules

### 1. Payment Data Transformation
```typescript
function transformSquarePayment(squarePayment: SquarePayment): Payment {
  return {
    paymentId: squarePayment.id,
    source: 'square',
    amount: squarePayment.amount_money.amount / 100,
    currency: squarePayment.amount_money.currency,
    status: mapSquareStatus(squarePayment.status),
    customerEmail: squarePayment.buyer_email_address,
    createdAt: new Date(squarePayment.created_at),
    // ... additional mappings
  };
}
```

### 2. Registration Data Transformation
```typescript
function transformSupabaseRegistration(supabaseReg: any): Registration {
  return {
    registrationId: supabaseReg.id,
    confirmationNumber: generateConfirmationNumber(supabaseReg.registration_type),
    registrationType: supabaseReg.registration_type,
    // ... map all fields according to schema
  };
}
```

## Validation Rules

### 1. Required Fields
- Payment must have amount and status
- Registration must have type and customer info
- Matching must have at least one criteria

### 2. Business Rules
- Amount must match within tolerance
- Dates must be logical
- No duplicate imports

### 3. Data Integrity
- Foreign key references valid
- Enum values correct
- Data types match schema

## Security Considerations

### 1. Authentication
- User must be authenticated
- Role-based access control
- Audit trail for all actions

### 2. Data Protection
- PII handling compliance
- Secure API communications
- Data encryption at rest

### 3. Error Handling
- No sensitive data in logs
- Graceful failure modes
- Rollback capabilities

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create database collections
2. Set up Square API integration
3. Build Supabase query service
4. Implement transformation engine

### Phase 2: User Interface
1. Payment import dashboard
2. Matching interface
3. Queue management
4. Validation screens

### Phase 3: Automation
1. Auto-matching algorithms
2. Bulk import capabilities
3. Scheduled imports
4. Report updates

### Phase 4: Advanced Features
1. Machine learning matching
2. Custom field mapping
3. Multi-source imports
4. Advanced analytics

## Success Metrics

1. **Import Success Rate**: % of payments successfully matched and imported
2. **Matching Accuracy**: % of correct matches (validated by user)
3. **Processing Time**: Average time from import to completion
4. **Error Rate**: % of imports requiring manual intervention
5. **User Satisfaction**: Ease of use and efficiency gains