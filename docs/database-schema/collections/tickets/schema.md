# Tickets Collection Schema

## Overview
The tickets collection represents fulfillment records created when event products are purchased through orders. Each ticket is the physical or digital manifestation of a purchased line item from an order. Tickets have unique identifiers, ownership tracking, transfer history, and access control features.

## Document Structure

```javascript
{
  _id: ObjectId,
  ticketNumber: String,           // Unique identifier (e.g., "TKT-GP2025-BAN-00123")
  
  // Catalog and Product Information
  catalog: {
    catalogObjectId: ObjectId,    // Reference to catalog object
    catalogName: String,          // Denormalized for display
    productId: String,            // Product UUID from catalog
    productName: String,          // Event name
    variationId: String,          // Variation UUID (ticket type)
    variationName: String,        // Ticket type name
    
    // Event details from product
    eventStart: Date,
    eventEnd: Date,
    location: {
      name: String,
      address: Object
    },
    
    // Ticket details from variation
    description: String,
    price: Decimal128,            // Original price from catalog
    features: [String],           // What's included with this ticket
    restrictions: [String]        // Age limits, member-only, etc.
  },
  
  // Order Information
  order: {
    orderId: ObjectId,            // Reference to orders collection
    orderNumber: String,          // Denormalized for quick lookup
    lineItemId: ObjectId,         // Specific line item this fulfills
    purchasedBy: {
      type: String,               // "organisation", "contact"
      contactId: ObjectId,        // Customer contact
      organisationId: ObjectId,   // If purchased by org
      name: String                // Denormalized name
    },
    purchaseDate: Date,
    
    // Financial tracking
    pricePaid: Decimal128,        // Actual amount from line item
    currency: String,             // "AUD", "NZD", "USD"
    
    // Fulfillment tracking
    fulfilledAt: Date,            // When ticket was created
    fulfillmentStatus: String     // "fulfilled", "pending", "cancelled"
  },
  
  // Ownership
  owner: {
    type: String,                 // "contact", "organisation", "unassigned"
    contactId: ObjectId,          // If owned by contact
    organisationId: ObjectId,     // If owned by organisation
    name: String                  // Denormalized for display
  },
  
  // Transfer History
  transferHistory: [{
    transferId: ObjectId,         // Unique transfer ID
    type: String,                 // "assignment", "transfer", "return"
    from: {
      type: String,               // "contact", "organisation", "unassigned"
      contactId: ObjectId,        // If from contact
      organisationId: ObjectId,   // If from organisation
      name: String                // Display name
    },
    to: {
      type: String,               // "contact", "organisation", "unassigned"
      contactId: ObjectId,        // If to contact
      organisationId: ObjectId,   // If to organisation
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
- `catalog` - Complete catalog/product information required
- `order.orderId` - Must reference valid order
- `order.lineItemId` - Must reference specific line item
- `order.purchaseDate` - When order was placed
- `access.status` - Current ticket status
- `owner.type` - Ownership type required

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
- `catalog.catalogObjectId` - Catalog queries
- `catalog.productId, catalog.variationId` - Product/variation lookups
- `order.orderId` - Order lookups
- `order.lineItemId` - Line item fulfillment
- `owner.contactId` - Contact's tickets
- `owner.organisationId` - Organisation's tickets
- `owner.type, order.orderId` - Unassigned tickets by order
- `security.barcode` - Barcode scanning
- `security.qrData` - QR code scanning
- `access.status, catalog.eventStart` - Active tickets by date

## Relationships
- **Catalog Objects** - Via `catalog.catalogObjectId`
- **Orders** - Purchase via `order.orderId` and `order.lineItemId`
- **Contacts** - Current owner via `owner.contactId` (when assigned)
- **Organisations** - Organisation owner via `owner.organisationId`
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

### Ticket Creation
1. Created automatically when order line item is fulfilled
2. One ticket per quantity in line item
3. Initial owner matches line item owner
4. Linked to specific catalog product/variation
5. Inventory updated in catalog on creation

### Transfer Rules
1. Only active tickets can be transferred
2. Transfers create audit trail
3. Verification required for high-value tickets
4. Some tickets may be non-transferable
5. Transfer limits may apply
6. Organisation-owned tickets can be assigned to members

### Usage Rules
1. Single-use tickets invalidated after first scan
2. Multi-entry tickets track entry count
3. Time-based validity enforced
4. Zone access validated at entry

### Cancellation Rules
1. Cancelling order cancels associated tickets
2. Cancelled tickets update catalog inventory
3. Partial cancellations supported
4. Cancelled tickets become invalid immediately

## Performance Optimizations

### Denormalization
- Event and product names for display
- Owner information for quick access
- Registration number for support queries

### Archival Strategy
- Move expired tickets to archive collection
- Compress usage history after event
- Maintain summary statistics