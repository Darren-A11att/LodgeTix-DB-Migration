# Tickets Collection Schema

## Overview
The tickets collection represents individual ticket instances that are created when products (specifically ticket-type products) are purchased. Each ticket has a unique identifier, ownership tracking, transfer history, and access control features.

## Document Structure

```javascript
{
  _id: ObjectId,
  ticketNumber: String,           // Unique identifier (e.g., "TKT-GP2025-BAN-00123")
  
  // Product and Event Information
  product: {
    functionId: String,           // Reference to function
    eventId: String,              // Reference to event within function
    eventName: String,            // Denormalized for display
    productId: ObjectId,          // Reference to product in function
    productName: String,          // Ticket type name
    productCategory: String,      // "general", "vip", "student", etc.
    
    // Ticket details from product
    description: String,
    price: Decimal128,            // Original price paid
    features: [String],           // What's included with this ticket
    restrictions: [String]        // Age limits, member-only, etc.
  },
  
  // Purchase Information
  purchase: {
    registrationId: ObjectId,     // Reference to registration
    registrationNumber: String,   // Denormalized for quick lookup
    purchasedBy: {
      type: String,               // "organisation", "contact", or "user"
      id: ObjectId,               // Reference to purchaser (organisationId, contactId, or userId)
      name: String                // Denormalized name
    },
    purchaseDate: Date,
    paymentStatus: String,        // "paid", "pending", "refunded"
    
    // Line item reference
    lineItemId: ObjectId,         // Reference to purchase.items in registration
    
    // Financial tracking
    pricePaid: Decimal128,        // Actual amount after discounts
    discount: {
      amount: Decimal128,
      code: String,
      percentage: Number
    },
    refund: {
      amount: Decimal128,
      date: Date,
      reason: String,
      transactionId: String
    }
  },
  
  // Ownership
  owner: {
    attendeeId: ObjectId          // Reference to attendees collection (null = owned by registration)
  },
  
  // Transfer History
  transferHistory: [{
    transferId: ObjectId,         // Unique transfer ID
    type: String,                 // "assignment", "transfer", "return"
    from: {
      type: String,               // "registration", "attendee"
      attendeeId: ObjectId,       // If from attendee
      name: String                // Display name
    },
    to: {
      type: String,               // "attendee", "registration"
      attendeeId: ObjectId,       // If to attendee
      name: String                // Display name
    },
    transferDate: Date,
    transferredBy: ObjectId,      // User who processed transfer
    reason: String,               // "initial_assignment", "reassignment", "sold", "gifted", "returned"
    notes: String,                // Additional context
    
    // For secondary market transfers
    salePrice: Decimal128,        // If sold
    platform: String,             // "internal", "external"
    verificationCode: String      // For secure transfers
  }],
  
  // Access Control
  access: {
    zones: [String],              // Areas this ticket grants access to
    gates: [String],              // Specific entry gates allowed
    validFrom: Date,
    validUntil: Date,
    
    // Usage tracking
    singleUse: Boolean,           // One-time entry only
    multiEntry: Boolean,          // Multiple entries allowed
    maxEntries: Number,           // Maximum entry count
    entryCount: Number,           // Current entry count
    
    // Status
    status: String,               // "valid", "used", "expired", "revoked"
    revokedReason: String,
    revokedAt: Date,
    revokedBy: ObjectId
  },
  
  // Usage History
  usageHistory: [{
    usedAt: Date,
    location: {
      gate: String,               // Entry gate identifier
      scanner: String,            // Device ID
      coordinates: {              // GPS if available
        latitude: Number,
        longitude: Number
      }
    },
    method: String,               // "qr_scan", "manual", "rfid"
    staff: ObjectId,              // Staff who scanned
    notes: String,
    
    // Exit tracking (if applicable)
    exitAt: Date,
    exitLocation: {
      gate: String,
      scanner: String
    }
  }],
  
  // Physical/Digital Delivery
  delivery: {
    method: String,               // "digital", "physical", "will_call"
    status: String,               // "pending", "sent", "delivered", "collected"
    
    // Digital delivery
    digital: {
      sentAt: Date,
      email: String,
      downloadCount: Number,
      lastDownloadAt: Date
    },
    
    // Physical delivery
    physical: {
      shippedAt: Date,
      carrier: String,
      trackingNumber: String,
      deliveredAt: Date,
      signature: String
    },
    
    // Will call
    willCall: {
      booth: String,
      collectedAt: Date,
      collectedBy: {
        name: String,
        idVerified: Boolean,
        idType: String,
        notes: String
      }
    }
  },
  
  // Seat Assignment (if applicable)
  seat: {
    section: String,
    row: String,
    number: String,
    accessibility: Boolean,
    
    // Dynamic seating
    assigned: Boolean,
    assignedAt: Date,
    preferences: {
      zone: String,               // "front", "back", "aisle"
      companions: [String]        // Other ticket numbers to sit with
    }
  },
  
  // Special Features
  addOns: [{
    type: String,                 // "parking", "merchandise", "hospitality"
    description: String,
    value: Decimal128,
    status: String,               // "active", "redeemed", "expired"
    redeemedAt: Date
  }],
  
  // Compliance and Security
  security: {
    barcode: String,              // Unique barcode
    qrData: String,               // Encrypted QR data
    securityCode: String,         // Visual security code
    
    // Anti-fraud measures
    ipAddress: String,            // Purchase IP
    deviceFingerprint: String,    // Purchase device
    riskScore: Number,            // Fraud risk assessment
    
    // Verification
    verified: Boolean,
    verifiedAt: Date,
    verificationMethod: String
  },
  
  // Status and Metadata
  status: String,                 // "active", "transferred", "cancelled", "expired"
  
  // Custom fields for event-specific data
  customFields: Map,
  
  // System metadata
  metadata: {
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    version: Number,              // For optimistic locking
    
    // Data quality
    source: String,               // "purchase", "import", "conversion"
    importBatch: String,          // For bulk imports
    migrationId: String           // From old system
  }
}
```

## Field Constraints

### Required Fields
- `ticketNumber` - Must be unique, follows pattern
- `product` - Complete product information required
- `purchase.registrationId` - Must reference valid registration
- `purchase.purchaseDate` - When ticket was created
- `access.status` - Current ticket status
- `owner` - Object required (attendeeId can be null for registration-owned tickets)

### Enumerations

**Access Status:**
- `valid` - Active and usable
- `used` - Single-use ticket already used
- `expired` - Past validity date
- `revoked` - Manually revoked

**Ticket Status:**
- `active` - Current valid ticket
- `transferred` - Ownership transferred
- `cancelled` - Ticket cancelled
- `expired` - No longer valid

**Transfer Reasons:**
- `sold` - Secondary market sale
- `gifted` - Given to another person
- `reassigned` - Administrative reassignment
- `returned` - Returned to organizer

**Delivery Methods:**
- `digital` - Email/app delivery
- `physical` - Mailed ticket
- `will_call` - Pickup at venue

## Indexes
- `ticketNumber` - Unique index
- `product.functionId, product.eventId` - Event queries
- `purchase.registrationId` - Registration lookups
- `owner.attendeeId` - Owner queries (including null for unassigned)
- `purchase.registrationId, owner.attendeeId` - Unassigned tickets by registration
- `security.barcode` - Barcode scanning
- `security.qrData` - QR code scanning
- `access.status, product.eventId` - Active tickets by event

## Relationships
- **Functions** - Via `product.functionId`
- **Registrations** - Purchase via `purchase.registrationId` (owns ticket if `owner.attendeeId` is null)
- **Attendees** - Current owner via `owner.attendeeId` (when assigned)
- **Users** - Various staff/admin references

## Security Considerations

### Data Protection
- `security.securityCode` - Should be hashed
- `transferHistory.verificationCode` - One-time use codes
- `delivery.digital.email` - PII requiring protection
- `usageHistory.location.coordinates` - Location privacy

### Anti-Fraud Measures
- Unique barcode/QR generation with signatures
- Device fingerprinting on purchase
- Transfer verification codes
- Risk scoring for suspicious activity

## Business Logic

### Transfer Rules
1. Only active tickets can be transferred
2. Transfers create audit trail
3. Verification required for high-value tickets
4. Some tickets may be non-transferable
5. Transfer limits may apply

### Usage Rules
1. Single-use tickets invalidated after first scan
2. Multi-entry tickets track entry count
3. Time-based validity enforced
4. Zone access validated at entry

### Refund Rules
1. Refunds update ticket status
2. Partial refunds for multi-day tickets
3. Refund deadlines enforced
4. Refunded tickets become invalid

## Performance Optimizations

### Denormalization
- Event and product names for display
- Owner information for quick access
- Registration number for support queries

### Archival Strategy
- Move expired tickets to archive collection
- Compress usage history after event
- Maintain summary statistics