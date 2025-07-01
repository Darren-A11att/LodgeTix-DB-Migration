# Attendees Collection Schema

## Overview
The attendees collection represents individual people who will attend events within functions. Each attendee has a unique QR code that provides access to all their tickets across multiple events, enabling efficient check-in and access control.

## Document Structure

```javascript
{
  _id: ObjectId,
  attendeeNumber: String,         // Unique identifier (e.g., "ATT-2025-00123")
  registrationId: ObjectId,       // Reference to registration
  functionId: String,             // Reference to function
  
  // Personal Information
  profile: {
    firstName: String,
    lastName: String,
    preferredName: String,        // Display name
    dateOfBirth: Date,            // For age verification
    gender: String,               // For statistics/accommodation
    
    // Contact (may differ from registrant)
    contact: {
      email: String,
      phone: String,
      emergencyContact: {
        name: String,
        phone: String,
        relationship: String
      }
    },
    
    // Identification
    identification: {
      type: String,               // "drivers_license", "passport", "member_card"
      number: String,             // Encrypted
      verifiedAt: Date,
      verifiedBy: ObjectId
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
  
  // Special requirements
  requirements: {
    dietary: [String],            // "vegetarian", "vegan", "gluten_free", etc.
    accessibility: [String],      // "wheelchair", "hearing_loop", etc.
    medical: {
      conditions: [String],       // Relevant conditions
      medications: [String],      // Current medications
      allergies: [String]         // Known allergies
    },
    seating: {
      preference: String,         // "aisle", "front", "back"
      companionIds: [ObjectId],   // Other attendees to sit with
      avoidIds: [ObjectId]        // Attendees to avoid
    }
  },
  
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
- `registrationId` - Must reference valid registration
- `functionId` - Must reference valid function
- `profile.firstName` - Minimum identification
- `profile.lastName` - Minimum identification
- `qrCode.code` - Must be unique

### Enumerations

**Status:**
- `active` - Normal attendee status
- `checked_in` - Currently at event
- `no_show` - Didn't attend
- `cancelled` - Registration cancelled

**Gender:**
- `male`
- `female`
- `other`
- `prefer_not_to_say`

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
- `qrCode.code` - Unique index for fast QR lookups
- `registrationId` - For registration queries
- `functionId, status` - For function attendee lists
- `profile.contact.email` - For attendee lookup
- `profile.lastName, profile.firstName` - For name searches

## Relationships
- **Registrations** - Parent registration via `registrationId`
- **Functions** - Function via `functionId`
- **Tickets** - Owned tickets via `tickets.ticketId`
- **Users** - Check-in staff via `checkIns.staff`

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