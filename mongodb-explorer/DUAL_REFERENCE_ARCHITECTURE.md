# Dual Reference Architecture - MongoDB Sync System

## 🎯 CRITICAL ARCHITECTURE DECISION

**ALL references between documents MUST store BOTH:**
1. **Business ID** (e.g., `ticketId`, `attendeeId`, `customerId`) - Stable across environments
2. **MongoDB ObjectId** (`_id`) - For efficient database operations

## Why Dual References?

### Business IDs
- ✅ **Stable**: Same ID in dev, staging, and production
- ✅ **Portable**: Work when migrating data between environments
- ✅ **Meaningful**: Human-readable and traceable to source systems
- ❌ **Performance**: String comparisons are slower than ObjectId lookups

### ObjectIds
- ✅ **Performance**: Indexed by default, fastest lookups
- ✅ **Native**: MongoDB's preferred reference type
- ✅ **Joins**: Efficient for `$lookup` aggregations
- ❌ **Environment-specific**: Different in each database instance

### Solution: Store BOTH
By storing both types of references, we get the best of both worlds:
- Use Business IDs for cross-environment operations
- Use ObjectIds for database queries and joins

## Implementation Pattern

### 1. Forward References (Parent → Child)

When a registration references its extracted documents:

```javascript
// Registration document
{
  id: "registration-123",  // Business ID
  _id: ObjectId("..."),     // MongoDB ObjectId
  
  metadata: {
    // Tickets - BOTH IDs stored
    extractedTicketIds: ["ticket-001", "ticket-002"],        // Business IDs
    extractedTicketRefs: [ObjectId("..."), ObjectId("...")], // ObjectIds
    
    // Attendees - BOTH IDs stored
    extractedAttendeeIds: ["attendee-001", "attendee-002"],   // Business IDs
    extractedAttendeeRefs: [ObjectId("..."), ObjectId("...")], // ObjectIds
    
    // Customer - BOTH IDs stored
    extractedCustomerId: "customer-uuid-123",                // Business ID
    extractedCustomerRef: ObjectId("..."),                   // ObjectId
    
    // Metadata
    ticketCount: 2,
    attendeeCount: 2,
    extractionCompleted: true,
    extractionDate: ISODate("2025-01-18")
  }
}
```

### 2. Backward References (Child → Parent)

When extracted documents reference their source:

```javascript
// Ticket document
{
  ticketId: "ticket-001",   // Business ID
  _id: ObjectId("..."),      // MongoDB ObjectId
  
  metadata: {
    // Registration reference - BOTH IDs
    registrationId: "registration-123",     // Business ID
    registrationRef: ObjectId("..."),       // ObjectId
    
    // Attendee reference - BOTH IDs
    attendeeId: "attendee-001",             // Business ID
    attendeeRef: ObjectId("..."),           // ObjectId
    
    // Customer reference - BOTH IDs
    customerId: "customer-uuid-123",        // Business ID
    customerRef: ObjectId("..."),           // ObjectId
    
    extractedFrom: "registration",
    extractionDate: ISODate("2025-01-18")
  }
}
```

### 3. Replacing Embedded Objects

When replacing an embedded object with references:

```javascript
// BEFORE: Embedded object
{
  registrationData: {
    bookingContact: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com"
      // ... full embedded object
    }
  }
}

// AFTER: Dual references
{
  registrationData: {
    bookingContactId: "customer-uuid-123",    // Business ID
    bookingContactRef: ObjectId("...")        // ObjectId
    // Original bookingContact object removed
  }
}
```

## Naming Conventions

### Forward References (Parent → Child)
- Business IDs: `extracted{Type}Ids` (array)
  - `extractedTicketIds`
  - `extractedAttendeeIds`
- ObjectIds: `extracted{Type}Refs` (array)
  - `extractedTicketRefs`
  - `extractedAttendeeRefs`

### Single References
- Business ID: `extracted{Type}Id` (single)
  - `extractedCustomerId`
- ObjectId: `extracted{Type}Ref` (single)
  - `extractedCustomerRef`

### Backward References (Child → Parent)
- Business ID: `{type}Id`
  - `registrationId`
  - `attendeeId`
  - `customerId`
- ObjectId: `{type}Ref`
  - `registrationRef`
  - `attendeeRef`
  - `customerRef`

### Associated/Related References
- Business IDs: `associated{Type}Ids` (array)
  - `associatedTicketIds`
- ObjectIds: `associated{Type}Refs` (array)
  - `associatedTicketRefs`

## Implementation Checklist

### When Extracting Documents

✅ **Step 1: Create/Update the extracted document**
```javascript
const result = await db.collection('import_tickets').replaceOne(
  { ticketId: ticket.ticketId },
  ticketData,
  { upsert: true }
);
```

✅ **Step 2: Get BOTH IDs**
```javascript
const ticketDoc = await db.collection('import_tickets').findOne({ 
  ticketId: ticket.ticketId 
});
const ticketObjectId = ticketDoc._id;
const ticketBusinessId = ticket.ticketId;
```

✅ **Step 3: Store forward references in source**
```javascript
extractedTicketIds.push(ticketBusinessId);    // Business ID
extractedTicketRefs.push(ticketObjectId);     // ObjectId
```

✅ **Step 4: Add backward references to extracted document**
```javascript
await db.collection('import_tickets').updateOne(
  { ticketId: ticket.ticketId },
  {
    $set: {
      'metadata.registrationId': registration.id,      // Business ID
      'metadata.registrationRef': registration._id,    // ObjectId
      'metadata.customerId': customerUUID,             // Business ID
      'metadata.customerRef': customerObjectId         // ObjectId
    }
  }
);
```

✅ **Step 5: Update source with all references**
```javascript
await db.collection('import_registrations').updateOne(
  { id: registration.id },
  {
    $set: {
      'metadata.extractedTicketIds': extractedTicketIds,
      'metadata.extractedTicketRefs': extractedTicketRefs,
      'metadata.extractedAttendeeIds': extractedAttendeeIds,
      'metadata.extractedAttendeeRefs': extractedAttendeeRefs,
      'metadata.extractedCustomerId': customerUUID,
      'metadata.extractedCustomerRef': customerObjectId
    }
  }
);
```

## Query Examples

### Using Business IDs (Cross-environment stable)
```javascript
// Find all tickets for a registration
const tickets = await db.collection('import_tickets').find({
  'metadata.registrationId': 'registration-123'
}).toArray();
```

### Using ObjectIds (Performance optimized)
```javascript
// Efficient lookup using ObjectId
const ticket = await db.collection('import_tickets').findOne({
  _id: ObjectId("507f1f77bcf86cd799439011")
});

// Efficient aggregation with $lookup
db.collection('import_registrations').aggregate([
  {
    $lookup: {
      from: 'import_tickets',
      localField: 'metadata.extractedTicketRefs',
      foreignField: '_id',
      as: 'tickets'
    }
  }
]);
```

## Migration for Existing Data

For data that only has business IDs, add ObjectIds:

```javascript
import { addMissingObjectIdReferences } from './dual-reference-utils';

// Add missing ObjectId references to existing data
const result = await addMissingObjectIdReferences(
  'import_tickets',
  'registrationId',
  db,
  {
    sourceCollection: 'import_registrations',
    sourceBusinessIdField: 'id'
  }
);

console.log(`Updated: ${result.updated}, Failed: ${result.failed}`);
```

## Benefits

1. **Performance**: ObjectId lookups are faster than string comparisons
2. **Portability**: Business IDs work across all environments
3. **Flexibility**: Choose the right ID type for each use case
4. **Integrity**: Can validate references using either ID type
5. **Aggregations**: Efficient `$lookup` operations using ObjectIds
6. **Debugging**: Human-readable business IDs for troubleshooting

## Common Pitfalls to Avoid

❌ **DON'T** store only ObjectIds - You'll lose portability
❌ **DON'T** store only Business IDs - You'll lose performance
❌ **DON'T** forget backward references - You need bidirectional traversal
❌ **DON'T** mix ID types in arrays - Keep separate arrays for each type
❌ **DON'T** use string ObjectIds - Store as actual ObjectId type

## Validation

Use the validation utility to ensure dual references are correct:

```javascript
import { validateDualReferences } from './dual-reference-utils';

const validation = validateDualReferences(document, [
  {
    businessIdField: 'registrationId',
    objectIdField: 'registrationRef',
    fieldName: 'Registration'
  },
  {
    businessIdField: 'customerId',
    objectIdField: 'customerRef',
    fieldName: 'Customer'
  }
]);

if (!validation.valid) {
  console.error('Reference issues:', validation.issues);
}
```

## Summary

The dual reference architecture is **MANDATORY** for all document extractions in the sync system. It ensures both performance and portability by storing both Business IDs and ObjectIds for every reference. This pattern must be followed consistently across all sync scripts and operations.