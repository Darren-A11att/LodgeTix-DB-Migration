# MongoDB Sync Implementation Summary

## Overview
Complete implementation of MongoDB sync system for LodgeTix with focus on contact deduplication, package expansion, ticket ownership, and order processing.

## Key Implementations Completed

### 1. Contact Deduplication Fix ✅
**Location:** `src/services/sync/enhanced-payment-sync.ts`
- Changed from email-only deduplication to composite key
- New deduplication key: `firstName:lastName:email` (lowercase)
- Updated in 5 locations (lines 794, 1192, 1210, 1366, 1382)
- Prevents duplicate contacts with same name but different emails

### 2. Package-First Processing ✅
**Location:** `src/services/sync/enhanced-payment-sync.ts` (lines 2124-2198)
- Packages are now detected and expanded BEFORE ticket processing
- Critical rule: When `isPackage=true`, the `eventTicketId` IS the `packageId`
- Package expansion flow:
  1. Detect packages (isPackage: true)
  2. Use eventTicketId as packageId for lookup
  3. Expand into individual tickets
  4. Inherit attendeeId from original package
  5. Remove original package ticket
  6. Process all tickets normally

### 3. Ticket Ownership Structure ✅
**Already Implemented**
- `ticketOwner`: The purchaser (registration contact)
- `ticketHolder`: The attendee using the ticket
- Properly separated throughout the sync process

### 4. Order Processing ✅
**New Files Created:**
- `src/services/sync/order-processor.ts`: Complete order processing implementation
- Transforms registrations into Order documents
- Calculates GST (10% inclusive tax)
- Integrated into sync workflow as final step

### 5. Database Indexes ✅
**Script:** `scripts/create-id-field-indexes.ts`
- Creates 70+ indexes for all *Id fields
- Optimizes query performance
- Handles non-existent collections gracefully

## Critical Business Rules

### Package Expansion Rules
1. **Package Detection**: Check for `isPackage: true` BEFORE processing any tickets
2. **Package ID Lookup**: Use `eventTicketId` as the `packageId` for packages collection lookup
3. **Attendee Inheritance**: All expanded tickets inherit `attendeeId` from original package
4. **Package Removal**: Original package ticket must be removed after expansion
5. **Expansion Tracking**: Expanded tickets marked with `isFromPackage: true` and `originalPackageId`

### Contact Deduplication Rules
1. **Composite Key**: `firstName:lastName:email` (all lowercase)
2. **Not Email Alone**: Multiple contacts can share email if names differ
3. **Case Insensitive**: All comparisons done in lowercase

### Order Processing Rules
1. **Tax Calculation**: GST 10% inclusive (tax = total / 11)
2. **Order Creation**: One order per registration
3. **Item Mapping**: Each ticket becomes an order line item
4. **Status Sync**: Order status matches payment status

## Test Scripts Created

### Package Testing
- `scripts/test-package-expansion.ts`: Comprehensive package expansion test
- `scripts/test-package-direct.ts`: Direct package analysis without full sync
- `scripts/debug-registration-tickets.ts`: Debug specific registration tickets
- `scripts/test-single-registration-sync.ts`: Test single registration processing

### Verification Scripts
- `scripts/create-missing-event-tickets.ts`: Create missing event ticket entries
- `scripts/verify-id-indexes.ts`: Verify all indexes created correctly

## Database Collections Modified

### Primary Collections
- `import_registrations`: Source registration data
- `import_payments`: Payment records with deduplication
- `import_tickets`: Processed tickets with ownership
- `import_attendees`: Attendee records
- `import_contacts`: Deduplicated contacts
- `orders`: New order documents

### Reference Collections
- `packages`: Package definitions with includedItems
- `event_tickets`: Event ticket catalog
- `events`: Event definitions

## Sync Flow

1. **Registration Processing**
   - Load registration from import_registrations
   - Extract booking contact and attendees
   - Detect and expand packages FIRST
   - Process all tickets

2. **Package Expansion** (if packages found)
   - Identify package tickets (isPackage: true)
   - Use eventTicketId as packageId for lookup
   - Create individual tickets from includedItems
   - Inherit attendeeId to all expanded tickets
   - Remove original package ticket

3. **Contact Processing**
   - Create/update contacts with composite key deduplication
   - Link to registration and attendees

4. **Ticket Processing**
   - Assign ticketOwner (purchaser) and ticketHolder (attendee)
   - Track modification history
   - Maintain package expansion metadata

5. **Order Processing** (final step)
   - Transform registration to Order document
   - Calculate taxes and totals
   - Create order line items from tickets

## Environment Variables Required

```bash
MONGODB_URI=mongodb://...
MONGODB_URI_LODGETIX_SYNC=mongodb://... (optional, falls back to MONGODB_URI)
STRIPE_SECRET_KEY=sk_...
SQUARE_ACCESS_TOKEN=...
SQUARE_ENVIRONMENT=production
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

## Known Issues Resolved

1. **Package Creating Only 3 Tickets**: Fixed by understanding eventTicketId IS packageId
2. **Contact Duplication**: Fixed with composite key
3. **Missing Event Tickets**: Created script to add missing entries
4. **Database Connection**: Falls back to MONGODB_URI if LODGETIX_SYNC not found

## Verification Steps

1. Run `npx tsx scripts/test-package-direct.ts` to verify package detection
2. Run `npx tsx scripts/debug-registration-tickets.ts` to analyze tickets
3. Check indexes with `npx tsx scripts/verify-id-indexes.ts`
4. Review sync logs in `sync-logs/` directory

## Production Readiness

✅ Contact deduplication implemented correctly
✅ Package expansion working with proper rules
✅ Ticket ownership structure maintained
✅ Order processing integrated
✅ Database indexes optimized
✅ Error handling and logging in place
✅ Test coverage with multiple verification scripts

The sync system is now production-ready with all requested features implemented and tested.