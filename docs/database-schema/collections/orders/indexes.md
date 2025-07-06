# Orders Collection - Indexes

## Primary Indexes

### 1. Unique Order Number
```javascript
db.orders.createIndex(
  { "orderNumber": 1 },
  { 
    unique: true,
    name: "orderNumber_unique"
  }
)
```
**Purpose**: Ensure order number uniqueness, fast lookups

## Query Optimization Indexes

### 2. Catalog Orders
```javascript
db.orders.createIndex(
  { "catalogObjectId": 1, "status": 1 },
  { 
    name: "catalog_orders"
  }
)
```
**Purpose**: Find all orders for a catalog object by status

### 3. Customer Orders
```javascript
db.orders.createIndex(
  { "customer.contactId": 1, "metadata.createdAt": -1 },
  { 
    sparse: true,
    name: "customer_orders"
  }
)
```
**Purpose**: List orders for a specific customer

### 4. Organisation Orders
```javascript
db.orders.createIndex(
  { "customer.organisationId": 1, "status": 1 },
  { 
    sparse: true,
    name: "org_orders"
  }
)
```
**Purpose**: Find organisation/lodge orders

## Date and Status Indexes

### 5. Recent Orders
```javascript
db.orders.createIndex(
  { "metadata.createdAt": -1 },
  { 
    name: "order_date"
  }
)
```
**Purpose**: Sort orders by creation date

### 6. Order Status
```javascript
db.orders.createIndex(
  { "status": 1, "metadata.createdAt": -1 },
  { 
    name: "status_date"
  }
)
```
**Purpose**: Filter orders by status with date sorting

### 7. Payment Status
```javascript
db.orders.createIndex(
  { "payment.status": 1, "totals.balance": 1 },
  { 
    name: "payment_tracking"
  }
)
```
**Purpose**: Track payment status and outstanding balances

## Fulfillment Indexes

### 8. Unfulfilled Items
```javascript
db.orders.createIndex(
  { "lineItems.fulfillment.status": 1, "status": 1 },
  { 
    name: "fulfillment_queue",
    partialFilterExpression: {
      "lineItems.fulfillment.status": "pending",
      "status": { $in: ["paid", "partially_paid"] }
    }
  }
)
```
**Purpose**: Find orders needing fulfillment

### 9. Attendee Lookup
```javascript
db.orders.createIndex(
  { "lineItems.owner.contactId": 1 },
  { 
    sparse: true,
    name: "attendee_orders"
  }
)
```
**Purpose**: Find all orders containing a specific attendee

## Financial Indexes

### 10. Revenue by Period
```javascript
db.orders.createIndex(
  { 
    "metadata.createdAt": 1,
    "totals.currency": 1,
    "status": 1
  },
  { 
    name: "revenue_analysis",
    partialFilterExpression: {
      "status": { $in: ["paid", "partially_paid"] }
    }
  }
)
```
**Purpose**: Financial reporting and analytics

### 11. Outstanding Balances
```javascript
db.orders.createIndex(
  { "totals.balance": -1, "status": 1 },
  { 
    name: "outstanding_balances",
    partialFilterExpression: {
      "totals.balance": { $gt: 0 }
    }
  }
)
```
**Purpose**: Find orders with outstanding payments

## Source and Channel Indexes

### 12. Order Source
```javascript
db.orders.createIndex(
  { "metadata.source.channel": 1, "metadata.createdAt": -1 },
  { 
    name: "order_channels"
  }
)
```
**Purpose**: Analyze orders by source channel

## Compound Indexes for Complex Queries

### 13. Customer Order History
```javascript
db.orders.createIndex(
  { 
    "customer.contactId": 1,
    "orderType": 1,
    "status": 1,
    "metadata.createdAt": -1
  },
  { 
    sparse: true,
    name: "customer_history"
  }
)
```
**Purpose**: Complete customer order history with filtering

### 14. Product Sales Analysis
```javascript
db.orders.createIndex(
  { 
    "lineItems.productId": 1,
    "lineItems.variationId": 1,
    "status": 1
  },
  { 
    name: "product_sales",
    partialFilterExpression: {
      "status": { $in: ["paid", "partially_paid"] }
    }
  }
)
```
**Purpose**: Analyze sales by product/variation

## Text Search

### 15. Order Search
```javascript
db.orders.createIndex(
  { 
    "orderNumber": "text",
    "customer.rawData.name": "text",
    "customer.rawData.email": "text",
    "notes": "text"
  },
  { 
    name: "order_search"
  }
)
```
**Purpose**: Full-text search across orders

## Performance Monitoring

### Index Usage Stats
```javascript
db.orders.aggregate([
  { $indexStats: {} },
  { $sort: { "accesses.ops": -1 } }
])
```

### Slow Query Analysis
```javascript
db.orders.find({
  "customer.contactId": ObjectId("..."),
  "status": "paid"
}).explain("executionStats")
```

### Index Size Check
```javascript
db.orders.stats().indexSizes
```

## Index Maintenance Strategy

1. **High-Use Indexes**: Monitor orderNumber, customer, and status indexes
2. **Partial Indexes**: Use for specific status values to reduce size
3. **Sparse Indexes**: Essential for optional fields like contactId
4. **Compound Index Order**: Most selective field first
5. **Regular Review**: Monthly analysis of unused indexes

## Critical Performance Notes

1. **Order Number**: Most frequent lookup - keep optimized
2. **Customer Queries**: Compound index prevents collection scans
3. **Fulfillment**: Partial index crucial for performance
4. **Financial**: Balance queries need careful indexing
5. **Text Search**: Limited to specific fields for performance