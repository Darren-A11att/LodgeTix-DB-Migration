# Orders Collection Schema

## Overview
The orders collection represents purchase transactions in the e-commerce model. Registrations from the dirty database become orders, containing attendees, payment information, and ticket purchases.

## Document Structure

```javascript
{
  "_id": ObjectId("..."),
  "orderId": "550e8400-e29b-41d4-a716-446655440000", // UUID v4
  "orderNumber": "IND-134890AT",                      // From registration confirmationNumber
  "orderType": "registration",                        // registration, purchase, sponsorship
  "catalogObjectId": "uuid",                          // Function catalog object
  "status": "paid",                                   // pending, processing, paid, partially_paid, cancelled, refunded
  
  // Customer information
  "customer": {
    "type": "individual",                             // individual, organisation
    "contactId": "uuid",                              // Link to contact record
    "organisationId": "uuid"                          // For org registrations
  },
  
  // Booking contact (person who made the booking)
  "booking": {
    "contactId": "uuid",                              // MUST have user account
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+61 400 123 456"
  },
  
  // Order line items (tickets/products purchased)
  "lineItems": [{
    "_id": ObjectId("..."),
    "productId": "uuid",                              // Event product from catalog
    "productName": "Grand Proclamation Banquet",
    "variationId": "uuid",                            // Ticket type variation
    "variationName": "Premium Table",
    "quantity": 2,
    "unitPrice": {"$numberDecimal": "115.00"},
    "totalPrice": {"$numberDecimal": "230.00"},
    "attendees": ["uuid1", "uuid2"]                   // Links to attendee IDs
  }],
  
  // Attendees on this order
  "attendees": [{
    "attendeeId": "uuid",                             // New UUID v4
    "contactId": "uuid",                              // Created contact
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "+61 400 123 456",
    "ticketId": "uuid",                               // Created ticket
    "lineItemId": ObjectId("..."),                    // Which line item
    "dietaryRequirements": ["vegetarian"],
    "specialNeeds": "Wheelchair access",
    "masonicProfile": {
      "isMason": true,
      "title": "W Bro",
      "rank": "MM",
      "lodgeId": "uuid",
      "lodgeName": "Lodge Name No. 123"
    }
  }],
  
  // Financial totals
  "totals": {
    "subtotal": {"$numberDecimal": "230.00"},
    "discount": {"$numberDecimal": "0.00"},
    "tax": {"$numberDecimal": "23.00"},              // GST
    "merchantFee": {"$numberDecimal": "6.90"},       // Stripe/Square fee
    "platformFee": {"$numberDecimal": "11.50"},      // Platform commission
    "total": {"$numberDecimal": "253.00"},
    "paid": {"$numberDecimal": "253.00"},
    "balance": {"$numberDecimal": "0.00"},
    "currency": "AUD"
  },
  
  // Payment information
  "payment": {
    "status": "paid",                                 // pending, processing, paid, failed, refunded
    "method": "stripe",                               // stripe, square, invoice, cash
    "transactions": ["uuid1", "uuid2"]                // Financial transaction IDs
  },
  
  // Billing information
  "billing": {
    "contactId": "uuid",                              // MUST have user account
    "name": "Jane Smith",
    "email": "accounts@lodge.org.au",
    "phone": "+61 400 123 456",
    "address": {
      "line1": "123 Main St",
      "line2": "",
      "city": "Sydney",
      "state": "NSW",
      "postcode": "2000",
      "country": "Australia"
    },
    "abn": "12 345 678 901",
    "organisationName": "Lodge Name No. 123"
  },
  
  // Additional info
  "notes": "Special dietary requirements noted",
  
  // Metadata
  "metadata": {
    "source": {
      "channel": "online",                            // online, admin, import
      "device": "desktop",                            // desktop, mobile, tablet
      "ipAddress": "203.0.113.0"
    },
    "createdAt": ISODate("2024-01-15T10:30:00Z"),
    "createdBy": "uuid",                              // User who created
    "updatedAt": ISODate("2024-01-15T10:35:00Z"),
    "updatedBy": "uuid"                               // User who updated
  }
}
```

## Field Definitions

### Core Fields
- `orderId`: UUID v4 for the order
- `orderNumber`: Human-readable order number from registration
- `orderType`: Type of order (registration for event registrations)
- `catalogObjectId`: Links to the function catalog object
- `status`: Current order status

### Customer
- `type`: individual or organisation registration
- `contactId`: Link to the customer's contact record
- `organisationId`: For lodge/organisation registrations

### Booking Contact
- `contactId`: Person who made the booking (MUST have user account)
- Denormalized contact info for quick access

### Line Items
- Each ticket type purchased becomes a line item
- Links to catalog products (events) and variations (ticket types)
- `attendees` array links to attendee IDs assigned to this line item

### Attendees
- Each person attending gets an attendee record
- `contactId`: Links to created contact record
- `ticketId`: Links to created ticket record
- `lineItemId`: Which line item they're assigned to
- Full profile including masonic data

### Totals
- `subtotal`: Sum of line items
- `tax`: GST amount
- `merchantFee`: Payment gateway fee (Stripe/Square)
- `platformFee`: Platform commission
- `total`: Final amount to pay
- `paid`: Amount actually paid
- `balance`: Remaining balance

### Payment
- `method`: Payment gateway used
- `transactions`: Array of financial transaction IDs

### Billing
- `contactId`: Billing contact (MUST have user account)
- Full billing address and business details

## Indexes
```javascript
db.orders.createIndex({ "orderId": 1 }, { unique: true })
db.orders.createIndex({ "orderNumber": 1 }, { unique: true })
db.orders.createIndex({ "customer.contactId": 1 })
db.orders.createIndex({ "customer.organisationId": 1 })
db.orders.createIndex({ "booking.contactId": 1 })
db.orders.createIndex({ "billing.contactId": 1 })
db.orders.createIndex({ "attendees.contactId": 1 })
db.orders.createIndex({ "catalogObjectId": 1 })
db.orders.createIndex({ "status": 1, "createdAt": -1 })
db.orders.createIndex({ "payment.status": 1 })
db.orders.createIndex({ "payment.transactions": 1 })
```

## Migration Notes

### From Registrations:
- `confirmation_number` → `orderNumber`
- `registration_type` → `customer.type`
- `function_id` → lookup catalog object → `catalogObjectId`
- `registrationData.bookingContact` → create contact/user → `booking`
- `registrationData.billingContact` → create contact/user → `billing`
- `total_price_paid` → `totals.total`
- `total_amount_paid` → `totals.paid`
- `stripe_fee/square_fee` → `totals.merchantFee`
- `platform_fee_amount` → `totals.platformFee`

### From Attendees:
- Each attendee → create contact → link in `attendees` array
- Preserve all masonic profile data

### From Tickets:
- Group by event/ticket type → create line items
- Link attendees to line items
- Create ticket records for each attendee

### From Payments:
- Each payment → create financial transaction
- Link via `payment.transactions`