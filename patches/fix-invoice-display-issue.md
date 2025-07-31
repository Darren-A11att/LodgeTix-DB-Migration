# Invoice Display Issue Fix

## Problem
The invoice preview is showing empty attendee names and generic "Ticket" descriptions because:

1. The backend might still be using the old `InvoicePreviewGenerator` instead of `NormalizedInvoicePreviewGenerator`
2. The frontend is trying to generate its own invoice from extracted registration data (which only has ObjectId references)

## Root Cause
After attendees and tickets are extracted to separate collections, the registration document only contains ObjectId references:
```javascript
attendees: [
  { "_id": "688af61aaa226597b8dbbd04" },
  { "_id": "688af61baa226597b8dbbd06" },
  { "_id": "688af61baa226597b8dbbd08" }
]
```

The old generator tries to read `firstName` and `lastName` from these references, resulting in undefined values.

## Solutions

### Solution 1: Ensure Backend Uses Normalized Generator
Check that the server is actually using `NormalizedInvoicePreviewGenerator`:

1. Restart the server to ensure the latest code is loaded
2. Check for any import errors in the console
3. Verify the import path is correct in `src/server.ts`

### Solution 2: Fix Frontend to Use Backend Invoice
The frontend should use the invoice preview from the backend instead of generating its own:

```javascript
// Instead of:
if (effectiveRegistration.registrationType === 'individuals') {
  customInvoice = await generateCustomIndividualsInvoice(effectiveRegistration, effectivePayment, baseInvoice);
}

// Use:
if (currentMatch?.invoice) {
  customInvoice = {
    ...currentMatch.invoice,
    invoiceType: 'customer'
  };
}
```

### Solution 3: Quick Frontend Fix
If you need a quick fix, update the frontend to handle missing attendee data:

```javascript
// In generateCustomIndividualsInvoice function
const attendees = effectiveRegistration.registrationData?.attendees || [];

// Check if attendees are just references
const needsAttendeeData = attendees.length > 0 && !attendees[0].firstName;

if (needsAttendeeData) {
  console.warn('Attendees are ObjectId references - invoice will have empty names');
  // Either fetch attendee data or use the backend invoice
}
```

## Verification
Run this script to verify the backend is working correctly:
```bash
node scripts/test-api-with-specific-payment.js
```

The invoice items should show:
- Proper attendee names (not empty)
- Actual ticket descriptions (not "Ticket")
- Correct prices (not $0)