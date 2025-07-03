# Financial Transactions Collection - Indexes

## Primary Indexes

### 1. Unique Transaction ID
```javascript
db.financialTransactions.createIndex(
  { "transactionId": 1 },
  { 
    unique: true,
    name: "transactionId_unique"
  }
)
```
**Purpose**: Ensure transaction ID uniqueness, fast lookups by transaction ID

### 2. Reference Lookup
```javascript
db.financialTransactions.createIndex(
  { "reference.type": 1, "reference.id": 1 },
  { name: "reference_lookup" }
)
```
**Purpose**: Find transactions for a specific registration or entity

### 3. Function Reporting
```javascript
db.financialTransactions.createIndex(
  { "reference.functionId": 1, "type": 1, "audit.createdAt": -1 },
  { name: "function_transactions" }
)
```
**Purpose**: Financial reporting by function with date sorting

### 4. Customer Transactions
```javascript
db.financialTransactions.createIndex(
  { "parties.customer.id": 1, "audit.createdAt": -1 },
  { name: "customer_history" }
)
```
**Purpose**: Customer transaction history and statements

### 4a. Customer Type Analysis
```javascript
db.financialTransactions.createIndex(
  { "parties.customer.type": 1, "parties.customer.id": 1 },
  { name: "customer_type_lookup" }
)
```
**Purpose**: Analyze transactions by customer type (organisation, contact, user)

## Payment Processing Indexes

### 5. Gateway Transaction Lookup
```javascript
db.financialTransactions.createIndex(
  { "payments.gatewayTransactionId": 1 },
  { 
    sparse: true,
    name: "gateway_transaction_lookup"
  }
)
```
**Purpose**: Quick lookup by Stripe/Square transaction IDs

### 6. Payment Status
```javascript
db.financialTransactions.createIndex(
  { "payments.status": 1, "audit.createdAt": -1 },
  { name: "payment_status_monitoring" }
)
```
**Purpose**: Monitor pending/failed payments

## Financial Reporting Indexes

### 7. Reconciliation Status
```javascript
db.financialTransactions.createIndex(
  { "reconciliation.status": 1, "payments.processedAt": 1 },
  { name: "reconciliation_queue" }
)
```
**Purpose**: Find unreconciled transactions for processing

### 8. Date Range Reporting
```javascript
db.financialTransactions.createIndex(
  { "payments.processedAt": 1, "type": 1 },
  { name: "financial_reporting" }
)
```
**Purpose**: Financial reports by date range

### 9. Invoice Number Lookup
```javascript
db.financialTransactions.createIndex(
  { "invoices.customer.invoiceNumber": 1 },
  { 
    sparse: true,
    name: "invoice_number_lookup"
  }
)
```
**Purpose**: Quick invoice retrieval

## Accounting Integration Indexes

### 10. Export Queue
```javascript
db.financialTransactions.createIndex(
  { "accounting.exported": 1, "audit.updatedAt": 1 },
  { 
    partialFilterExpression: { "accounting.exported": false },
    name: "accounting_export_queue"
  }
)
```
**Purpose**: Find transactions pending accounting export

### 11. External Reference Lookup
```javascript
db.financialTransactions.createIndex(
  { "accounting.externalReferences.xeroId": 1 },
  { 
    sparse: true,
    name: "xero_reference"
  }
)
```
**Purpose**: Sync with external accounting systems

## Compound Indexes for Complex Queries

### 12. Revenue Analysis
```javascript
db.financialTransactions.createIndex(
  { 
    "reference.functionId": 1,
    "type": 1,
    "payments.status": 1,
    "amounts.total": 1
  },
  { name: "revenue_analysis" }
)
```
**Purpose**: Complex revenue queries with amount sorting

### 13. Refund Tracking
```javascript
db.financialTransactions.createIndex(
  { "refund.originalTransactionId": 1 },
  { 
    sparse: true,
    name: "refund_tracking"
  }
)
```
**Purpose**: Link refunds to original transactions

## Text Search Index

### 14. Transaction Search
```javascript
db.financialTransactions.createIndex(
  { 
    "transactionId": "text",
    "parties.customer.name": "text",
    "invoices.customer.invoiceNumber": "text",
    "audit.notes.note": "text"
  },
  { name: "transaction_search" }
)
```
**Purpose**: Full-text search across transactions

## Performance Considerations

1. **Partial Indexes**: Use `partialFilterExpression` for status-based indexes to reduce index size
2. **Sparse Indexes**: Use for optional fields like external references
3. **Compound Index Order**: Most selective fields first
4. **Index Hints**: Use for complex queries that might choose wrong index

## Maintenance

```javascript
// Analyze index usage
db.financialTransactions.aggregate([
  { $indexStats: {} }
])

// Rebuild indexes periodically
db.financialTransactions.reIndex()
```