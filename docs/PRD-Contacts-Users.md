# Product Requirements Document: Contacts & Users

## Overview
This document defines the requirements for Contacts and Users within the LodgeTix Event Ticketing System. Contacts represent people who interact with the system (attendees, booking contacts, billing contacts), while Users are contacts with system access.

## Core Principles
- **Contacts First**: Every person is a Contact first
- **Users are Special Contacts**: Users are contacts with authentication credentials
- **No Duplicates**: One person = one contact record (matched by email OR phone)
- **Context Matters**: A contact's role depends on the context (attendee, booker, host, etc.)
- **UUID v4 for All IDs**: All identifiers use UUID v4 format (except MongoDB's _id)
- **Masonic Data Standards**: Titles without dots (Bro, W Bro, VW Bro, RW Bro, MW Bro) and ranks (EAF, FCF, MM, IM, GL)

## Contact Use Cases

### UC-C1: Event Attendee
**Purpose:** Track people who attend events
- **Source:** Attendee records from registrations
- **Key Data:** Name, masonic profile, contact info
- **Context:** Which registration/event they attended

### UC-C2: Booking Contact
**Purpose:** Person who makes the booking/registration
- **Source:** Registration booking contact
- **Key Data:** Name, email, phone, address
- **Requirement:** MUST also be a User (needs login)

### UC-C3: Billing Contact
**Purpose:** Person responsible for payment
- **Source:** Registration billing contact  
- **Key Data:** Name, email, phone, billing address
- **Requirement:** MUST also be a User (needs login)

### UC-C4: Organization Representative
**Purpose:** People who represent organizations
- **Source:** Organization contacts
- **Key Data:** Name, role, contact info
- **Context:** Which organization and their role

### UC-C5: Event Host
**Purpose:** People who host/organize events
- **Source:** Event/function hosts
- **Key Data:** Name, contact info
- **Context:** Which events they host

## User Use Cases

### UC-U1: System Authentication
**Purpose:** Allow contacts to log into the system
- **Requirement:** Email OR phone as username
- **Authentication:** Password, OAuth, or magic link

### UC-U2: Booking Management
**Purpose:** Manage their bookings and registrations
- **Access:** Their own bookings
- **Actions:** View, modify, cancel registrations

### UC-U3: Organization Management
**Purpose:** Manage organization bookings
- **Access:** Organization's bookings
- **Actions:** Book for members, manage allocations

### UC-U4: Event Hosting
**Purpose:** Create and manage events
- **Access:** Their hosted events
- **Actions:** Create events, manage attendees, view reports

## Data Model

### Contact Schema
```javascript
{
  "_id": ObjectId,
  "contactId": "uuid-v4", // NOT contactNumber
  
  // Core Identity
  "firstName": "John",
  "lastName": "Smith",
  "preferredName": "Jack",
  "title": "Mr", // Mr, Mrs, Ms, Dr, etc.
  
  // Contact Information
  "email": "john.smith@example.com",
  "phone": "+61 400 123 456", // normalized format
  "alternatePhone": null,
  
  // Address (from booking/billing contacts)
  "address": {
    "line1": "123 Main St",
    "line2": "",
    "city": "Sydney",
    "state": "NSW",
    "postcode": "2000",
    "country": "Australia"
  },
  
  // Masonic Profile (from attendees)
  "masonicProfile": {
    "isMason": true,
    "title": "WBro",
    "rank": "PM",
    "grandRank": "PSGD",
    "grandOffice": null,
    "grandOfficer": false,
    "grandLodgeId": "uuid",
    "grandLodgeName": "UGLNSW&ACT",
    "lodgeId": "uuid",
    "lodgeName": "Lodge Horace Thompson Ryde No. 134",
    "lodgeNumber": "134"
  },
  
  // Relationships (NOT roles array)
  "registrations": {
    // Registration ID -> Role mapping
    "reg-uuid-1": {
      "role": "attendee",
      "functionId": "func-uuid",
      "functionName": "Grand Proclamation 2025",
      "eventId": "event-uuid",
      "eventName": "Installation Ceremony",
      "registeredAt": ISODate,
      "registeredBy": "contact-uuid" // who made the booking
    },
    "reg-uuid-2": {
      "role": "bookingContact",
      "functionId": "func-uuid",
      "functionName": "Ladies Festival 2025",
      "bookingsManaged": 15 // number of attendees
    }
  },
  
  "organizations": {
    // Organization ID -> Role mapping  
    "org-uuid-1": {
      "organizationName": "Lodge HT Ryde No. 134",
      "role": "secretary",
      "startDate": ISODate,
      "endDate": null,
      "current": true
    }
  },
  
  "hosting": {
    // Function ID -> Host role
    "func-uuid-1": {
      "functionName": "Installation 2025",
      "role": "organizer",
      "startDate": ISODate
    }
  },
  
  // Partner Relationships
  "relationships": {
    "partners": [
      {
        "contactId": "contact-uuid",
        "relationshipType": "spouse",
        "name": "Jane Smith"
      }
    ]
  },
  
  // System
  "hasUserAccount": true, // links to users collection
  "createdAt": ISODate,
  "updatedAt": ISODate,
  "source": "attendee" // attendee, registration, manual
}
```

### User Schema
```javascript
{
  "_id": ObjectId,
  "userId": "uuid-v4",
  "contactId": "uuid-v4", // REQUIRED - links to contact
  
  // Authentication
  "email": "john.smith@example.com", // from contact
  "phone": "+61 400 123 456", // from contact
  "password": "hashed", // if using password auth
  
  // OAuth Providers
  "authProviders": {
    "google": { "id": "google-id" },
    "facebook": { "id": "fb-id" }
  },
  
  // Access Control
  "roles": ["user"], // user, admin, host
  "permissions": [],
  
  // Account Status
  "status": "active", // active, suspended, deleted
  "emailVerified": true,
  "phoneVerified": false,
  
  // Security
  "lastLogin": ISODate,
  "loginCount": 45,
  "passwordResetToken": null,
  "passwordResetExpires": null,
  
  // Metadata
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

## Business Rules

### Contact Creation
1. **From Attendees**: Create contact for each attendee with masonic profile
2. **From Booking Contacts**: Always create contact AND user
3. **From Billing Contacts**: Always create contact AND user
4. **From Organizations**: Create contacts for key personnel

### Duplicate Prevention
1. **Match by Email**: If email exists, update existing contact
2. **Match by Phone**: If phone exists, update existing contact
3. **Merge Strategy**: Combine data, never duplicate
4. **Conflict Resolution**: Newer data wins, but append to arrays

### User Creation Rules
1. **Mandatory Users**: Booking and billing contacts MUST have user accounts
2. **Optional Users**: Regular attendees get accounts on request
3. **Authentication**: Email or phone can be used as username
4. **Access Level**: Users can only see their own data by default

### Data Integrity
1. **Contact First**: User cannot exist without contact
2. **ID Format**: All IDs must be UUID v4 (not sequential numbers)
3. **Phone Format**: Normalize to E.164 format
4. **Email Format**: Lowercase and validated

## Migration Requirements

### From Attendees Table
- Map all personal info (name, email, phone)
- Map masonic profile completely
- Map partner relationships
- Link to registration and event context

### From Registrations Table  
- Create contacts for booking contacts with addresses
- Create contacts for billing contacts with addresses
- Always create users for booking/billing contacts
- Map organization relationships

### From Organizations Table
- Create contacts for key personnel
- Map their roles in the organization

### Duplicate Handling
1. Check existing contacts by email
2. Check existing contacts by phone
3. If found, merge data:
   - Add new registrations to registrations{}
   - Add new organizations to organizations{}
   - Update masonic profile if more complete
   - Keep most recent contact info

## Success Metrics
1. **Zero Duplicates**: One person = one contact
2. **Complete Profiles**: All attendee data migrated
3. **Proper Context**: Every interaction tracked with context
4. **User Access**: All booking/billing contacts can log in