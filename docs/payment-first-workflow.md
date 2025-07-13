# Payment-First Workflow Documentation

## Overview

The payment-first workflow ensures data integrity by only importing registrations that have verified payments. This prevents incomplete or unpaid registrations from entering the main database.

## Workflow Steps

### 1. Import All Payments First
- Imports payments from Square API
- Imports payments from Stripe (if script available)
- Ensures all payment data is available before processing registrations

### 2. Import Registrations with Payment Validation
- Fetches registrations from Supabase
- Checks each registration for a matching payment
- Only imports registrations with verified payments to the main collection
- Stores registrations without payments in `pending-imports` collection

### 3. Process Pending Imports
- Periodically checks pending imports for newly arrived payments
- Can check Square API directly after 2 attempts
- Moves resolved registrations to main collection
- Moves failed registrations to `failedRegistrations` after max retries

## Collections

### Main Collections
- **`registrations`**: Only contains registrations with verified payments
- **`payments`**: All payment records from Square and Stripe

### Supporting Collections
- **`pending-imports`**: Registrations awaiting payment verification
- **`failedRegistrations`**: Registrations that failed payment verification after max retries

## Scripts

### 1. `orchestrate-payment-first-sync.ts`
Main orchestration script that runs the complete workflow.

```bash
# Run complete orchestration
npx tsx src/scripts/orchestrate-payment-first-sync.ts

# Only process pending imports
npx tsx src/scripts/orchestrate-payment-first-sync.ts --process-pending

# Generate report only
npx tsx src/scripts/orchestrate-payment-first-sync.ts --report-only
```

### 2. `process-pending-imports.ts`
Dedicated script for processing pending imports.

```bash
# Process pending imports (default: 50 at a time, max 5 retries)
npx tsx src/scripts/process-pending-imports.ts

# Custom batch size and retry limit
npx tsx src/scripts/process-pending-imports.ts --batch-size 100 --max-retries 10

# Show statistics only
npx tsx src/scripts/process-pending-imports.ts --stats
```

### 3. `show-data-quality-summary.ts`
Generates comprehensive data quality report.

```bash
npx tsx src/scripts/show-data-quality-summary.ts
```

## Pending Import Processing

Each pending import tracks:
- `pendingSince`: When the registration was first added to pending
- `checkCount`: Number of times we've checked for payment
- `lastCheckDate`: When we last checked
- `attemptedPaymentIds`: Payment IDs we're looking for
- `reason`: Why the registration is pending

### Processing Logic
1. Check local database for payment
2. After 2 attempts, check Square API directly if Square payment ID exists
3. If payment found, import to main collection
4. If not found after max retries (default 5), move to failed collection

## Benefits

1. **Data Integrity**: Only paid registrations in main collection
2. **No Lost Data**: Pending imports preserve registrations until payments arrive
3. **Automatic Resolution**: Pending imports automatically resolve when payments arrive
4. **API Fallback**: Can check payment provider APIs directly
5. **Clear Visibility**: Know exactly which registrations are pending and why

## Recommended Schedule

Run these scripts on a regular schedule:

- **Hourly**: `process-pending-imports.ts` - Check for newly arrived payments
- **Every 4 hours**: `orchestrate-payment-first-sync.ts` - Full sync
- **Daily**: `show-data-quality-summary.ts` - Monitor data quality

## Migration from Old Data

To migrate existing data to the new workflow:

1. Run payment imports to ensure all payments are up to date
2. Run validation to identify registrations without payments
3. Move invalid registrations to pending-imports for processing
4. Process pending imports to resolve any that now have payments