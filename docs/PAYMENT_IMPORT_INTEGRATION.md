# Payment Import Integration Documentation

## Overview

The payment import system is designed to work seamlessly with the existing invoice processing system. This document explains how the integration works and ensures backwards compatibility.

## Key Integration Points

### 1. Payment Linking

When importing payments from Square, the system ensures proper linking with registrations:

- **Existing Payments**: Updates existing payment records with `linkedRegistrationId` field
- **New Payments**: Creates new payment records with proper linking fields
- **Field Compatibility**: Maintains both old and new field names for backwards compatibility

### 2. Registration Linking

When matching payments to registrations:

- **Existing Registrations**: Updates with `square_payment_id` and `linkedPaymentId` fields
- **New Registrations**: Creates with all necessary payment linking fields
- **Confirmation Numbers**: Generates unique confirmation numbers using reversed timestamp strategy

### 3. Invoice List Compatibility

The invoice list page (`/src/app/invoices/list/page.tsx`) expects:

```typescript
// Payment fields checked by invoice list
{
  linkedRegistrationId: string,     // Manual/import matches
  invoiceCreated: boolean,          // Invoice processing status
  invoiceDeclined: boolean,         // Declined invoice flag
  transactionId: string,            // For automatic matching
  customerEmail: string             // For email-based matching
}

// Registration fields checked by invoice list
{
  square_payment_id: string,        // Square payment link
  stripe_payment_intent_id: string, // Stripe payment link
  stripePaymentIntentId: string,    // Alternative field name
  confirmationNumber: string        // For transaction ID matching
}
```

### 4. Payment Registration Matcher

The matcher service (`/src/services/payment-registration-matcher.ts`) uses multiple strategies:

1. **Payment ID Match**: Checks `square_payment_id`, `squarePaymentId`, etc.
2. **Metadata Match**: Uses payment metadata for registration ID
3. **Amount/Time Match**: Fuzzy matching within time windows
4. **Email/Amount Match**: Combined email and amount matching

## Import Queue Processing

The import queue (`/mongodb-explorer/src/app/api/import-queue/process/[id]/route.ts`) handles:

1. **Duplicate Detection**: Checks for existing payments/registrations before creating new ones
2. **Field Updates**: Updates existing records with proper linking fields
3. **Backwards Compatibility**: Maintains old field names alongside new ones

### Example: Processing a Queue Item

```typescript
// Check for existing payment
const existingPayment = await db.collection('payments').findOne({
  squarePaymentId: queueItem.paymentData.squarePaymentId
});

if (existingPayment) {
  // Update existing payment with link
  await db.collection('payments').updateOne(
    { _id: existingPayment._id },
    {
      $set: {
        linkedRegistrationId: queueItem.supabaseRegistrationId,
        matchedAt: new Date(),
        matchedBy: 'import-queue',
        matchConfidence: queueItem.matchScore
      }
    }
  );
} else {
  // Create new payment with proper links
  const paymentRecord = {
    linkedRegistrationId: queueItem.supabaseRegistrationId,
    registrationId: queueItem.supabaseRegistrationId,
    // ... other fields
  };
}
```

## Testing Integration

Run the integration test to verify proper linking:

```bash
cd scripts
npx ts-node test-import-integration.ts
```

This tests:
- Payments with linkedRegistrationId
- Registrations with payment links
- Orphaned records detection
- Invoice list compatibility

## Workflow

1. **Import Payments**: Use MongoDB Explorer > Payment Import
2. **Match Payments**: Match imported payments to registrations
3. **Process Queue**: Review and process matched items
4. **Create Invoices**: Use existing invoice list to process matched payments

## Important Notes

- Always check for existing records before creating new ones
- Maintain both old and new field names for compatibility
- Use `linkedRegistrationId` for manual/import matches
- The invoice system recognizes imports automatically
- No need to match payments twice - the system tracks matched payments