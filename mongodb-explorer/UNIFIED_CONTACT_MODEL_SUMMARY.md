# Unified Contact Data Model Implementation Summary

## Overview
Successfully implemented a unified contact data model that prevents duplication by using email as the primary deduplication key and tracking multiple roles for the same person.

## New Contact Model Structure

```typescript
interface Contact {
  _id?: ObjectId;
  title: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string; // Primary deduplication key
  address: string;
  state: string;
  postcode: string;
  country: string;
  relationships?: any;
  memberships?: any;
  uniqueKey: string; // Backup key: email + mobile + lastName + firstName
  roles: Array<'customer' | 'attendee'>; // Track where this person appears
  sources: Array<'registration' | 'attendee'>; // Legacy field for backward compatibility
  linkedPartnerId?: ObjectId;
  // Reference tracking
  customerRef?: ObjectId; // Link to customer record if they made bookings
  attendeeRefs: ObjectId[]; // Links to attendee records where they attend
  registrationRefs: ObjectId[]; // Links to all associated registrations
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastSeenAs: 'customer' | 'attendee'; // Most recent role seen
}
```

## Key Features Implemented

### 1. Email-Based Deduplication
- **Primary Key**: Email address (normalized to lowercase)
- **Fallback Key**: Original uniqueKey (MD5 hash) for backward compatibility
- **Validation**: Contacts without email are skipped with warning

### 2. Role-Based Contact Management
- **Multiple Roles**: Same person can be both 'customer' and 'attendee'
- **Role Tracking**: Array tracks all roles where person appears
- **Role Merging**: When same email found, roles are merged automatically

### 3. Reference Linking
- **Customer Reference**: Links to customer record if person made bookings
- **Attendee References**: Array of links to all attendee records
- **Registration References**: Array of links to all associated registrations

### 4. Enhanced processContact Function
- **Parameters**: `processContact(data, source, db, registrationRef?, attendeeRef?, customerRef?)`
- **Return Value**: Returns ObjectId of contact for linking purposes
- **Deduplication Logic**: 
  1. Check by email in processed contacts map
  2. Check by email in import_contacts collection
  3. Fallback to uniqueKey for backward compatibility
  4. Check production collection by email then uniqueKey

### 5. Contact Merging Logic
When existing contact found:
- Updates contact info with latest data
- Merges roles using `Array.from(new Set())` for deduplication
- Merges all reference arrays
- Updates timestamps and lastSeenAs field

### 6. Customer-Contact Linking
- **Automatic Linking**: Customer creation now links back to unified contact
- **Reference Update**: Contact gets customerRef when customer is created
- **Bidirectional**: Both customer and contact reference each other

## Updated Processing Flow

### Before (Creates Duplicates)
```
Registration: John Doe (john@example.com) → Contact 1 [source: registration]
Attendee: John Doe (john@example.com) → Contact 2 [source: attendee]
```

### After (Unified Contact)
```
Registration: John Doe (john@example.com) → Contact 1 [roles: [customer], customerRef: ObjectId]
Attendee: John Doe (john@example.com) → Contact 1 [roles: [customer, attendee], attendeeRefs: [ObjectId]]
```

## Database Changes

### Collection Updates
- **import_contacts**: Now uses email as primary identifier
- **Indexing**: Collection mapping updated to use 'email' instead of 'uniqueKey'

### Processed Contacts Map
- **Key Change**: Now keyed by email instead of uniqueKey
- **Purpose**: Tracks contacts processed in current sync session

## Backward Compatibility

### Maintained Features
- **uniqueKey Field**: Still generated and used as fallback
- **sources Array**: Maintains legacy source tracking
- **Existing Data**: Old contacts will work with new system

### Migration Strategy
- **Gradual Migration**: New contacts use email, old contacts still work
- **Dual Lookup**: System checks both email and uniqueKey
- **No Breaking Changes**: Existing code continues to function

## Error Handling

### Validation
- **Email Required**: Contacts without email are skipped with warning
- **Null Safety**: All array operations use null-safe approaches
- **Graceful Fallback**: Falls back to uniqueKey if email lookup fails

### Logging
- **Detailed Logging**: Reports role merging and contact updates
- **Status Tracking**: Clear indication of new vs. updated contacts
- **Reference Linking**: Logs successful customer-contact linking

## Performance Optimizations

### Efficient Lookups
- **Email Indexing**: Primary lookups by email (should be indexed)
- **Batch Operations**: Uses MongoDB's $addToSet for array updates
- **Single Queries**: Minimal database round trips per contact

### Memory Usage
- **Map Caching**: Processed contacts cached by email in memory
- **Array Deduplication**: Set operations prevent duplicate references

## Benefits Achieved

### 1. No More Duplicates
- Same person appears once regardless of roles
- Email serves as reliable deduplication key
- Automatic merging of multiple appearances

### 2. Complete Relationship Tracking
- Contact knows all their roles (customer, attendee)
- Contact has references to all related records
- Full audit trail of all registrations

### 3. Data Integrity
- Bidirectional references between contacts and customers
- Consistent data across all related collections
- No orphaned records

### 4. Query Efficiency
- Single contact lookup returns all person information
- Reduced join queries needed
- Faster reporting and analysis

## Usage Examples

### Finding All Roles for a Person
```javascript
const contact = await db.collection('contacts').findOne({ email: 'john@example.com' });
console.log(`Roles: ${contact.roles.join(', ')}`); // "customer, attendee"
```

### Finding Customer from Contact
```javascript
const contact = await db.collection('contacts').findOne({ email: 'john@example.com' });
if (contact.customerRef) {
  const customer = await db.collection('customers').findOne({ _id: contact.customerRef });
}
```

### Finding All Attendee Records for Contact
```javascript
const contact = await db.collection('contacts').findOne({ email: 'john@example.com' });
const attendees = await db.collection('attendees').find({ 
  _id: { $in: contact.attendeeRefs } 
}).toArray();
```

## Implementation Status
✅ Contact interface updated with roles and references  
✅ Email-based deduplication implemented  
✅ Enhanced processContact function with role merging  
✅ Customer-contact linking implemented  
✅ Reference tracking for attendees and registrations  
✅ Backward compatibility maintained  
✅ Error handling and validation added  
✅ TypeScript compilation issues resolved  

The unified contact data model is now ready for production use and will prevent duplicate contact creation while maintaining full relationship tracking.