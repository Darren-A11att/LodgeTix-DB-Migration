# Contacts Collection Schema

## Overview
The contacts collection represents all people who interact with the event ticketing system - attendees, booking contacts, billing contacts, organization representatives, and event hosts. Every person has one contact record, with their various roles tracked in context.

## Document Structure

```javascript
{
  "_id": ObjectId,
  "contactId": "550e8400-e29b-41d4-a716-446655440000", // UUID v4
  
  // Core Identity
  "firstName": "John",
  "lastName": "Smith", 
  "preferredName": "Jack",
  "title": "Mr", // Mr, Mrs, Ms, Dr, Rev, etc.
  
  // Contact Information (from attendees)
  "email": "john.smith@example.com",
  "phone": "+61 400 123 456", // normalized format
  "mobile": "+61 400 123 456", // can be same as phone
  "alternatePhone": null,
  
  // Address (from booking/billing contacts)
  "address": {
    "line1": "123 Main Street",
    "line2": "Unit 4",
    "city": "Sydney",
    "state": "NSW", 
    "postcode": "2000",
    "country": "Australia"
  },
  
  // Masonic Profile (from attendees)
  "masonicProfile": {
    "isMason": true,
    "title": "WBro", // Masonic title
    "rank": "PM", // Past Master
    "grandRank": "PSGD", // Past Senior Grand Deacon
    "grandOffice": null,
    "grandOfficer": false,
    "grandLodgeId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11",
    "grandLodgeName": "United Grand Lodge of NSW & ACT",
    "lodgeId": "7f4e9b2a-1234-5678-9012-3456789abcde",
    "lodgeName": "Lodge Horace Thompson Ryde No. 134",
    "lodgeNumber": "134"
  },
  
  // Event Participation (replaces roles array)
  "registrations": {
    // Registration ID -> Participation details
    "685beba0-1234-5678-9012-123456789012": {
      "role": "attendee", // attendee, bookingContact, billingContact
      "functionId": "685beba0b2fa6b693adaba43",
      "functionName": "Grand Proclamation 2025",
      "eventId": "evt-123",
      "eventName": "Installation Ceremony",
      "tableNumber": "12",
      "seatNumber": "A",
      "registeredAt": ISODate("2024-08-15T10:30:00Z"),
      "registeredBy": "550e8400-1111-2222-3333-444444444444" // contact who made booking
    },
    "685beba0-5678-9012-3456-789012345678": {
      "role": "bookingContact",
      "functionId": "685beba0b2fa6b693adaba44",
      "functionName": "Ladies Festival 2025",
      "bookingsManaged": 15, // number of attendees they booked
      "registeredAt": ISODate("2024-09-01T14:00:00Z")
    }
  },
  
  // Organization Affiliations
  "organizations": {
    // Organization ID -> Role details
    "3e893fa6-2cc2-448c-be9c-e3858cc90e11": {
      "organizationName": "Lodge Horace Thompson Ryde No. 134",
      "role": "secretary", // secretary, treasurer, member, etc.
      "startDate": ISODate("2023-06-01T00:00:00Z"),
      "endDate": null,
      "isCurrent": true
    }
  },
  
  // Event Hosting
  "hosting": {
    // Function ID -> Host details
    "685beba0b2fa6b693adaba45": {
      "functionName": "Lodge Installation 2025",
      "role": "organizer", // organizer, coordinator, host
      "startDate": ISODate("2024-01-01T00:00:00Z"),
      "responsibilities": ["venue", "catering", "program"]
    }
  },
  
  // Partner/Emergency Contact Relationships
  "relationships": {
    "partners": [{
      "contactId": "550e8400-aaaa-bbbb-cccc-dddddddddddd",
      "relationshipType": "spouse", // spouse, partner, child, parent
      "name": "Jane Smith", // denormalized for convenience
      "isPrimary": true
    }],
    "emergencyContacts": [{
      "contactId": "550e8400-eeee-ffff-0000-111111111111",
      "name": "Mary Smith",
      "relationship": "sister",
      "phone": "+61 400 999 888"
    }]
  },
  
  // Additional Profile Data
  "profile": {
    "dateOfBirth": ISODate("1965-03-15T00:00:00Z"),
    "dietaryRequirements": ["vegetarian", "gluten-free"],
    "specialNeeds": "Wheelchair access required",
    "preferredCommunication": "email" // email, sms, phone, post
  },
  
  // System Fields
  "hasUserAccount": true, // indicates if linked to users collection
  "isActive": true,
  "tags": ["vip", "past-master", "regular-attendee"],
  
  // Metadata
  "source": "attendee", // attendee, registration, import, manual
  "createdAt": ISODate("2024-01-15T10:00:00Z"),
  "updatedAt": ISODate("2024-10-01T15:30:00Z"),
  "createdBy": "system",
  "updatedBy": "user-123"
}
```

## Field Definitions

### Core Fields
- `contactId`: UUID v4 unique identifier
- `firstName/lastName`: Legal name
- `preferredName`: What they prefer to be called
- `title`: Honorific (Mr, Mrs, Dr, etc.)

### Contact Information
- `email`: Primary email address
- `phone/mobile`: Phone numbers (normalized)
- `address`: Physical address (from booking/billing contacts)

### Masonic Profile
Complete masonic details migrated from attendees:
- `title`: Masonic title (WBro, VWBro, etc.)
- `rank`: Current rank (EA, FC, MM, PM, etc.)
- `grandRank`: Grand Lodge rank if applicable
- `grandLodge/lodge`: Membership details with IDs and names

### Context-Based Roles
Instead of a roles array, we use three objects:
- `registrations`: Event attendance and booking roles
- `organizations`: Organizational affiliations
- `hosting`: Events they organize/host

### Relationships
- `partners`: Family relationships (from attendee data)
- `emergencyContacts`: Emergency contact information

## Business Rules

### Contact Creation
1. **From Attendees**: Migrate all personal and masonic data
2. **From Booking Contacts**: Always create contact AND user
3. **From Billing Contacts**: Always create contact AND user
4. **Address Priority**: Use billing address, then booking address

### Duplicate Prevention
1. Check existing by email (case-insensitive)
2. Check existing by phone (normalized)
3. If found, merge data:
   - Add new registrations
   - Update masonic profile if more complete
   - Keep most recent contact info

### Required User Creation
Contacts MUST have user accounts if they are:
- Booking contacts (need to manage bookings)
- Billing contacts (need to access invoices)
- Organization representatives (need organization access)
- Event hosts (need to manage events)

### ID Format
- All IDs must be UUID v4
- Do NOT use sequential numbers
- Maintain referential integrity

## Indexes
- `contactId` - Unique identifier
- `email` - Unique, sparse (for lookups)
- `phone` - Sparse (for lookups)
- `firstName, lastName` - Compound (for name search)
- `masonicProfile.lodgeId` - For lodge member queries
- `registrations.functionId` - For event attendee lists
- `organizations.organizationId` - For org member lists

## Migration Notes

### From Attendees
- Map all personal fields
- Map complete masonic profile
- Map partner relationships
- Link to registration context

### From Registrations  
- Create contacts for booking/billing contacts
- Include addresses from these contacts
- Always create corresponding users
- Link to organization if applicable

### From Organizations
- Create contacts for key personnel
- Map their organizational roles

### Handling Duplicates
1. Normalize email (lowercase, trim)
2. Normalize phone (E.164 format)
3. Match on either field
4. Merge data, don't duplicate records