# Product Requirements Document: Orders & Registrations

## Overview
Registrations from the dirty database become Orders in the clean database. Each registration contains attendees, payment information, and ticket purchases that must be properly migrated and linked.

## Core Principles
- **Registrations → Orders**: Every registration becomes an order
- **Attendees → Contacts**: Every attendee becomes a contact
- **Booking/Billing Contacts → Users**: Must have user accounts
- **Tickets → Line Items**: Convert ticket purchases to order line items
- **Payments → Financial Transactions**: Track all payment details
- **Update Inventory**: Reduce available inventory in catalog
- **Create Tickets**: Generate tickets for fulfilled items

## Data Flow

### 1. Registration → Order
**Source Data:**
- Registration record with booking/billing contacts
- Attendees linked to registration
- Tickets purchased
- Payment information

**Target Structure:**
```javascript
{
  "_id": ObjectId,
  "orderId": "uuid-v4", // New UUID
  "orderNumber": "IND-134890AT", // From registration
  "orderType": "registration",
  "catalogObjectId": "uuid", // Function catalog object
  "status": "paid|pending|cancelled|refunded",
  
  "customer": {
    "type": "individual|organisation",
    "contactId": "uuid", // Link to contact
    "organisationId": "uuid", // For org registrations
  },
  
  "booking": {
    "contactId": "uuid", // Booking contact (has user account)
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+61 400 123 456"
  },
  
  "lineItems": [
    {
      "_id": ObjectId,
      "productId": "uuid", // Event product
      "productName": "Grand Banquet",
      "variationId": "uuid", // Ticket type
      "variationName": "Premium Table",
      "quantity": 2,
      "unitPrice": {"$numberDecimal": "115.00"},
      "totalPrice": {"$numberDecimal": "230.00"},
      "attendees": ["attendeeId1", "attendeeId2"] // Links to attendees
    }
  ],
  
  "attendees": [
    {
      "attendeeId": "uuid",
      "contactId": "uuid", // Created contact
      "firstName": "John",
      "lastName": "Smith",
      "ticketId": "uuid" // Created ticket
    }
  ],
  
  "totals": {
    "subtotal": {"$numberDecimal": "230.00"},
    "discount": {"$numberDecimal": "0.00"},
    "tax": {"$numberDecimal": "23.00"}, // GST
    "merchantFee": {"$numberDecimal": "6.90"}, // Stripe/Square fee
    "platformFee": {"$numberDecimal": "11.50"}, // Platform commission
    "total": {"$numberDecimal": "253.00"},
    "paid": {"$numberDecimal": "253.00"},
    "balance": {"$numberDecimal": "0.00"},
    "currency": "AUD"
  },
  
  "payment": {
    "status": "paid",
    "method": "stripe|square|invoice",
    "transactions": ["transactionId1"] // Links to financial transactions
  },
  
  "billing": {
    "contactId": "uuid", // Billing contact (has user account)
    "name": "John Smith",
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
    "organisationName": "Lodge Name"
  }
}
```

### 2. Attendee → Contact → User Flow

**For each attendee:**
1. Create Contact with full profile (including masonic data)
2. Link to registration context
3. If booking/billing contact → Create User account

### 3. Payment → Financial Transaction

**For each payment:**
```javascript
{
  "_id": ObjectId,
  "transactionId": "uuid-v4",
  "orderId": "uuid", // Link to order
  "type": "payment|refund",
  "status": "succeeded|pending|failed",
  "amount": {"$numberDecimal": "253.00"},
  "currency": "AUD",
  
  "gateway": {
    "provider": "stripe|square",
    "transactionId": "pi_xxx", // Gateway reference
    "fee": {"$numberDecimal": "6.90"},
    "net": {"$numberDecimal": "246.10"}
  },
  
  "platformFee": {
    "amount": {"$numberDecimal": "11.50"},
    "percentage": 5
  }
}
```

### 4. Create Tickets

**For each fulfilled line item:**
```javascript
{
  "_id": ObjectId,
  "ticketId": "uuid-v4",
  "ticketNumber": "GP2025-001234",
  "orderId": "uuid",
  "contactId": "uuid", // Attendee
  "eventId": "uuid",
  "status": "active|used|cancelled",
  "qrCode": "base64-data"
}
```

## Migration Requirements

### From Registration:
- `confirmationNumber` → `orderNumber`
- `registrationType` → Determines `customer.type`
- `bookingContact` → Creates contact + user, links to `booking`
- `billingContact` → Creates contact + user, links to `billing`
- `attendees` → Creates contacts, links in `attendees` array
- `totalPricePaid` → `totals.total`
- `totalAmountPaid` → `totals.paid`
- `stripeFee/squareFee` → `totals.merchantFee`
- `platformFeeAmount` → `totals.platformFee`

### From Tickets:
- Group by event/ticket type → Create line items
- Link attendees to line items
- Calculate quantities and totals

### From Payments:
- Create financial transaction for each payment
- Link to order via `payment.transactions`
- Extract gateway fees and references

## Data Integrity Rules

1. **Booking/Billing Contacts MUST have user accounts**
2. **All attendees MUST become contacts**
3. **Line items MUST reference catalog products/variations**
4. **Totals MUST be calculated from line items + fees**
5. **Every payment MUST create a financial transaction**
6. **Inventory MUST be updated in catalog**
7. **Tickets MUST be created for fulfilled items**