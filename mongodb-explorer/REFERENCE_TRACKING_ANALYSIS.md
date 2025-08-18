# Reference Tracking Analysis - MongoDB Sync System

## Current State: PARTIAL Implementation

The sync system currently has **PARTIAL** reference tracking when extracting embedded documents. Here's what happens:

## What IS Being Tracked

### 1. **Ticket ObjectIds Collection**
```typescript
// Line 1292: Array to collect ticket ObjectIds
const ticketIds: ObjectId[] = [];

// Line 1317: After creating/updating each ticket
const existingTicket = await db.collection('import_tickets').findOne({ ticketId: ticket.ticketId });
ticketIds.push(existingTicket!._id);
```
The system DOES collect the ObjectIds of created tickets in an array.

### 2. **Attendee-Ticket Linking**
```typescript
// Lines 1325-1331: Tickets are linked to attendees
const attendeeTickets = tickets
  .filter((t: any, idx: number) => idx % attendees.length === i)
  .map((t: any) => ({
    importTicketId: ticketIds[tickets.indexOf(t)],  // <-- Uses collected ObjectIds
    name: t.eventName,
    status: t.status
  }));

// Line 1336: Added to attendee document
eventTickets: attendeeTickets
```
Attendees DO get references to their associated tickets via `importTicketId`.

### 3. **Contact Reference Tracking**
Contacts maintain extensive reference tracking:
```typescript
interface Contact {
  customerRef?: ObjectId;      // Link to customer record
  attendeeRefs: ObjectId[];    // Links to attendee records
  registrationRefs: ObjectId[]; // Links to registrations
}
```

### 4. **Customer-Registration Linking**
```typescript
// Line 1470: Registration updated with customer ObjectId
await db.collection('import_registrations').updateOne(
  { id: registration.id },
  {
    $set: {
      'registrationData.bookingContact': customerId,  // <-- Replaces embedded object with ObjectId
      'metadata.customerId': customerId,
      'metadata.customerUUID': customerData.customerId
    }
  }
);
```
The booking contact IS replaced with an ObjectId reference after customer creation.

## What is NOT Being Tracked

### 1. **Registration Ticket References** ❌
**CRITICAL FINDING**: After extracting tickets, the registration is NOT updated with references to the created ticket ObjectIds.

The `ticketIds` array is populated but never written back to the registration:
- No `metadata.ticketRefs` field created
- No `extractedTickets` array added
- Original embedded tickets remain in `registrationData.tickets`

### 2. **Registration Attendee References** ❌
Similarly, attendee ObjectIds are not stored back in the registration:
- No `metadata.attendeeRefs` field created
- No `extractedAttendees` array added
- Original embedded attendees remain in `registrationData.attendees`

### 3. **Bidirectional References** ⚠️
While attendees know their tickets, tickets don't know their attendees:
- Attendees have `eventTickets` with `importTicketId` references ✅
- Tickets don't have `attendeeRef` back to the attendee ❌

## Impact Analysis

### Current Problems:
1. **Data Duplication**: Original embedded documents remain in registration after extraction
2. **Lost Traceability**: Can't easily find all tickets/attendees from a registration
3. **Sync Complexity**: Re-syncing might create duplicates since embedded data still exists
4. **Query Difficulty**: Need to search by IDs rather than ObjectId references

### What Works:
1. **Deduplication**: Using unique IDs prevents duplicate creation
2. **Attendee-Ticket Link**: Attendees can find their tickets
3. **Contact Aggregation**: Contacts properly aggregate references
4. **Customer Replacement**: Booking contact properly replaced with ObjectId

## Recommended Fixes

### 1. **Add Reference Arrays to Registration**
After extracting tickets and attendees, update the registration:
```typescript
// After processing all tickets and attendees
await db.collection('import_registrations').updateOne(
  { id: registration.id },
  {
    $set: {
      'metadata.extractedTicketRefs': ticketIds,
      'metadata.extractedAttendeeRefs': attendeeIds,
      'metadata.extractionCompleted': true,
      'metadata.extractionDate': new Date()
    }
  }
);
```

### 2. **Add Backward References**
Update tickets with their attendee references:
```typescript
// When creating ticket document
const ticketImport = {
  ...ticketData,
  metadata: {
    ...metadata,
    attendeeRef: attendeeObjectId,
    registrationRef: registrationObjectId
  }
};
```

### 3. **Optional: Remove Embedded Data**
After successful extraction, optionally remove embedded data:
```typescript
// After all extractions complete
await db.collection('import_registrations').updateOne(
  { id: registration.id },
  {
    $unset: {
      'registrationData.tickets': '',
      'registrationData.attendees': ''
    }
  }
);
```

## Summary

**Current Reference Tracking Status:**
- ✅ Ticket ObjectIds are collected during extraction
- ✅ Attendees receive ticket references
- ✅ Contacts track all their relationships
- ✅ Customer ObjectId replaces booking contact
- ❌ Registration doesn't store extracted ticket/attendee references
- ❌ Tickets don't have backward references to attendees
- ❌ Original embedded data remains in registration

The system is **halfway there** - it collects the references but doesn't store them back in the source document. This is a significant gap that should be addressed for proper data normalization and reference integrity.