# MongoDB Database Indexing Strategy

## Overview
This document outlines all ID fields across collections that require indexing for efficient querying and API performance.

## Collections Analysis

### 1. Registrations Collection

#### Primary ID Fields:
- **_id** - MongoDB ObjectId (primary key)
- **registrationId** - UUID format
- **customerId** - UUID format
- **stripePaymentIntentId** - Stripe payment identifier
- **primaryAttendeeId** - Reference to primary attendee
- **organisationId** - Organisation reference
- **connectedAccountId** - Stripe Connect account ID
- **platformFeeId** - Platform fee reference
- **functionId** - UUID format (event/function identifier)
- **authUserId** - UUID format (authenticated user)
- **eventId** - Event reference
- **bookingContactId** - UUID format
- **squarePaymentId** - Square payment identifier

#### Nested ID Fields:
- **registrationData.authUserId** - UUID format
- **registrationData.functionId** - UUID format
- **registrationData.registrationId** - UUID format
- **registrationData.square_payment_id** - Square payment identifier
- **registrationData.square_customer_id** - Square customer identifier
- **registrationData.stripePaymentIntentId** - Stripe payment identifier

#### Attendee-Related IDs:
- **registrationData.attendees.lodge_id** - UUID format
- **registrationData.attendees.guestOfId** - Guest relationship ID
- **registrationData.attendees.attendeeId** - UUID format
- **registrationData.attendees.grand_lodge_id** - UUID format
- **registrationData.attendees.lodgeOrganisationId** - UUID format
- **registrationData.attendees.grandLodgeOrganisationId** - UUID format

#### Ticket-Related IDs:
- **registrationData.selectedTickets.id** - Composite ticket ID
- **registrationData.selectedTickets.attendeeId** - UUID format
- **registrationData.selectedTickets.event_ticket_id** - UUID format

### 2. Payments Collection

#### Primary ID Fields:
- **_id** - MongoDB ObjectId (primary key)
- **transactionId** - Stripe charge ID (ch_*)
- **customerId** - Customer reference
- **paymentId** - Stripe PaymentIntent ID (pi_*)

#### Nested ID Fields in originalData:
- **originalData.id** - Stripe charge ID
- **originalData["PaymentIntent ID"]** - Stripe PaymentIntent ID
- **originalData["Card ID"]** - Stripe payment method ID (pm_*)
- **originalData["Customer ID"]** - Stripe customer ID
- **originalData["Invoice ID"]** - Stripe invoice ID
- **originalData["Checkout Session ID"]** - Stripe checkout session
- **originalData["Client Reference ID"]** - Client reference
- **originalData["Payment Link ID"]** - Stripe payment link
- **originalData["Terminal Location ID"]** - Terminal location
- **originalData["Terminal Reader ID"]** - Terminal reader
- **originalData["Application ID"]** - Application reference

#### Metadata ID Fields:
- **originalData["function_id (metadata)"]** - Function reference
- **originalData["package_id (metadata)"]** - Package reference
- **originalData["organisationId (metadata)"]** - UUID format
- **originalData["sessionId (metadata)"]** - UUID format
- **originalData["functionId (metadata)"]** - UUID format
- **originalData["registrationId (metadata)"]** - UUID format

## Recommended Index Creation Scripts

### Registrations Collection Indexes

```javascript
// Primary lookups - most frequently used
db.registrations.createIndex({ "registrationId": 1 }, { background: true })
db.registrations.createIndex({ "customerId": 1 }, { background: true })
db.registrations.createIndex({ "functionId": 1 }, { background: true })
db.registrations.createIndex({ "authUserId": 1 }, { background: true })
db.registrations.createIndex({ "bookingContactId": 1 }, { background: true })

// Payment-related indexes
db.registrations.createIndex({ "stripePaymentIntentId": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "connectedAccountId": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.square_payment_id": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "registrationData.square_customer_id": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "squarePaymentId": 1 }, { background: true, sparse: true })

// Organisation and event indexes
db.registrations.createIndex({ "organisationId": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "eventId": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "primaryAttendeeId": 1 }, { background: true, sparse: true })
db.registrations.createIndex({ "platformFeeId": 1 }, { background: true, sparse: true })

// Attendee lookups
db.registrations.createIndex({ "registrationData.attendees.attendeeId": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.lodge_id": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.grand_lodge_id": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.lodgeOrganisationId": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.grandLodgeOrganisationId": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.guestOfId": 1 }, { background: true, sparse: true })

// Ticket lookups
db.registrations.createIndex({ "registrationData.selectedTickets.attendeeId": 1 }, { background: true })
db.registrations.createIndex({ "registrationData.selectedTickets.event_ticket_id": 1 }, { background: true })

// Compound indexes for common query patterns
db.registrations.createIndex({ "functionId": 1, "status": 1 }, { background: true })
db.registrations.createIndex({ "customerId": 1, "createdAt": -1 }, { background: true })
db.registrations.createIndex({ "registrationData.attendees.attendeeId": 1, "functionId": 1 }, { background: true })
db.registrations.createIndex({ "functionId": 1, "paymentStatus": 1 }, { background: true })
db.registrations.createIndex({ "connectedAccountId": 1, "createdAt": -1 }, { background: true })

// Text search index for confirmation numbers
db.registrations.createIndex({ "confirmationNumber": 1 }, { background: true })
```

### Payments Collection Indexes

```javascript
// Primary payment identifiers
db.payments.createIndex({ "transactionId": 1 }, { background: true })
db.payments.createIndex({ "paymentId": 1 }, { background: true })
db.payments.createIndex({ "customerId": 1 }, { background: true, sparse: true })

// Original data payment identifiers
db.payments.createIndex({ "originalData.id": 1 }, { background: true })
db.payments.createIndex({ "originalData.PaymentIntent ID": 1 }, { background: true })
db.payments.createIndex({ "originalData.Card ID": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.Customer ID": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.Invoice ID": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.Checkout Session ID": 1 }, { background: true, sparse: true })

// Metadata indexes for cross-referencing
db.payments.createIndex({ "originalData.functionId (metadata)": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.registrationId (metadata)": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.organisationId (metadata)": 1 }, { background: true, sparse: true })
db.payments.createIndex({ "originalData.sessionId (metadata)": 1 }, { background: true, sparse: true })

// Compound indexes for common queries
db.payments.createIndex({ "status": 1, "timestamp": -1 }, { background: true })
db.payments.createIndex({ "source": 1, "timestamp": -1 }, { background: true })
db.payments.createIndex({ "customerEmail": 1, "timestamp": -1 }, { background: true })
db.payments.createIndex({ "originalData.functionId (metadata)": 1, "status": 1 }, { background: true })

// Time-based queries
db.payments.createIndex({ "timestamp": -1 }, { background: true })
```

## Index Management Best Practices

1. **Use `sparse: true`** for fields that may be null or missing to save space
2. **Use `background: true`** for production index creation to avoid blocking
3. **Monitor index usage** with `db.collection.getIndexes()` and `db.collection.aggregate([{$indexStats: {}}])`
4. **Consider TTL indexes** for temporary data
5. **Review and remove unused indexes** periodically

## Query Patterns to Support

### Registration Queries:
- Find all registrations for a specific function
- Get registrations by customer/user
- Lookup registration by confirmation number
- Find attendees across all registrations
- Get registrations by payment status
- Find registrations by organisation

### Payment Queries:
- Reconcile payments with registrations
- Find payments by transaction ID
- Get all payments for a function
- Track payments by customer email
- Cross-reference with registration IDs

## Monitoring Recommendations

1. Set up alerts for slow queries
2. Monitor index hit rates
3. Track index sizes
4. Review query explain plans regularly
5. Use MongoDB Atlas Performance Advisor if available