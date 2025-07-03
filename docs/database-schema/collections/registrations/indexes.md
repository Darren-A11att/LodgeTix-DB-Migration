# Registrations Collection - Indexes

## Primary Indexes

### 1. Unique Registration Number
```javascript
db.registrations.createIndex(
  { "registrationNumber": 1 },
  { 
    unique: true,
    name: "registrationNumber_unique"
  }
)
```
**Purpose**: Ensure registration number uniqueness, fast lookups

### 2. Function Lookup
```javascript
db.registrations.createIndex(
  { "functionId": 1, "status": 1 },
  { name: "function_status" }
)
```
**Purpose**: Find registrations for a function by status

### 3. Contact Registrant History
```javascript
db.registrations.createIndex(
  { "registrant.contactId": 1, "metadata.createdAt": -1 },
  { 
    sparse: true,
    name: "contact_registrant_history" 
  }
)
```
**Purpose**: Individual contact purchase history

### 4. Organisation Registrant History
```javascript
db.registrations.createIndex(
  { "registrant.organisationId": 1, "metadata.createdAt": -1 },
  { 
    sparse: true,
    name: "org_registrant_history" 
  }
)
```
**Purpose**: Organisation purchase history

### 5. User Account History
```javascript
db.registrations.createIndex(
  { "registrant.userId": 1, "metadata.createdAt": -1 },
  { 
    sparse: true,
    name: "user_account_history" 
  }
)
```
**Purpose**: Track registrations by user account

### 6. Payment Transaction Lookup
```javascript
db.registrations.createIndex(
  { "payment.transactionId": 1 },
  { 
    sparse: true,
    name: "payment_transaction"
  }
)
```
**Purpose**: Find registration by payment transaction ID

## Status and Workflow Indexes

### 7. Incomplete Registrations
```javascript
db.registrations.createIndex(
  { "status": 1, "metadata.createdAt": 1 },
  {
    partialFilterExpression: { 
      status: { $in: ["pending", "partial"] } 
    },
    name: "incomplete_registrations"
  }
)
```
**Purpose**: Find registrations needing attention

### 8. Payment Status
```javascript
db.registrations.createIndex(
  { "payment.status": 1, "payment.paidAt": 1 },
  { name: "payment_status_date" }
)
```
**Purpose**: Financial reporting and reconciliation

### 9. Attendee Allocation
```javascript
db.registrations.createIndex(
  { "type": 1, "attendeeAllocation.unassigned": 1 },
  {
    partialFilterExpression: { 
      "attendeeAllocation.unassigned": { $gt: 0 } 
    },
    name: "unassigned_attendees"
  }
)
```
**Purpose**: Find bulk registrations needing attendee assignment

## Reporting Indexes

### 10. Date Range Queries
```javascript
db.registrations.createIndex(
  { "metadata.createdAt": 1, "functionId": 1 },
  { name: "created_date_function" }
)
```
**Purpose**: Registration reports by date range

### 11. Registration Type Analysis
```javascript
db.registrations.createIndex(
  { "type": 1, "functionId": 1, "purchase.total": 1 },
  { name: "type_function_revenue" }
)
```
**Purpose**: Analyze registration patterns and revenue by type

### 12. Product Sales
```javascript
db.registrations.createIndex(
  { "purchase.items.productId": 1, "purchase.items.productType": 1 },
  { name: "product_sales" }
)
```
**Purpose**: Track product sales across registrations

## Communication Indexes

### 13. Follow-up Required
```javascript
db.registrations.createIndex(
  { "communications.confirmationSent": 1, "status": 1 },
  {
    partialFilterExpression: { 
      "communications.confirmationSent": false 
    },
    name: "pending_confirmation"
  }
)
```
**Purpose**: Find registrations needing confirmation emails

### 14. Reminder Tracking
```javascript
db.registrations.createIndex(
  { "communications.lastReminderAt": 1, "status": 1 },
  { name: "reminder_tracking" }
)
```
**Purpose**: Schedule reminder communications

## Financial Indexes

### 15. Financial Transaction Link
```javascript
db.registrations.createIndex(
  { "financialTransactionId": 1 },
  { 
    sparse: true,
    name: "financial_transaction_link"
  }
)
```
**Purpose**: Join with financial transactions

### 16. Revenue Reporting
```javascript
db.registrations.createIndex(
  { "functionId": 1, "purchase.total": 1, "payment.status": 1 },
  { name: "function_revenue" }
)
```
**Purpose**: Revenue analysis by function

## Compound Text Index

### 17. Registration Search
```javascript
db.registrations.createIndex(
  { 
    "registrationNumber": "text",
    "registrant.name": "text",
    "registrant.email": "text",
    "customFields.internalNotes": "text"
  },
  { name: "registration_search" }
)
```
**Purpose**: Full-text search across registrations

## Performance Considerations

1. **Covered Queries**: Indexes include commonly projected fields
2. **Partial Indexes**: Reduce index size for status-based queries
3. **Compound Index Order**: Most selective fields first
4. **Sparse Indexes**: For optional reference fields

## Index Maintenance

```javascript
// Monitor index usage
db.registrations.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": { $gt: 0 } } },
  { $sort: { "accesses.ops": -1 } }
])

// Find unused indexes
db.registrations.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } }
])
```