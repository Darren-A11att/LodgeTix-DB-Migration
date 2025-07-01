# Tickets Collection - Indexes

## Primary Indexes

### 1. Unique Ticket Number
```javascript
db.tickets.createIndex(
  { "ticketNumber": 1 },
  { 
    unique: true,
    name: "ticketNumber_unique"
  }
)
```
**Purpose**: Ensure ticket number uniqueness, support ticket lookups

### 2. Barcode Scanning
```javascript
db.tickets.createIndex(
  { "security.barcode": 1 },
  { 
    unique: true,
    sparse: true,
    name: "barcode_unique"
  }
)
```
**Purpose**: Fast barcode scanning at entry points

### 3. QR Code Scanning
```javascript
db.tickets.createIndex(
  { "security.qrData": 1 },
  { 
    unique: true,
    sparse: true,
    name: "qr_code_unique"
  }
)
```
**Purpose**: Fast QR code validation

## Event and Access Indexes

### 4. Event Tickets
```javascript
db.tickets.createIndex(
  { "product.eventId": 1, "access.status": 1 },
  { name: "event_active_tickets" }
)
```
**Purpose**: Find all tickets for an event by status

### 5. Valid Tickets for Scanning
```javascript
db.tickets.createIndex(
  { "access.status": 1, "access.validFrom": 1, "access.validUntil": 1 },
  {
    partialFilterExpression: { 
      "access.status": "valid" 
    },
    name: "scannable_tickets"
  }
)
```
**Purpose**: Optimize entry scanning for valid tickets only

### 6. Gate Access Control
```javascript
db.tickets.createIndex(
  { "access.gates": 1, "product.eventId": 1, "access.status": 1 },
  { name: "gate_access_control" }
)
```
**Purpose**: Validate ticket access at specific gates

## Ownership and Transfer Indexes

### 7. Current Owner Lookup
```javascript
db.tickets.createIndex(
  { "currentOwner.attendeeId": 1, "product.functionId": 1 },
  { name: "owner_tickets" }
)
```
**Purpose**: Find all tickets owned by an attendee

### 8. Registration Tickets
```javascript
db.tickets.createIndex(
  { "purchase.registrationId": 1 },
  { name: "registration_tickets" }
)
```
**Purpose**: List all tickets from a registration

### 9. Transfer History
```javascript
db.tickets.createIndex(
  { "transferHistory.transferredAt": -1 },
  { 
    sparse: true,
    name: "recent_transfers"
  }
)
```
**Purpose**: Track recent ticket transfers

## Financial Indexes

### 10. Refund Processing
```javascript
db.tickets.createIndex(
  { "purchase.refund.date": 1, "purchase.paymentStatus": 1 },
  {
    partialFilterExpression: { 
      "purchase.paymentStatus": "refunded" 
    },
    name: "refunded_tickets"
  }
)
```
**Purpose**: Process and report on refunds

### 11. Revenue Analysis
```javascript
db.tickets.createIndex(
  { "product.functionId": 1, "product.productCategory": 1, "purchase.pricePaid": 1 },
  { name: "revenue_analysis" }
)
```
**Purpose**: Revenue reporting by category

## Delivery and Collection

### 12. Uncollected Tickets
```javascript
db.tickets.createIndex(
  { "delivery.method": 1, "delivery.status": 1 },
  {
    partialFilterExpression: { 
      "delivery.method": "will_call",
      "delivery.status": { $ne: "collected" }
    },
    name: "will_call_pending"
  }
)
```
**Purpose**: Track tickets awaiting collection

### 13. Delivery Tracking
```javascript
db.tickets.createIndex(
  { "delivery.physical.trackingNumber": 1 },
  { 
    sparse: true,
    name: "shipping_tracking"
  }
)
```
**Purpose**: Track physical ticket shipments

## Usage Analytics

### 14. Entry Tracking
```javascript
db.tickets.createIndex(
  { "usageHistory.usedAt": -1, "product.eventId": 1 },
  { name: "entry_timeline" }
)
```
**Purpose**: Analyze entry patterns and peak times

### 15. Seat Assignment
```javascript
db.tickets.createIndex(
  { "seat.section": 1, "seat.row": 1, "seat.number": 1 },
  {
    sparse: true,
    name: "seat_map"
  }
)
```
**Purpose**: Manage seated events

## Security and Compliance

### 16. High Risk Tickets
```javascript
db.tickets.createIndex(
  { "security.riskScore": -1, "status": 1 },
  {
    partialFilterExpression: { 
      "security.riskScore": { $gte: 0.7 }
    },
    name: "high_risk_tickets"
  }
)
```
**Purpose**: Monitor potentially fraudulent tickets

### 17. Revoked Tickets
```javascript
db.tickets.createIndex(
  { "access.revokedAt": -1, "access.revokedBy": 1 },
  {
    partialFilterExpression: { 
      "access.status": "revoked"
    },
    name: "revoked_tickets"
  }
)
```
**Purpose**: Track revoked tickets and reasons

## Compound Text Index

### 18. Ticket Search
```javascript
db.tickets.createIndex(
  { 
    "ticketNumber": "text",
    "product.productName": "text",
    "product.eventName": "text",
    "currentOwner.name": "text"
  },
  { name: "ticket_search" }
)
```
**Purpose**: Full-text search across ticket details

## Performance Considerations

1. **Scanning Optimization**: Partial indexes on valid tickets reduce scan time
2. **Transfer Tracking**: Sparse indexes for optional transfer data
3. **Financial Queries**: Compound indexes for revenue analysis
4. **Security Monitoring**: Dedicated indexes for high-risk tickets

## Index Maintenance

```javascript
// Monitor scanning performance
db.tickets.aggregate([
  { $indexStats: {} },
  { $match: { 
    name: { $in: ["barcode_unique", "qr_code_unique", "scannable_tickets"] }
  }},
  { $sort: { "accesses.ops": -1 } }
])

// Check for fragmented indexes
db.tickets.aggregate([
  { $indexStats: {} },
  { $project: {
    name: 1,
    size: { $divide: ["$size", 1048576] }, // Size in MB
    opsPerMB: { $divide: ["$accesses.ops", { $divide: ["$size", 1048576] }] }
  }},
  { $sort: { opsPerMB: -1 } }
])
```