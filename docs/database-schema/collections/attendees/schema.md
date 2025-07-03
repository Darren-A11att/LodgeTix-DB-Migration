# Attendees Collection Schema

## Overview
The attendees collection represents individual people who will attend events within functions. Each attendee has a unique QR code that provides access to all their tickets across multiple events, enabling efficient check-in and access control. Attendees maintain event-specific information (dietary requirements, special needs, partner relationships) while also referencing the contacts collection for master identity data. The contact reference may be populated post-registration through server-side reconciliation.

## Document Structure

```javascript
{
  _id: ObjectId,
  attendeeNumber: String,         // Unique identifier (e.g., "ATT-2025-00123")
  attendeeId: String,             // Legacy UUID from app (e.g., "01979bd3-dda0-718d-a100-a98759a1a67c")
  registrationId: ObjectId,       // Reference to registration
  functionId: String,             // Reference to function
  
  // Contact Reference (may be populated post-registration)
  contactId: ObjectId,            // Reference to contacts collection (nullable initially)
  contactMatched: Boolean,        // Whether contact has been matched/created
  contactMatchedAt: Date,         // When the contact was matched
  
  // Attendee Type and Status
  attendeeType: String,           // "mason", "guest", "partner", etc.
  isPrimary: Boolean,             // Primary attendee for the registration
  paymentStatus: String,          // "pending", "paid", "refunded"
  
  // Basic Information (kept for event-specific data)
  profile: {
    title: String,                // "Mr", "Mrs", "Bro", "WBro", "VWBro", etc.
    firstName: String,
    lastName: String,
    suffix: String,               // Post-nominals (e.g., "PDGDC")
    
    // Contact info at time of registration
    primaryEmail: String,         // May be empty for non-primary attendees
    primaryPhone: String,         // May be empty for non-primary attendees
    contactPreference: String,    // "directly", "primaryattendee"
    contactConfirmed: Boolean
  },
  
  // Partner/Relationship Information
  partnerInfo: {
    partner: String,              // AttendeeId of partner (if applicable)
    isPartner: String,            // AttendeeId they are partner of
    partnerOf: String,            // AttendeeId they are partner of (duplicate?)
    relationship: String,         // "Wife", "Husband", "Partner", etc.
  },
  
  // Masonic Information (for mason attendees)
  masonicInfo: {
    rank: String,                 // "EA", "FC", "MM", "GL", etc.
    title: String,                // Masonic title
    grandOfficerStatus: String,   // "Present", "Past", null
    postNominals: String,         // Additional masonic honours
    
    // Lodge information
    lodge: String,                // Lodge name (may be empty)
    lodgeId: String,              // Lodge organisation ID
    lodgeNameNumber: String,      // Full lodge name with number
    lodgeOrganisationId: String,  // Organisation reference
    
    // Grand Lodge information
    grandLodge: String,           // Grand Lodge name
    grandLodgeId: String,         // Grand Lodge ID
    grandLodgeOrganisationId: String,
    
    firstTime: Boolean,           // First time attending
    useSameLodge: Boolean         // Use same lodge as primary attendee
  },
  
  // Event-Specific Requirements
  requirements: {
    dietaryRequirements: String,  // Free text dietary needs for this event
    specialNeeds: String,         // Free text special needs for this event
    accessibility: [String],      // Specific accessibility requirements
    
    // Seating preferences
    seating: {
      tableAssignment: String,    // Assigned table
      preference: String,         // Seating preference
      companionIds: [String],     // Other attendee IDs to sit with
    }
  },
  
  // QR Code for all access
  qrCode: {
    code: String,                 // Unique QR code value
    format: String,               // "uuid", "custom"
    generatedAt: Date,
    lastScanned: Date,
    scanCount: Number,
    
    // Security features
    security: {
      pin: String,                // Optional PIN (hashed)
      validFrom: Date,
      validUntil: Date,
      revoked: Boolean,
      revokedReason: String
    }
  },
  
  // Tickets assigned to this attendee
  tickets: [{
    ticketId: ObjectId,           // Reference to tickets collection
    eventId: String,
    eventName: String,            // Denormalized for display
    productName: String,          // Ticket type
    
    // Access control
    access: {
      zones: [String],            // Areas this ticket grants access to
      validFrom: Date,
      validUntil: Date,
      singleUse: Boolean,
      used: Boolean,
      usedAt: Date
    }
  }],
  
  // Check-in Status
  isCheckedIn: Boolean,           // Current check-in status
  
  // Check-in history
  checkIns: [{
    eventId: String,
    locationId: String,
    checkInTime: Date,
    checkOutTime: Date,
    device: String,               // Scanner device ID
    staff: ObjectId,              // Staff who checked in
    method: String,               // "qr_scan", "manual", "facial"
    notes: String
  }],
  
  // Notes
  notes: String,                  // General notes about attendee
  
  // Accommodation (if applicable)
  accommodation: {
    roomId: String,
    roomType: String,
    checkIn: Date,
    checkOut: Date,
    companions: [ObjectId],       // Other attendees in same room
    preferences: {
      floor: String,              // "ground", "upper"
      bedType: String,            // "twin", "double"
      notes: String
    }
  },
  
  // Communication preferences
  communications: {
    preferences: {
      email: Boolean,
      sms: Boolean,
      pushNotifications: Boolean
    },
    language: String,             // Preferred language code
    timezone: String,             // For scheduling
    
    // Sent communications
    sent: [{
      type: String,               // "confirmation", "reminder", "update"
      channel: String,            // "email", "sms"
      sentAt: Date,
      subject: String,
      status: String              // "sent", "delivered", "bounced"
    }]
  },
  
  // Engagement tracking
  engagement: {
    eventsAttended: Number,
    lastEventDate: Date,
    totalSpent: Decimal128,
    
    // Session participation
    sessions: [{
      eventId: String,
      sessionId: String,
      attended: Boolean,
      feedback: {
        rating: Number,
        comments: String
      }
    }],
    
    // Activities
    activities: [{
      type: String,               // "networking", "social", "tour"
      activityId: String,
      participatedAt: Date,
      result: String              // For competitions
    }]
  },
  
  // Badge/credential information
  badge: {
    printed: Boolean,
    printedAt: Date,
    collectedAt: Date,
    badgeType: String,            // "standard", "vip", "speaker"
    customFields: {
      title: String,
      organisation: String,
      ribbons: [String]           // Special designations
    }
  },
  
  // Status and metadata
  status: String,                 // "active", "checked_in", "no_show", "cancelled"
  source: String,                 // How attendee was added: "registration", "import", "manual"
  
  // Custom fields for function-specific data
  customFields: Map,              // Flexible key-value pairs
  
  // Guest Information (if applicable)
  guestInfo: {
    guestOfId: String,            // AttendeeId of who they are guest of
  },
  
  // Audit trail
  metadata: {
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    importId: String,             // For bulk imports
    version: Number
  }
}
```

## Field Constraints

### Required Fields
- `attendeeNumber` - Must be unique across system
- `attendeeId` - Legacy UUID from application
- `registrationId` - Must reference valid registration
- `functionId` - Must reference valid function
- `attendeeType` - Type of attendee
- `profile.firstName` - Minimum identification
- `profile.lastName` - Minimum identification
- `qrCode.code` - Must be unique

### Enumerations

**Status:**
- `active` - Normal attendee status
- `checked_in` - Currently at event
- `no_show` - Didn't attend
- `cancelled` - Registration cancelled

**Attendee Types:**
- `mason` - Masonic member
- `guest` - General guest
- `partner` - Partner/spouse of attendee
- `vip` - VIP guest
- `speaker` - Event speaker
- `staff` - Event staff

**Payment Status:**
- `pending` - Awaiting payment
- `paid` - Payment completed
- `refunded` - Payment refunded
- `comped` - Complimentary

**Contact Preference:**
- `directly` - Contact attendee directly
- `primaryattendee` - Contact via primary attendee

**Check-in Methods:**
- `qr_scan` - QR code scanned
- `manual` - Manual check-in by staff
- `facial` - Facial recognition
- `rfid` - RFID tag scan

**Communication Types:**
- `confirmation` - Initial confirmation
- `reminder` - Event reminders
- `update` - Changes or updates
- `alert` - Urgent notifications

## Indexes
- `attendeeNumber` - Unique index
- `attendeeId` - Legacy UUID index
- `contactId` - Contact reference (sparse)
- `qrCode.code` - Unique index for fast QR lookups
- `registrationId` - For registration queries
- `functionId, status` - For function attendee lists
- `profile.primaryEmail` - For attendee lookup (sparse)
- `profile.lastName, profile.firstName` - For name searches
- `partnerInfo.partner` - For partner relationships
- `partnerInfo.isPartner` - For reverse partner lookup

## Relationships
- **Contacts** - Contact record via `contactId` (may be null initially)
- **Registrations** - Parent registration via `registrationId`
- **Functions** - Function via `functionId`
- **Tickets** - Owned tickets via `tickets.ticketId`
- **Users** - Check-in staff via `checkIns.staff`
- **Other Attendees** - Partners via `partnerInfo.partner`

## Security Considerations

### PII Protection
- `profile.identification.number` - Must be encrypted at rest
- `qrCode.security.pin` - Must be hashed (never store plaintext)
- `profile.contact` - Consider encryption for GDPR compliance
- `requirements.medical` - Sensitive data requiring encryption

### QR Code Security
- Generate cryptographically secure random codes
- Implement rate limiting on QR scans
- Log all scan attempts for security audit
- Support revocation for lost/stolen badges

## Business Logic

### QR Code Generation
```javascript
// QR code contains
{
  attendeeId: "encrypted_attendee_id",
  functionId: "function_id", 
  validFrom: "timestamp",
  validUntil: "timestamp",
  signature: "hmac_signature"
}
```

### Check-in Rules
1. Verify QR code validity and signature
2. Check date/time constraints
3. Verify ticket access for location
4. Record check-in with timestamp
5. Update ticket usage if single-use

### Transfer Restrictions
- Attendee profiles cannot be transferred after check-in
- QR codes can be revoked and reissued
- Ticket transfers update attendee assignment

## Performance Optimizations

### Denormalization
- Event names in tickets array for display
- Basic registration info to avoid lookups
- Ticket count for quick statistics

### Archival Strategy
- Archive check-in history after event completion
- Move completed events to cold storage
- Maintain summary statistics for reporting