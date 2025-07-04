# Orders Collection Schema

## Overview
The orders collection represents purchase transactions in the e-commerce model. It replaces the previous registrations collection and supports various order types including event registrations, merchandise purchases, and sponsorships.

## Document Structure

```javascript
{
  _id: ObjectId,
  orderNumber: String,            // "ORD-2025-000001"
  orderType: String,              // "registration", "purchase", "sponsorship"
  catalogObjectId: ObjectId,      // Reference to catalog object
  status: String,                 // "pending", "processing", "paid", "partially_paid", "cancelled", "refunded"
  
  // Customer information
  customer: {
    type: String,                 // "individual", "lodge", "delegation", "organisation"
    contactId: ObjectId,          // Reference if contact exists
    organisationId: ObjectId,     // For lodge/delegation orders
    // Raw data if contact doesn't exist yet
    rawData: {
      name: String,
      email: String,
      phone: String
    }
  },
  
  // Order line items
  lineItems: [{
    _id: ObjectId,                // Line item ID
    productId: String,            // Product UUID from catalog
    productName: String,          // Denormalized
    variationId: String,          // Variation UUID
    variationName: String,        // Denormalized
    quantity: Number,
    unitPrice: Decimal128,
    totalPrice: Decimal128,
    
    // Owner of this line item
    owner: {
      type: String,               // "contact", "organisation", "unassigned"
      contactId: ObjectId,        // If assigned to contact
      organisationId: ObjectId,   // If owned by org
      // Raw attendee data before contact creation
      rawAttendee: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        dietaryRequirements: String,
        specialNeeds: String
      }
    },
    
    // Fulfillment tracking
    fulfillment: {
      status: String,             // "pending", "fulfilled", "partial", "cancelled"
      ticketId: ObjectId,         // Reference to created ticket
      fulfilledAt: Date
    }
  }],
  
  // Financial totals
  totals: {
    subtotal: Decimal128,
    discount: Decimal128,
    tax: Decimal128,
    fees: Decimal128,
    total: Decimal128,
    paid: Decimal128,
    balance: Decimal128,
    currency: String              // "AUD", "NZD", "USD"
  },
  
  // Payment information
  payment: {
    status: String,               // "pending", "processing", "paid", "failed", "refunded"
    transactions: [ObjectId]      // References to financialTransactions
  },
  
  // Billing information
  billing: {
    contact: {
      name: String,
      email: String,
      phone: String
    },
    address: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postcode: String,
      country: String
    },
    abn: String,                  // For business customers
    organisationName: String
  },
  
  notes: String,                  // Internal notes
  
  // Metadata
  metadata: {
    source: {
      channel: String,            // "online", "phone", "email", "manual"
      device: String,
      ipAddress: String
    },
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId
  }
}
```

## Field Descriptions

### Order Identification
- **orderNumber**: Sequential number in format ORD-YYYY-NNNNNN
- **orderType**: Categorizes the order purpose
- **catalogObjectId**: Links to the function/catalog being ordered from

### Customer Object
Identifies who is making the purchase:
- **type**: Individual person or organization
- **contactId/organisationId**: References if customer exists
- **rawData**: Captures info if customer doesn't exist yet

### Line Items Array
Each item being purchased:
- **Product/Variation IDs**: Links to catalog object
- **Quantity & Pricing**: What's being bought
- **Owner**: Who will own/use this item
- **Fulfillment**: Tracking delivery status

### Owner Types
- **contact**: Assigned to specific person
- **organisation**: Owned by lodge/org for later assignment
- **unassigned**: Not yet assigned (for bulk purchases)

### Raw Attendee Data
For registrations where attendees don't have contact records yet:
- Captures essential info during registration
- Converted to contact references when claimed
- Preserves original registration data

## Business Rules

### Order Number Generation
- Format: ORD-YYYY-NNNNNN
- Sequential within year
- Must be unique

### Status Transitions
- `pending` → `processing` → `paid`
- `pending` → `cancelled`
- `paid` → `refunded`
- Cannot skip states

### Line Item Ownership
1. **Individual Orders**: Items assigned to contacts immediately
2. **Lodge/Delegation Orders**: 
   - Items initially owned by organization
   - Can be assigned to members later
   - Unassigned items tracked

### Fulfillment Process
1. Order placed (status: pending)
2. Payment processed (status: paid)
3. For each line item:
   - Create fulfillment records (tickets)
   - Update fulfillment status
   - Update inventory in catalog

### Contact Creation
- Raw attendee data stored during registration
- When user claims registration:
  - Create/match contact record
  - Update owner.contactId
  - Preserve raw data for audit

## Indexes
- `orderNumber` - Unique index
- `catalogObjectId, status` - Catalog orders
- `customer.contactId` - Customer orders
- `customer.organisationId` - Organization orders  
- `metadata.createdAt` - Date ordering
- `lineItems.owner.contactId` - Find items by owner

## Relationships
- **Catalog Objects** - What's being ordered from
- **Contacts** - Customers and attendees
- **Organisations** - Lodge/delegation customers
- **Tickets** - Fulfillment records created
- **Financial Transactions** - Payment records

## Migration from Registrations

### Field Mapping
- Registration number → Order number
- Registration type → Customer type
- Attendees → Line items with raw data
- Registration status → Order status
- Payment info → Payment object

### Key Changes
- More flexible line item structure
- Support for non-event products
- Better ownership tracking
- Fulfillment status per item
- Raw data preservation

## Computed Fields

### Order Summary
```javascript
// Total item count
itemCount: { $size: "$lineItems" }

// Total quantity
totalQuantity: { $sum: "$lineItems.quantity" }

// Fulfillment status
fulfillmentStatus: {
  $cond: [
    { $allElementsTrue: {
      $map: {
        input: "$lineItems",
        in: { $eq: ["$$this.fulfillment.status", "fulfilled"] }
      }
    }},
    "fulfilled",
    { $cond: [
      { $anyElementTrue: {
        $map: {
          input: "$lineItems",
          in: { $eq: ["$$this.fulfillment.status", "fulfilled"] }
        }
      }},
      "partial",
      "pending"
    ]}
  ]
}
```

### Customer Type
```javascript
// Determine if business customer
isBusinessCustomer: {
  $or: [
    { $ne: ["$billing.abn", null] },
    { $in: ["$customer.type", ["lodge", "delegation", "organisation"]] }
  ]
}
```