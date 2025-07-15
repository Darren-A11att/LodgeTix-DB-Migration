# Detailed Analysis of Duplicated Functionality

## Overview
This document provides a detailed comparison of duplicated functionality between the main app and mongodb-explorer, highlighting differences in implementation, features, and behavior.

## 1. Email Service (`email-service.ts`)

### Location
- Main app: `/src/services/email-service.ts`
- MongoDB Explorer: `/mongodb-explorer/src/services/email-service.ts`

### Key Differences

#### Main App Version (Latest - Recently Modified)
```typescript
// More comprehensive function parameter extraction
export async function sendInvoiceEmail({
  invoice,
  pdfBlob,
  recipientEmail,
  recipientName,
  functionName  // Added parameter
}: SendInvoiceEmailParams): Promise<EmailMetadata> {
  // Detailed logging
  console.log('✉️ Email Service: sendInvoiceEmail called');
  console.log('✉️ Parameters received:', {
    hasInvoice: !!invoice,
    invoiceNumber: invoice?.invoiceNumber,
    hasPdfBlob: !!pdfBlob,
    recipientEmail,
    recipientName,
    functionName,
    functionNameType: typeof functionName
  });
  
  // Function name extraction logic
  let eventName = functionName;
  if (!eventName && invoice.items && invoice.items.length > 0) {
    // Complex extraction from invoice items
    const match = firstItem.description.match(/for\s+(.+?)(?:\s*\||$)/i);
  }
  
  // Hardcoded override
  eventName = 'Grand Proclamation 2025';
}
```

#### MongoDB Explorer Version
```typescript
// Simpler implementation without function name parameter
export async function sendInvoiceEmail({
  invoice,
  pdfBlob,
  recipientEmail,
  recipientName
}: SendInvoiceEmailParams): Promise<EmailMetadata> {
  // Less detailed logging
  // No function name extraction logic
  // Uses fixed event name in email template
}
```

### Impact
- **Bug Risk**: Emails sent from different UIs may have different content
- **Feature Disparity**: Main app supports dynamic function names, mongodb-explorer doesn't
- **Maintenance Issue**: Recent fix in main app won't apply to mongodb-explorer

## 2. Invoice API Routes

### `/api/invoices/email/route.ts`

#### Main App Version
```typescript
// Handles functionName parameter
const functionName = formData.get('functionName') as string | null;
console.log('📮 Email API: Form data received:', {
  hasPdf: !!pdfFile,
  hasInvoice: !!invoiceData,
  recipientEmail,
  recipientName,
  functionName,
  functionNameType: typeof functionName
});

// Passes functionName to email service
const result = await sendInvoiceEmail({
  // ... other params
  functionName: functionName || undefined
});
```

#### MongoDB Explorer Version
```typescript
// No functionName handling
if (!pdfFile || !invoiceData || !recipientEmail || !recipientName) {
  return NextResponse.json(
    { error: 'Missing required fields' },
    { status: 400 }
  );
}

// Doesn't pass functionName to email service
const emailResult = await sendInvoiceEmail({
  pdfBlob,
  invoice,
  recipientEmail,
  recipientName
});
```

### `/api/invoices/matches/route.ts`
- **Main App**: Does not exist
- **MongoDB Explorer**: Complex payment matching logic with unified matching service

### Impact
- **Missing Features**: Invoice matching only available in mongodb-explorer
- **API Inconsistency**: Different parameter handling between versions

## 3. Payment Processing Services

### Payment Registration Matcher

#### Main App Version (`/src/services/payment-registration-matcher.ts`)
- Basic matching logic
- Simple field comparison
- Limited matching strategies

#### MongoDB Explorer Version
- Same basic matcher PLUS:
  - `unified-matching-service.ts` - Advanced multi-strategy matching
  - `strict-payment-matcher.ts` - Strict matching rules
  - More sophisticated matching algorithms

### Impact
- **Feature Gap**: Advanced matching only in mongodb-explorer
- **Data Inconsistency**: Different matching results depending on which app processes payments

## 4. Transaction Services

### Main App (`transaction-service.ts`)
```typescript
// Standard transaction creation
export async function createTransaction(data: TransactionData) {
  // Basic validation
  // Simple creation logic
}
```

### MongoDB Explorer
- Has both:
  - `transaction-service.ts` - Same as main app
  - `transaction-service-atomic.ts` - Atomic operations with rollback

### Impact
- **Reliability**: Atomic transactions only available in mongodb-explorer
- **Data Integrity**: Risk of partial updates in main app

## 5. Server Configuration (`server.ts`)

### Differences in Express Server

#### Main App (2051 lines)
- More comprehensive error handling
- Additional middleware configurations
- More detailed logging
- Additional API endpoints

#### MongoDB Explorer (1963 lines)
- Slightly simpler implementation
- Missing some recent updates
- Different middleware order

### Specific Route Differences

#### Routes Only in Main App
```typescript
// Test routes
router.post('/api/test-invoice-generation', ...);
```

#### Routes Only in MongoDB Explorer
```typescript
// Payment import routes
router.get('/api/payment-imports/:id', ...);
router.post('/api/payment-imports/square', ...);
router.post('/api/payment-imports/square/test', ...);

// Matching routes
router.post('/api/matches/unified', ...);
router.post('/api/invoices/matches', ...);

// Import queue management
router.get('/api/import-queue', ...);
router.post('/api/import-queue/add', ...);
router.post('/api/import-queue/process/:id', ...);

// Tools and admin routes
router.get('/api/tools/pending-imports', ...);
router.post('/api/tools/pending-imports/:id/retry', ...);
router.post('/api/tools/pending-imports/:id/fail', ...);
router.get('/api/tools/review-matches', ...);
router.post('/api/tools/review-matches/:id/approve', ...);
router.post('/api/tools/review-matches/:id/reject', ...);

// Sync orchestration
router.post('/api/tools/sync-orchestration/start', ...);
router.get('/api/tools/sync-orchestration/status/:id', ...);

// Reports
router.get('/api/reports/banquet-transactions', ...);
router.get('/api/reports/event-tickets', ...);
router.get('/api/reports/registration-types', ...);
```

### Impact
- **Feature Availability**: Many admin tools only accessible through mongodb-explorer
- **Operational Risk**: Critical functions like payment import split between apps

## 6. Utility Functions

### Invoice Helpers (`invoice-helpers.ts`)

#### Both Versions Have
- `formatMoney()`
- `calculateGST()`
- `generateInvoiceNumber()`

#### Differences
- **Import paths**: Different relative paths due to location
- **Type imports**: Some versions import from different type definitions
- **Comments**: Different levels of documentation

### PDF Generator (`pdf-generator.ts`)

#### Main App Version
- Uses specific logo import path
- Specific error handling for PDF generation

#### MongoDB Explorer Version
- Different logo import mechanism
- Additional debugging output

### Impact
- **Maintenance Burden**: Need to update utility functions in both places
- **Bug Risk**: Fixes in one location don't propagate

## 7. Database Repositories

### Structure
Both apps have identical repository files for all collections:
- Same TypeScript interfaces
- Same query methods
- Same index definitions

### Differences
- **Import paths**: Different due to directory structure
- **Connection handling**: Slight differences in MongoDB connection setup

### Example: `registrations.repository.ts`
```typescript
// Main app
import { connectMongoDB } from '@/lib/mongodb';

// MongoDB Explorer  
import { connectMongoDB } from '../lib/mongodb';
```

### Impact
- **Unnecessary Duplication**: 30+ files duplicated
- **Schema Drift Risk**: Changes to data model need updates in both places

## 8. Frontend Components

### Invoice Component (`Invoice.tsx`)

#### Main App Version
- Basic invoice display
- Simple styling

#### MongoDB Explorer Version
- Enhanced invoice display
- Additional interactive features
- More comprehensive error handling

### Registration Edit Modal

#### Both Have
- Basic CRUD operations
- Form validation

#### MongoDB Explorer Adds
- Bulk operations
- Advanced filtering
- Real-time validation

### Impact
- **UI Inconsistency**: Different user experiences
- **Feature Gaps**: Advanced features only in one app

## 9. API Client (`lib/api.ts`)

### Both Use
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api';
```

### Confusion Point
- Both apps expect to connect to port 3006
- Both apps try to start server on port 3006
- Unclear which should be the server vs client

## 10. Configuration and Environment

### Database Connections

#### Main App (`/src/connections/mongodb.ts`)
```typescript
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';
```

#### MongoDB Explorer
- Same configuration
- Additional connection pooling options
- Different error handling

### Environment Variables
- Both use same variable names
- Risk of conflicts when running together
- Unclear which `.env` file takes precedence

## Summary of Key Differences

### Feature Availability
1. **Payment Matching**: Advanced only in mongodb-explorer
2. **Import Queue**: Only in mongodb-explorer  
3. **Admin Tools**: Only in mongodb-explorer
4. **Atomic Transactions**: Only in mongodb-explorer
5. **Function Name Handling**: Only in main app (recent addition)

### Implementation Quality
1. **Logging**: More detailed in main app
2. **Error Handling**: More comprehensive in main app
3. **UI Features**: More advanced in mongodb-explorer
4. **API Features**: More complete in mongodb-explorer

### Risk Areas
1. **Data Processing**: Different algorithms may produce different results
2. **Email Content**: Emails may vary based on which app sends them
3. **Transaction Safety**: Only mongodb-explorer has atomic operations
4. **Feature Access**: Users may not find features if using wrong app

## Recommendations

### Immediate Actions
1. **Decide on Single Source**: Pick one implementation for each service
2. **Sync Critical Fixes**: Ensure email service fix is in both places
3. **Document Feature Location**: Clear guide on which app has which features

### Short-term (1 week)
1. **Consolidate Services**: Move all business logic to one location
2. **Standardize APIs**: Ensure consistent parameter handling
3. **Unify Repositories**: Single source for database access

### Medium-term (1 month)
1. **Extract Shared Library**: Common code in npm package
2. **Clear Separation**: MongoDB Explorer as pure UI
3. **API Gateway**: Single entry point for all APIs

### Long-term
1. **Microservices**: Separate concerns properly
2. **Feature Flags**: Control feature availability
3. **Proper Testing**: Ensure consistency across implementations