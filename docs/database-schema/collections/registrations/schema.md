# Registrations Collection Schema

## Overview
The registrations collection represents purchase transactions where customers register for functions and buy products (tickets, merchandise, etc.). A registration is essentially an order in the e-commerce system.

## Document Structure

```javascript
{
  _id: ObjectId,
  registrationNumber: String,     // Unique identifier (e.g., "GP2025-REG-00123")
  functionId: String,             // Reference to function
  type: String,                   // Registration type
  
  // Registrant (purchaser) information
  registrant: {
    type: String,                 // "organisation" or "user"
    id: ObjectId,                 // Reference to organisations or users collection
    name: String,                 // Denormalized for display
    contact: {
      name: String,               // Contact person name
      email: String,              // Contact email
      phone: String               // Contact phone
    },
    // Organisation-specific fields
    abn: String,                  // For organisations
    lodgeNumber: String           // For lodge registrations
  },
  
  // Purchase details (order items)
  purchase: {
    items: [{
      lineItemId: ObjectId,       // Unique line item ID
      productId: ObjectId,        // Reference to product in functions
      productType: String,        // "ticket", "merchandise", "accommodation"
      eventId: String,            // For ticket products
      eventName: String,          // Denormalized for display
      name: String,               // Product name
      description: String,        // Product description
      quantity: Number,           // Quantity purchased
      unitPrice: Decimal128,      // Price per unit
      discount: {
        amount: Decimal128,       // Discount amount
        percentage: Number,       // Discount percentage
        code: String              // Discount code used
      },
      tax: {
        rate: Number,             // Tax rate (e.g., 0.10 for 10%)
        amount: Decimal128        // Tax amount
      },
      total: Decimal128,          // Line total (quantity * unitPrice - discount + tax)
      
      // For ticket products
      ticketIds: [ObjectId],      // References to created tickets
      
      // For physical products
      fulfillment: {
        method: String,           // "digital", "shipping", "pickup"
        status: String,           // "pending", "processing", "shipped", "delivered"
        trackingNumber: String,   // For shipped items
        shippingAddress: {
          name: String,
          addressLine1: String,
          addressLine2: String,
          city: String,
          state: String,
          postcode: String,
          country: String
        }
      }
    }],
    
    // Purchase totals
    subtotal: Decimal128,         // Sum of line items before tax
    discountTotal: Decimal128,    // Total discounts applied
    taxTotal: Decimal128,         // Total tax
    shippingTotal: Decimal128,    // Shipping costs
    fees: Decimal128,             // Processing fees
    total: Decimal128             // Final amount charged
  },
  
  // Payment information
  payment: {
    method: String,               // "credit_card", "bank_transfer", "invoice"
    gateway: String,              // "stripe", "square", "manual"
    transactionId: String,        // Gateway transaction ID
    status: String,               // "pending", "processing", "paid", "failed", "refunded"
    paidAt: Date,                 // When payment was received
    
    // For invoice payments
    invoiceTerms: {
      dueDate: Date,              // Payment due date
      terms: String               // "net30", "net60", etc.
    }
  },
  
  // Attendee management
  attendeeIds: [ObjectId],        // References to attendees collection
  attendeeAllocation: {
    total: Number,                // Total attendees expected
    assigned: Number,             // Attendees already assigned
    unassigned: Number            // Remaining to be assigned
  },
  
  // Registration status
  status: String,                 // "pending", "partial", "complete", "cancelled"
  
  // Cancellation details (if applicable)
  cancellation: {
    cancelledAt: Date,
    cancelledBy: ObjectId,        // User who cancelled
    reason: String,
    refundAmount: Decimal128,
    refundTransactionId: ObjectId // Reference to refund transaction
  },
  
  // References
  financialTransactionId: ObjectId, // Link to financial transaction
  invoiceId: ObjectId,             // Link to generated invoice
  
  // Communication
  communications: {
    confirmationSent: Boolean,
    confirmationSentAt: Date,
    remindersSent: Number,
    lastReminderAt: Date
  },
  
  // Custom fields for special requirements
  customFields: {
    specialRequests: String,
    internalNotes: String,
    referralSource: String,
    marketingConsent: Boolean
  },
  
  // Metadata
  metadata: {
    source: String,               // "web", "admin", "import", "api"
    ipAddress: String,            // For web orders
    userAgent: String,            // Browser info
    sessionId: String,            // Shopping session
    affiliateCode: String,        // For tracking
    createdAt: Date,
    updatedAt: Date,
    version: Number               // For optimistic locking
  }
}
```

## Field Constraints

### Required Fields
- `registrationNumber` - Must be unique, follows pattern
- `functionId` - Must reference existing function
- `type` - Must be valid registration type
- `registrant` - Complete registrant information required
- `purchase.items` - At least one item required
- `purchase.total` - Must equal calculated total
- `status` - Must be valid status

### Enumerations

**Registration Types:**
- `individual` - Single person registration
- `lodge` - Lodge group registration
- `delegation` - Delegation group registration

**Registration Status:**
- `pending` - Awaiting payment or completion
- `partial` - Partially complete (e.g., lodge awaiting attendee details)
- `complete` - Fully complete with all attendees assigned
- `cancelled` - Registration cancelled

**Product Types:**
- `ticket` - Event tickets
- `merchandise` - Physical goods
- `accommodation` - Hotel/accommodation packages
- `donation` - Charitable donations
- `sponsorship` - Sponsorship packages

**Payment Status:**
- `pending` - Awaiting payment
- `processing` - Payment being processed
- `paid` - Payment successful
- `failed` - Payment failed
- `refunded` - Payment refunded

## Indexes
- `registrationNumber` - Unique index
- `functionId` - For function queries
- `registrant.id` - For customer history
- `status, functionId` - For status filtering
- `payment.transactionId` - For payment lookup
- `metadata.createdAt` - For date range queries

## Relationships
- **Functions** - References via `functionId`
- **Attendees** - References via `attendeeIds` array
- **Tickets** - Created tickets referenced in `purchase.items.ticketIds`
- **Financial Transactions** - References via `financialTransactionId`
- **Users/Organisations** - References via `registrant.id`

## Patterns Used

### Embedded Pattern
Purchase items are embedded because:
- They are always accessed with the registration
- They represent a point-in-time snapshot of what was purchased
- They don't change after creation

### Referenced Pattern
Attendees and tickets are referenced because:
- They have independent lifecycles
- They can be transferred or modified
- They need to be queried independently

### Bucket Pattern
The `communications` object uses a simple bucket pattern to track all communication events without unbounded growth.

## Transaction Requirements
Registration creation requires MongoDB transactions to:
- Atomically update product inventory
- Create tickets with guaranteed uniqueness
- Create financial transaction records
- Ensure payment processing is atomic