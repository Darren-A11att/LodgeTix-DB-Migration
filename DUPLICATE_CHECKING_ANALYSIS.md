# Duplicate Checking Analysis - MongoDB Sync System

## Overview
The sync system implements multiple layers of duplicate detection across all collections to prevent data duplication and maintain data integrity.

## Duplicate Checking by Collection

### 1. **import_payments / payments**
**Primary Key:** `id` (payment ID from provider)
**Duplicate Check Parameters:**
- **By ID:** Checks if payment with same `id` already exists
- **By Order ID:** Prevents multiple payments for same `orderId`
- **By Time Window:** Detects payments from same customer with same amount within 60 seconds
- **By Update Timestamp:** Compares `updatedAt` timestamps to detect re-processing

**Implementation (enhanced-payment-sync.ts):**
```typescript
// Line 606: Check by payment ID
const existingPayment = await db.collection('import_payments').findOne({ id: payment.id });

// Line 609: Check in production
const existingProductionPayment = await db.collection('payments').findOne({ id: payment.id });

// Line 650: Check for duplicate orderId
const existingOrderPayments = await db.collection('import_payments').find({ 
  orderId: payment.orderId,
  id: { $ne: payment.id }
}).toArray();

// Line 674: Check for duplicate within time window
const duplicateTimePayments = await db.collection('import_payments').find({
  customerId: payment.customerId,
  'totalMoney.amount': payment.totalMoney.amount,
  updatedAt: {
    $gte: new Date(paymentTime - timeWindow),
    $lte: new Date(paymentTime + timeWindow)
  },
  id: { $ne: payment.id }
}).toArray();
```

**Actions on Duplicate:**
- Records as error in `error_payments` collection
- Skips processing if already in production
- Logs detailed error message with timestamps

### 2. **import_registrations / registrations**
**Primary Key:** `id` (registration ID)
**Duplicate Check Parameters:**
- **By ID:** Checks if registration with same `id` exists

**Implementation:**
```typescript
// Line 868 & 1189: Check in production
const existingProductionRegistration = await db.collection('registrations').findOne({ id: registration.id });

// Line 880 & 1202: Upsert operation
await db.collection('import_registrations').replaceOne(
  { id: registration.id },
  registrationImport,
  { upsert: true }
);
```

**Actions on Duplicate:**
- Skips if already in production
- Updates (replaces) if exists in import collection

### 3. **import_tickets / tickets**
**Primary Key:** `ticketId`
**Duplicate Check Parameters:**
- **By Ticket ID:** Unique ticket identifier

**Implementation:**
```typescript
// Line 1295: Check in production
const existingProductionTicket = await db.collection('tickets').findOne({ ticketId: ticket.ticketId });

// Line 1308: Upsert operation
await db.collection('import_tickets').replaceOne(
  { ticketId: ticket.ticketId },
  ticketImport,
  { upsert: true }
);
```

**Actions on Duplicate:**
- Skips if already in production
- Updates (replaces) if exists in import collection

### 4. **import_attendees / attendees**
**Primary Key:** `attendeeId`
**Duplicate Check Parameters:**
- **By Attendee ID:** Unique attendee identifier

**Implementation:**
```typescript
// Line 1340: Check in production
const existingProductionAttendee = await db.collection('attendees').findOne({ attendeeId: attendee.attendeeId });

// Line 1352: Upsert operation
await db.collection('import_attendees').replaceOne(
  { attendeeId: attendee.attendeeId },
  attendeeImport,
  { upsert: true }
);
```

**Actions on Duplicate:**
- Skips if already in production
- Updates (replaces) if exists in import collection

### 5. **import_contacts / contacts**
**Primary Key:** `email` (changed from composite key)
**Composite Key (New):** `firstName:lastName:email`
**Duplicate Check Parameters:**
- **By Email:** Primary deduplication method
- **By Composite Key:** `firstName:lastName:email` (case-insensitive)
- **By UniqueKey (Legacy):** MD5 hash of email+mobile+lastName+firstName

**Implementation:**
```typescript
// Line 791-794: Generate composite key
const firstName = (contactData.firstName || '').toLowerCase().trim();
const lastName = (contactData.lastName || '').toLowerCase().trim();
const email = (contactData.email || '').toLowerCase().trim();
const uniqueKey = `${firstName}:${lastName}:${email}`.toLowerCase();

// Line 1555: Check by email
let existingContact = await db.collection('import_contacts').findOne({ 'data.email': email });

// Line 1559: Fallback to uniqueKey
if (!existingContact) {
  existingContact = await db.collection('import_contacts').findOne({ 'data.uniqueKey': uniqueKey });
}

// Line 1644: Upsert operation
await db.collection('import_contacts').replaceOne(
  { 'data.email': email },
  contactImport,
  { upsert: true }
);
```

**Actions on Duplicate:**
- Merges roles and sources arrays
- Updates contact information
- Maintains modification history

### 6. **import_customers / customers**
**Primary Key:** `hash` (MD5 of email+lastName+firstName)
**Duplicate Check Parameters:**
- **By Hash:** Composite key hash

**Implementation:**
```typescript
// Line 1433: Check in production
const existingProductionCustomer = await db.collection('customers').findOne({ hash: customerData.hash });

// Line 1447: Upsert operation
await db.collection('import_customers').replaceOne(
  { hash: customerData.hash },
  customerImport,
  { upsert: true }
);
```

**Actions on Duplicate:**
- Skips if already in production
- Updates (replaces) if exists in import collection

### 7. **orders**
**Primary Key:** `orderId`
**Duplicate Check Parameters:**
- **By Order ID:** Unique order identifier
- **By Registration ID:** Links to source registration

**Note:** Order processing is handled by `order-processor.ts` and creates new orders from registrations.

## Special Duplicate Handling

### error_payments Collection
Used to store payments that failed duplicate checks:
- Duplicate payment IDs
- Duplicate order IDs
- Time-window duplicates
- Previously processed payments

### handle-duplicate-error-payments.ts Script
Reconciles duplicates between `import_payments` and `error_payments`:
- Finds matching payments by ID, Stripe charge ID, or Square payment ID
- Marks import_payments as duplicates
- Removes reconciled error_payments

## Duplicate Prevention Strategies

### 1. **Upsert Pattern**
Most collections use `replaceOne` with `{ upsert: true }`:
- Creates new document if doesn't exist
- Replaces entire document if exists
- Ensures single document per unique key

### 2. **Production Check**
All import operations check production collection first:
- Prevents re-importing data already in production
- Maintains data integrity during incremental syncs

### 3. **Session Tracking**
Uses `processedContacts` Map to track within session:
- Prevents processing same contact multiple times in single sync
- Improves performance by reducing database queries

### 4. **Composite Keys**
Multiple fields combined for uniqueness:
- Contacts: firstName:lastName:email
- Customers: email+lastName+firstName hash
- Payments: customerId+amount+timestamp

### 5. **Time Window Detection**
For payments, checks for duplicates within time windows:
- 60-second window for same customer/amount
- Prevents double-charging from UI issues

## Summary

**Duplicate checking is comprehensive across all collections:**

| Collection | Primary Key | Additional Checks | Action on Duplicate |
|------------|-------------|-------------------|-------------------|
| payments | id | orderId, time window, amount+customer | Error recording or skip |
| registrations | id | - | Skip or update |
| tickets | ticketId | - | Skip or update |
| attendees | attendeeId | - | Skip or update |
| contacts | email | firstName:lastName:email, uniqueKey | Merge and update |
| customers | hash | - | Skip or update |
| orders | orderId | registrationId | Create new |

**Key Features:**
- ✅ Multi-level duplicate detection
- ✅ Production data protection
- ✅ Error tracking for failed duplicates
- ✅ Composite key support for complex deduplication
- ✅ Time-based duplicate detection for payments
- ✅ Session-level duplicate prevention