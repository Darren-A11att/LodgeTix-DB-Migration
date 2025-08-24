# Supabase to MongoDB Field Mapping Documentation

Generated: 2025-08-24

## Overview

This document defines the field mappings between Supabase (PostgreSQL with UUIDs) and MongoDB collections. 

## Dual-ID Strategy

**CRITICAL**: We maintain TWO separate ID systems for each document:

1. **MongoDB `_id`**: ObjectId for MongoDB's internal operations
2. **Supabase UUID fields**: Preserved as strings for traceability to source

This dual-ID approach gives us:
- ✅ Native MongoDB performance and indexing with ObjectIds
- ✅ Complete traceability back to Supabase source records
- ✅ Ability to sync and reconcile data between systems
- ✅ Support for MongoDB relationships while maintaining Supabase links

## Key Principles

1. **Dual IDs**: Every document has MongoDB `_id` (ObjectId) AND Supabase ID (UUID string)
2. **UUID Preservation**: All UUID fields from Supabase remain as strings, never converted to ObjectIds
3. **Field Name Transformation**: Snake_case from Supabase → camelCase in MongoDB
4. **Type Safety**: Each field has a defined type that must be respected
5. **Relationship Integrity**: Foreign key relationships use UUID strings

## Collection Mappings

### REGISTRATIONS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| registration_id | registrationId | uuid | Yes | Primary identifier |
| function_id | functionId | uuid | No | Links to functions/events |
| event_id | eventId | uuid | No | Parent event reference |
| organisation_id | organisationId | uuid | No | Organization reference |
| contact_id | contactId | uuid | No | Primary contact |
| booking_contact_id | bookingContactId | uuid | No | Booking contact |
| package_id | packageId | uuid | No | Package/bundle reference |
| lodge_id | lodgeId | uuid | No | Lodge reference |
| customer_id | customerId | uuid | No | Customer reference |
| stripe_payment_intent_id | stripePaymentIntentId | string | No | Stripe payment reference |
| stripe_charge_id | stripeChargeId | string | No | Stripe charge reference |
| square_payment_id | squarePaymentId | string | No | Square payment reference |
| square_order_id | squareOrderId | string | No | Square order reference |
| payment_status | paymentStatus | string | No | Payment status |
| total_amount | totalAmount | number | No | Total amount |
| created_at | createdAt | date | No | Creation timestamp |
| updated_at | updatedAt | date | No | Last update timestamp |

### ORDERS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| order_id | orderId | uuid | Yes | Primary identifier |
| customer_id | customerId | uuid | Yes | Customer reference |
| contact_id | contactId | uuid | No | Contact reference |
| function_id | functionId | uuid | No | Function/event reference |
| registration_id | registrationId | uuid | No | Source registration |
| stripe_payment_intent_id | stripePaymentIntentId | string | No | Stripe reference |
| square_order_id | squareOrderId | string | No | Square reference |
| subtotal | subtotal | number | No | Subtotal amount |
| total_amount | totalAmount | number | No | Total amount |
| payment_status | paymentStatus | string | No | Payment status |
| order_date | orderDate | date | No | Order date |

### TICKETS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| ticket_id | ticketId | uuid | Yes | Primary identifier |
| event_ticket_id | eventTicketId | uuid | No | Event ticket type |
| registration_id | registrationId | uuid | No | Parent registration |
| attendee_id | attendeeId | uuid | No | Assigned attendee |
| function_id | functionId | uuid | No | Function/event |
| event_id | eventId | uuid | No | Parent event |
| contact_id | contactId | uuid | No | Contact reference |

### ATTENDEES Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| attendee_id | attendeeId | uuid | Yes | Primary identifier |
| contact_id | contactId | uuid | No | Contact reference |
| registration_id | registrationId | uuid | No | Parent registration |
| ticket_id | ticketId | uuid | No | Assigned ticket |
| lodge_id | lodgeId | uuid | No | Lodge affiliation |
| organisation_id | organisationId | uuid | No | Organization |

### CONTACTS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| contact_id | contactId | uuid | Yes | Primary identifier |
| organisation_id | organisationId | uuid | No | Organization |
| partner_id | partnerId | uuid | No | Partner reference |
| linked_partner_id | linkedPartnerId | uuid | No | Linked partner |
| created_by | createdBy | uuid | No | Creator user |
| updated_by | updatedBy | uuid | No | Last updater |

### CUSTOMERS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| customer_id | customerId | uuid | Yes | Primary identifier |
| contact_id | contactId | uuid | No | Primary contact |
| organisation_id | organisationId | uuid | No | Organization |
| stripe_customer_id | stripeCustomerId | string | No | Stripe customer ID |
| square_customer_id | squareCustomerId | string | No | Square customer ID |

### PAYMENTS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| payment_id | paymentId | uuid | Yes | Primary identifier |
| registration_id | registrationId | uuid | No | Related registration |
| order_id | orderId | uuid | No | Related order |
| customer_id | customerId | uuid | No | Customer reference |
| invoice_id | invoiceId | uuid | No | Invoice reference |
| stripe_payment_intent_id | stripePaymentIntentId | string | No | Stripe intent |
| stripe_charge_id | stripeChargeId | string | No | Stripe charge |
| square_payment_id | squarePaymentId | string | No | Square payment |

### FUNCTIONS Collection

| Supabase Field | MongoDB Field | Type | Required | Notes |
|----------------|---------------|------|----------|-------|
| function_id | functionId | uuid | Yes | Primary identifier |
| event_id | eventId | uuid | No | Parent event |
| venue_id | venueId | uuid | No | Venue reference |
| organisation_id | organisationId | uuid | No | Organization |
| created_by | createdBy | uuid | No | Creator user |

## Implementation Examples

### Correct Dual-ID Pattern

```javascript
// ✅ CORRECT - Dual ID Strategy
const order = {
  // MongoDB ID for internal operations
  _id: new ObjectId(),  // e.g., ObjectId('507f1f77bcf86cd799439011')
  
  // Supabase UUID preserved as string
  orderId: '123e4567-e89b-12d3-a456-426614174000',  // Original Supabase order_id
  
  // Foreign key references use UUID strings
  customerId: '456e7890-e89b-12d3-a456-426614174001',  // Links to customer
  functionId: '789abcde-e89b-12d3-a456-426614174002',  // Links to function
  
  // External system references for traceability
  externalIds: {
    lodgetixOrderId: '123e4567-e89b-12d3-a456-426614174000',  // Source registration
    stripePaymentIntentId: 'pi_3MtwBwLkdIwHu7ix28a3tqPa'  // Stripe reference
  }
};

// ❌ INCORRECT - Don't convert UUIDs to ObjectIds
const wrongOrder = {
  _id: '123e4567-e89b-12d3-a456-426614174000',  // WRONG - _id should be ObjectId
  orderId: new ObjectId('123e4567-e89b-12d3-a456-426614174000'),  // WRONG - UUIDs must stay as strings
};
```

### Field Mapping in Practice

```javascript
// Import from Supabase
const supabaseRegistration = {
  registration_id: '123e4567-e89b-12d3-a456-426614174000',
  function_id: '456e7890-e89b-12d3-a456-426614174001',
  payment_status: 'paid',
  total_amount: 150.00
};

// Mapped to MongoDB with Dual-ID Strategy
const mongoRegistration = {
  _id: new ObjectId(),  // MongoDB ObjectId for internal use
  registrationId: '123e4567-e89b-12d3-a456-426614174000',  // Preserved Supabase UUID
  functionId: '456e7890-e89b-12d3-a456-426614174001',      // Preserved reference UUID
  paymentStatus: 'paid',
  totalAmount: 150.00,
  // Metadata for tracking
  _metadata: {
    source: 'supabase',
    importedAt: new Date(),
    originalId: '123e4567-e89b-12d3-a456-426614174000'
  }
};
```

### Querying with UUIDs

```javascript
// Finding related documents
const registration = await db.collection('import_registrations').findOne({
  registrationId: '123e4567-e89b-12d3-a456-426614174000'  // String comparison
});

const order = await db.collection('orders').findOne({
  'externalIds.lodgetixOrderId': registration.registrationId  // UUID string
});

// Aggregation with UUID joins
const results = await db.collection('orders').aggregate([
  {
    $lookup: {
      from: 'import_registrations',
      localField: 'externalIds.lodgetixOrderId',  // UUID string field
      foreignField: 'registrationId',              // UUID string field
      as: 'registration'
    }
  }
]).toArray();
```

## Common Pitfalls to Avoid

1. **Never convert UUIDs to ObjectIds** - They have different formats and lengths
2. **Always include both IDs** - Every document needs `_id` (ObjectId) AND its Supabase UUID field
3. **Use correct ID for operations**:
   - Use `_id` for MongoDB operations (updates, deletes)
   - Use UUID fields for cross-references and relationships
   - Use UUID fields for syncing with Supabase
4. **Always use string comparison for UUIDs** - MongoDB can index and query UUID strings efficiently
5. **Preserve original UUID format** - Don't transform or reformat UUIDs
6. **Check field naming** - Supabase uses snake_case, MongoDB uses camelCase

## Verification

Run the verification scripts to ensure proper field mapping:

```bash
# Verify UUID field preservation
node scripts/verify-uuid-fields.js

# Verify dual-ID strategy implementation
node scripts/verify-dual-ids.js
```

These scripts will check:
- All documents have MongoDB `_id` (ObjectId)
- All documents have preserved Supabase UUID fields
- UUID fields are stored as strings (not ObjectIds)
- No incorrect ObjectId conversions
- Proper linking between collections
- Field naming conventions

## Example Query Patterns

```javascript
// Finding by MongoDB ID (fast, indexed)
const order = await db.collection('orders').findOne({ 
  _id: new ObjectId('507f1f77bcf86cd799439011') 
});

// Finding by Supabase UUID (for sync operations)
const order = await db.collection('orders').findOne({ 
  orderId: '123e4567-e89b-12d3-a456-426614174000' 
});

// Cross-collection join using UUID
const ordersWithRegistrations = await db.collection('orders').aggregate([
  {
    $lookup: {
      from: 'import_registrations',
      localField: 'externalIds.lodgetixOrderId',  // UUID string
      foreignField: 'registrationId',              // UUID string
      as: 'registration'
    }
  }
]).toArray();
```

## Migration Notes

When migrating data from Supabase to MongoDB:

1. Use the `mapSupabaseToMongo()` function from `src/services/sync/supabase-field-mapper.ts`
2. Validate required fields before insertion
3. Preserve all UUID relationships as strings
4. Add metadata for audit trail

## Related Files

- `/src/services/sync/supabase-field-mapper.ts` - Field mapping service
- `/src/services/sync/order-processor.ts` - Order processing with UUID handling
- `/scripts/verify-uuid-fields.js` - Verification script
- `/mongodb-explorer/scripts/migration/field-mappings.ts` - Legacy field mappings