# MongoDB Best Practices for Financial Services and Transaction Handling

## Table of Contents
1. [ACID Transactions in MongoDB](#acid-transactions-in-mongodb)
2. [Financial Data Modeling Patterns](#financial-data-modeling-patterns)
3. [Audit Trail and Immutability Strategies](#audit-trail-and-immutability-strategies)
4. [Double-Entry Bookkeeping in MongoDB](#double-entry-bookkeeping-in-mongodb)
5. [Handling Monetary Values](#handling-monetary-values)
6. [Idempotency Patterns for Payments](#idempotency-patterns-for-payments)
7. [Event Sourcing Patterns](#event-sourcing-patterns)
8. [Optimistic vs Pessimistic Locking](#optimistic-vs-pessimistic-locking)
9. [Multi-Document Transactions](#multi-document-transactions)
10. [Financial Compliance Requirements](#financial-compliance-requirements)

## ACID Transactions in MongoDB

### Overview
MongoDB provides full ACID (Atomicity, Consistency, Isolation, Durability) transaction support for multi-document operations, making it suitable for financial applications that require strict data consistency.

### Key Features
- **Multi-document ACID transactions** introduced in 2018 and refined through 2024
- **Performance benchmarks**: MongoDB can handle 1 million transactions per minute with 99.9% consistency (TPC-C benchmark)
- **Snapshot isolation** for cross-shard transactions in sharded clusters

### Best Practices

#### 1. Transaction Size Limits
```javascript
// Best practice: Limit transactions to 1,000 documents
db.runTransaction(async (session) => {
  const accounts = db.collection('accounts');
  
  // Process in batches if needed
  const batchSize = 1000;
  const totalDocs = await accounts.countDocuments(filter);
  
  for (let i = 0; i < totalDocs; i += batchSize) {
    await accounts.updateMany(
      filter,
      update,
      { session, limit: batchSize, skip: i }
    );
  }
});
```

#### 2. Transaction Duration
- Keep transactions short-lived to minimize contention
- Avoid long-running read queries within transactions
- Focus on UPDATE, INSERT, and DELETE operations

#### 3. Technical Limitations
- **16MB oplog entry limit** (MongoDB 4.0+)
- **60-second transaction timeout**
- **1,000-document modification cap** per transaction

### Real-World Benefits
- Financial services companies reported cutting 1,000+ lines of code by using multi-document transactions
- 90% throughput increase and 60% latency reduction for complex multi-collection updates

## Financial Data Modeling Patterns

### Document Model Advantages
MongoDB's document model allows embedding related financial data together, optimizing for common access patterns:

```javascript
{
  _id: ObjectId("..."),
  accountNumber: "12345678",
  accountHolder: {
    name: "John Doe",
    customerId: "CUST-001"
  },
  balance: {
    available: NumberDecimal("1000.00"),
    pending: NumberDecimal("50.00"),
    ledger: NumberDecimal("1050.00")
  },
  transactions: [
    {
      id: UUID("..."),
      date: ISODate("2024-01-15"),
      amount: NumberDecimal("-25.50"),
      type: "DEBIT",
      description: "ATM Withdrawal"
    }
  ]
}
```

### Ledger Implementation Pattern
Current (mobile banking platform) uses MongoDB for their ledger system:

```javascript
// Event-driven ledger pattern
{
  _id: ObjectId("..."),
  eventType: "TRANSACTION",
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  accountId: "12345678",
  transactionId: UUID("..."),
  details: {
    type: "ACH_TRANSFER",
    amount: NumberDecimal("500.00"),
    direction: "CREDIT",
    counterparty: {
      accountNumber: "87654321",
      routingNumber: "123456789"
    }
  },
  metadata: {
    status: "PENDING",
    clearedAt: null,
    reconciliationId: null
  }
}
```

Key principle: **Append-only event storage** - events are immutable once written

## Audit Trail and Immutability Strategies

### MongoDB Auditing Features
- **MongoDB Atlas**: Supports auditing for M10+ clusters
- **MongoDB Enterprise**: Full auditing capability for mongod and mongos

### Audit Configuration
```javascript
// Enable auditing in MongoDB config
{
  auditLog: {
    destination: "file",
    format: "JSON",
    path: "/var/log/mongodb/audit.json",
    filter: {
      // Audit only financial collections
      "atype": { "$in": ["insert", "update", "remove"] },
      "param.ns": { "$regex": "^finance\\." }
    }
  }
}
```

### Immutability Patterns

#### 1. Event Sourcing Approach
```javascript
// Immutable event document
{
  _id: ObjectId("..."),
  eventId: UUID("..."),
  eventType: "PAYMENT_PROCESSED",
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  aggregateId: "ACCOUNT-12345",
  eventData: {
    amount: NumberDecimal("100.00"),
    currency: "USD",
    paymentMethod: "CARD"
  },
  eventMetadata: {
    userId: "USER-001",
    ipAddress: "192.168.1.1",
    userAgent: "..."
  }
}

// Events are never updated, only inserted
db.events.createIndex({ "eventId": 1 }, { unique: true });
db.events.createIndex({ "aggregateId": 1, "timestamp": 1 });
```

#### 2. Audit Fields Pattern
```javascript
// Add audit fields to documents
{
  // ... document fields ...
  _audit: {
    createdAt: ISODate("2024-01-15T10:00:00Z"),
    createdBy: "USER-001",
    updatedAt: ISODate("2024-01-15T11:00:00Z"),
    updatedBy: "USER-002",
    version: 3,
    changes: [
      {
        timestamp: ISODate("2024-01-15T11:00:00Z"),
        userId: "USER-002",
        fields: ["balance"],
        previousValues: { balance: NumberDecimal("100.00") }
      }
    ]
  }
}
```

### Best Practices
- Keep audit fields immutable (no public setters)
- Use MongoDB's native auditing for compliance
- Store audit logs separately from operational data
- Implement retention policies for audit data

## Double-Entry Bookkeeping in MongoDB

### Schema Design Options

#### Option 1: Journal Entry with Embedded Lines
```javascript
{
  _id: ObjectId("..."),
  journalNumber: "JE-2024-001",
  date: ISODate("2024-01-15"),
  description: "Cash sale of merchandise",
  status: "POSTED",
  entries: [
    {
      accountCode: "1000", // Cash
      accountName: "Cash",
      debit: NumberDecimal("500.00"),
      credit: NumberDecimal("0.00")
    },
    {
      accountCode: "4000", // Revenue
      accountName: "Sales Revenue",
      debit: NumberDecimal("0.00"),
      credit: NumberDecimal("500.00")
    }
  ],
  totals: {
    debit: NumberDecimal("500.00"),
    credit: NumberDecimal("500.00")
  },
  metadata: {
    createdBy: "USER-001",
    createdAt: ISODate("2024-01-15T10:00:00Z"),
    approvedBy: "USER-002",
    approvedAt: ISODate("2024-01-15T11:00:00Z")
  }
}
```

#### Option 2: Separate Line Items Collection
```javascript
// Journal header
{
  _id: ObjectId("..."),
  journalNumber: "JE-2024-001",
  date: ISODate("2024-01-15"),
  description: "Cash sale of merchandise",
  status: "POSTED"
}

// Journal lines (separate collection)
{
  _id: ObjectId("..."),
  journalId: ObjectId("..."), // Reference to journal header
  lineNumber: 1,
  accountCode: "1000",
  accountName: "Cash",
  debit: NumberDecimal("500.00"),
  credit: NumberDecimal("0.00"),
  description: "Cash received"
}
```

#### Option 3: Signed Amount Pattern
```javascript
{
  _id: ObjectId("..."),
  journalId: "JE-2024-001",
  accountCode: "1000",
  amount: NumberDecimal("500.00"), // Positive for debit
  date: ISODate("2024-01-15"),
  description: "Cash sale"
}

{
  _id: ObjectId("..."),
  journalId: "JE-2024-001",
  accountCode: "4000",
  amount: NumberDecimal("-500.00"), // Negative for credit
  date: ISODate("2024-01-15"),
  description: "Sales revenue"
}
```

### Validation and Integrity
```javascript
// Ensure debits equal credits
db.journalEntries.aggregate([
  { $match: { journalNumber: "JE-2024-001" } },
  { $unwind: "$entries" },
  { $group: {
    _id: null,
    totalDebits: { $sum: "$entries.debit" },
    totalCredits: { $sum: "$entries.credit" }
  }},
  { $project: {
    balanced: { $eq: ["$totalDebits", "$totalCredits"] }
  }}
]);
```

## Handling Monetary Values

### Decimal128 Type
MongoDB provides the `Decimal128` BSON type specifically for financial calculations:

```javascript
// Correct: Using Decimal128 for exact precision
{
  price: NumberDecimal("19.99"),
  tax: NumberDecimal("1.80"),
  total: NumberDecimal("21.79")
}

// Incorrect: Using floating point (can cause precision errors)
{
  price: 19.99,  // This is a float - DON'T USE!
  tax: 1.80,
  total: 21.79
}
```

### Key Features of Decimal128
- **34 decimal digits of precision**
- **Exponent range**: -6143 to +6144
- **No approximation** (unlike binary floating-point)
- **Exact decimal arithmetic**

### Implementation Examples

#### Node.js
```javascript
const { Decimal128 } = require('mongodb');

// Creating decimal values
const amount = Decimal128.fromString("100.50");
const tax = Decimal128.fromString("8.50");

// Calculations must be done in application logic
const total = Decimal128.fromString("109.00");
```

#### Python
```python
from decimal import Decimal
from bson.decimal128 import Decimal128

# Python decimal for calculations
amount = Decimal("100.50")
tax = Decimal("8.50")
total = amount + tax

# Convert to Decimal128 for MongoDB
mongo_total = Decimal128(str(total))
```

#### Java
```java
import org.bson.types.Decimal128;
import java.math.BigDecimal;

// Use BigDecimal for calculations
BigDecimal amount = new BigDecimal("100.50");
BigDecimal tax = new BigDecimal("8.50");
BigDecimal total = amount.add(tax);

// Convert to Decimal128 for MongoDB
Decimal128 mongoTotal = new Decimal128(total);
```

### Alternative: Scale Factor Method (Not Recommended)
```javascript
// Store cents as integers (multiply by 100)
{
  priceInCents: 1999,  // $19.99
  taxInCents: 180,     // $1.80
  totalInCents: 2179   // $21.79
}

// Note: Decimal128 is preferred over this method
```

## Idempotency Patterns for Payments

### Why Idempotency Matters
Prevents duplicate charges when:
- Users refresh payment pages
- Network issues cause retries
- Distributed systems experience partial failures

### Implementation Strategies

#### 1. Idempotency Key Pattern
```javascript
// Payment request with idempotency key
{
  _id: ObjectId("..."),
  idempotencyKey: "PAY-2024-01-15-USER001-UNIQUE",
  amount: NumberDecimal("100.00"),
  status: "PROCESSING",
  customerId: "USER-001",
  createdAt: ISODate("2024-01-15T10:00:00Z"),
  processedAt: null,
  result: null
}

// Ensure idempotency with unique index
db.payments.createIndex({ "idempotencyKey": 1 }, { unique: true });

// Payment processing logic
async function processPayment(idempotencyKey, paymentData) {
  try {
    // Try to insert with idempotency key
    const result = await db.payments.insertOne({
      idempotencyKey,
      ...paymentData,
      status: "PROCESSING",
      createdAt: new Date()
    });
    
    // Process payment if insert succeeded
    const paymentResult = await paymentGateway.charge(paymentData);
    
    // Update with result
    await db.payments.updateOne(
      { idempotencyKey },
      { 
        $set: { 
          status: "COMPLETED",
          processedAt: new Date(),
          result: paymentResult
        }
      }
    );
    
    return paymentResult;
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      // Payment already exists, return existing result
      const existing = await db.payments.findOne({ idempotencyKey });
      return existing.result;
    }
    throw error;
  }
}
```

#### 2. Transaction State Machine
```javascript
// Payment state transitions
const PaymentStates = {
  CREATED: "CREATED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED"
};

// State transition rules
const validTransitions = {
  CREATED: ["PROCESSING"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: ["REFUNDED"],
  FAILED: ["PROCESSING"], // Allow retry
  REFUNDED: [] // Terminal state
};

// Atomic state transition
async function transitionPaymentState(paymentId, fromState, toState) {
  const result = await db.payments.findOneAndUpdate(
    { 
      _id: paymentId,
      status: fromState // Only update if in expected state
    },
    {
      $set: { 
        status: toState,
        [`stateHistory.${Date.now()}`]: {
          from: fromState,
          to: toState,
          timestamp: new Date()
        }
      }
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    throw new Error('Invalid state transition');
  }
  
  return result;
}
```

## Event Sourcing Patterns

### Core Concepts
Event sourcing stores all changes as a sequence of immutable events, enabling:
- Complete audit trail
- Temporal queries
- State reconstruction at any point in time

### Implementation Example

#### Event Store Schema
```javascript
// Event document structure
{
  _id: ObjectId("..."),
  eventId: UUID("..."),
  aggregateId: "ACCOUNT-12345",
  aggregateType: "BankAccount",
  eventType: "MoneyDeposited",
  eventVersion: 1,
  eventData: {
    amount: NumberDecimal("500.00"),
    currency: "USD",
    reference: "DEP-2024-001"
  },
  eventMetadata: {
    userId: "USER-001",
    timestamp: ISODate("2024-01-15T10:00:00Z"),
    correlationId: UUID("..."),
    causationId: UUID("...")
  }
}

// Indexes for efficient querying
db.events.createIndex({ "aggregateId": 1, "eventVersion": 1 });
db.events.createIndex({ "eventType": 1, "eventMetadata.timestamp": 1 });
db.events.createIndex({ "eventId": 1 }, { unique: true });
```

#### Aggregate Reconstruction
```javascript
async function reconstructAccount(accountId, toVersion = null) {
  const query = { aggregateId: accountId };
  if (toVersion) {
    query.eventVersion = { $lte: toVersion };
  }
  
  const events = await db.events
    .find(query)
    .sort({ eventVersion: 1 })
    .toArray();
  
  // Apply events to build current state
  let account = {
    id: accountId,
    balance: NumberDecimal("0.00"),
    transactions: []
  };
  
  for (const event of events) {
    switch (event.eventType) {
      case 'AccountOpened':
        account.openedAt = event.eventMetadata.timestamp;
        account.customerId = event.eventData.customerId;
        break;
        
      case 'MoneyDeposited':
        account.balance = account.balance.add(event.eventData.amount);
        account.transactions.push({
          type: 'DEPOSIT',
          amount: event.eventData.amount,
          timestamp: event.eventMetadata.timestamp
        });
        break;
        
      case 'MoneyWithdrawn':
        account.balance = account.balance.subtract(event.eventData.amount);
        account.transactions.push({
          type: 'WITHDRAWAL',
          amount: event.eventData.amount,
          timestamp: event.eventMetadata.timestamp
        });
        break;
    }
  }
  
  return account;
}
```

#### Snapshot Pattern
```javascript
// Store periodic snapshots for performance
{
  _id: ObjectId("..."),
  aggregateId: "ACCOUNT-12345",
  version: 100,
  timestamp: ISODate("2024-01-15T00:00:00Z"),
  state: {
    balance: NumberDecimal("1500.00"),
    customerId: "CUST-001",
    openedAt: ISODate("2023-01-01"),
    lastTransaction: ISODate("2024-01-14")
  }
}

// Reconstruct from latest snapshot
async function reconstructWithSnapshot(accountId) {
  // Find latest snapshot
  const snapshot = await db.snapshots
    .findOne({ aggregateId: accountId })
    .sort({ version: -1 });
  
  // Get events after snapshot
  const events = await db.events
    .find({ 
      aggregateId: accountId,
      eventVersion: { $gt: snapshot?.version || 0 }
    })
    .sort({ eventVersion: 1 })
    .toArray();
  
  // Start from snapshot state or empty state
  let account = snapshot?.state || { balance: NumberDecimal("0.00") };
  
  // Apply remaining events
  // ... event application logic ...
  
  return account;
}
```

## Optimistic vs Pessimistic Locking

### Optimistic Locking

MongoDB uses optimistic concurrency control by default with WiredTiger storage engine.

#### Version-Based Optimistic Locking
```javascript
// Document with version field
{
  _id: ObjectId("..."),
  accountNumber: "12345",
  balance: NumberDecimal("1000.00"),
  version: 1
}

// Update with version check
async function updateBalanceOptimistic(accountId, amount, expectedVersion) {
  const result = await db.accounts.findOneAndUpdate(
    { 
      _id: accountId,
      version: expectedVersion  // Only update if version matches
    },
    {
      $inc: { 
        balance: amount,
        version: 1  // Increment version
      }
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    throw new Error('Optimistic lock failure - version mismatch');
  }
  
  return result;
}

// Retry logic for optimistic locking failures
async function updateWithRetry(accountId, amount, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const account = await db.accounts.findOne({ _id: accountId });
      return await updateBalanceOptimistic(
        accountId, 
        amount, 
        account.version
      );
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
}
```

#### Timestamp-Based Optimistic Locking
```javascript
// Using timestamp for optimistic locking
{
  _id: ObjectId("..."),
  data: "...",
  lastModified: ISODate("2024-01-15T10:00:00Z")
}

async function updateWithTimestamp(id, newData, lastKnownTimestamp) {
  const now = new Date();
  const result = await db.collection.findOneAndUpdate(
    { 
      _id: id,
      lastModified: lastKnownTimestamp
    },
    {
      $set: { 
        data: newData,
        lastModified: now
      }
    }
  );
  
  if (!result) {
    throw new Error('Document was modified by another process');
  }
  
  return result;
}
```

### Pessimistic Locking

MongoDB doesn't have built-in row-level locks, but you can implement pessimistic locking patterns:

#### 1. Document-Level Lock Pattern
```javascript
// Lock document structure
{
  _id: ObjectId("..."),
  resourceId: "ACCOUNT-12345",
  lockedBy: "PROCESS-001",
  lockedAt: ISODate("2024-01-15T10:00:00Z"),
  expiresAt: ISODate("2024-01-15T10:05:00Z") // 5-minute timeout
}

// Acquire lock
async function acquireLock(resourceId, processId, timeoutMs = 300000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + timeoutMs);
  
  try {
    await db.locks.insertOne({
      resourceId,
      lockedBy: processId,
      lockedAt: now,
      expiresAt
    });
    return true;
  } catch (error) {
    if (error.code === 11000) { // Duplicate key
      // Check if existing lock is expired
      const existingLock = await db.locks.findOne({ resourceId });
      if (existingLock && existingLock.expiresAt < now) {
        // Remove expired lock and retry
        await db.locks.deleteOne({ resourceId, expiresAt: { $lt: now } });
        return acquireLock(resourceId, processId, timeoutMs);
      }
      return false;
    }
    throw error;
  }
}

// Release lock
async function releaseLock(resourceId, processId) {
  const result = await db.locks.deleteOne({
    resourceId,
    lockedBy: processId
  });
  return result.deletedCount > 0;
}

// Use lock in transaction
async function updateWithPessimisticLock(accountId, updateFn) {
  const processId = `PROCESS-${process.pid}-${Date.now()}`;
  
  try {
    // Acquire lock
    const locked = await acquireLock(accountId, processId);
    if (!locked) {
      throw new Error('Could not acquire lock');
    }
    
    // Perform update
    const result = await updateFn();
    
    return result;
  } finally {
    // Always release lock
    await releaseLock(accountId, processId);
  }
}
```

#### 2. Intent Locks with Transactions
```javascript
// MongoDB 4.0+ supports intent locks in transactions
async function transferWithIntentLocks(fromAccount, toAccount, amount) {
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Intent locks are automatically acquired
      const from = await db.accounts.findOneAndUpdate(
        { _id: fromAccount },
        { $inc: { balance: -amount } },
        { session, returnDocument: 'after' }
      );
      
      if (from.balance < 0) {
        throw new Error('Insufficient funds');
      }
      
      await db.accounts.updateOne(
        { _id: toAccount },
        { $inc: { balance: amount } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}
```

### Comparison and Best Practices

| Aspect | Optimistic Locking | Pessimistic Locking |
|--------|-------------------|-------------------|
| **Performance** | Better for read-heavy workloads | Better for write-heavy workloads |
| **Concurrency** | High concurrency | Lower concurrency |
| **Deadlock Risk** | No deadlocks | Potential deadlocks |
| **Use Cases** | Most financial reads, low contention updates | High contention updates, critical sections |

**Best Practices:**
1. Use optimistic locking by default
2. Implement retry logic for optimistic failures
3. Use pessimistic locking only for critical sections with high contention
4. Always set timeouts for pessimistic locks
5. Monitor lock contention and adjust strategies accordingly

## Multi-Document Transactions

### Transaction Lifecycle
```javascript
// Basic transaction structure
async function performTransaction() {
  const session = client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // All operations here are part of the transaction
      const accounts = db.collection('accounts');
      const transactions = db.collection('transactions');
      
      // Debit source account
      await accounts.updateOne(
        { _id: 'ACC001' },
        { $inc: { balance: -100 } },
        { session }
      );
      
      // Credit destination account
      await accounts.updateOne(
        { _id: 'ACC002' },
        { $inc: { balance: 100 } },
        { session }
      );
      
      // Record transaction
      await transactions.insertOne({
        from: 'ACC001',
        to: 'ACC002',
        amount: 100,
        timestamp: new Date()
      }, { session });
      
    }, {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true }
    });
    
    console.log('Transaction committed successfully');
  } catch (error) {
    console.error('Transaction aborted:', error);
    throw error;
  } finally {
    await session.endSession();
  }
}
```

### Transaction Options

#### Read Concern Levels
```javascript
// Majority read concern - most common for financial data
{ readConcern: { level: "majority" } }

// Snapshot read concern - for consistent reads across shards
{ readConcern: { level: "snapshot" } }

// Local read concern - faster but may read uncommitted data
{ readConcern: { level: "local" } }
```

#### Write Concern Options
```javascript
// Majority write concern with journal
{ writeConcern: { w: "majority", j: true } }

// Write to specific number of replicas
{ writeConcern: { w: 3, j: true, wtimeout: 5000 } }
```

### Best Practices for Financial Transactions

#### 1. Batch Processing Pattern
```javascript
async function batchProcessPayments(paymentBatch) {
  const session = client.startSession();
  const batchSize = 100; // Process 100 payments per transaction
  
  for (let i = 0; i < paymentBatch.length; i += batchSize) {
    const batch = paymentBatch.slice(i, i + batchSize);
    
    await session.withTransaction(async () => {
      for (const payment of batch) {
        await processPayment(payment, session);
      }
    });
  }
  
  await session.endSession();
}
```

#### 2. Compensation Pattern
```javascript
async function transferWithCompensation(fromAccount, toAccount, amount) {
  const session = client.startSession();
  const transferId = new ObjectId();
  
  try {
    await session.withTransaction(async () => {
      // Record intent
      await db.transfers.insertOne({
        _id: transferId,
        from: fromAccount,
        to: toAccount,
        amount,
        status: 'PENDING',
        createdAt: new Date()
      }, { session });
      
      // Perform transfer
      await db.accounts.updateOne(
        { _id: fromAccount, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session }
      );
      
      await db.accounts.updateOne(
        { _id: toAccount },
        { $inc: { balance: amount } },
        { session }
      );
      
      // Mark complete
      await db.transfers.updateOne(
        { _id: transferId },
        { $set: { status: 'COMPLETED', completedAt: new Date() } },
        { session }
      );
    });
  } catch (error) {
    // Compensation logic
    await compensateTransfer(transferId);
    throw error;
  } finally {
    await session.endSession();
  }
}
```

#### 3. Distributed Transaction Pattern
```javascript
// For cross-database transactions
async function crossDatabaseTransaction() {
  const session = client.startSession();
  
  await session.withTransaction(async () => {
    // Update in database 1
    const db1 = client.db('payments');
    await db1.collection('transactions').insertOne({
      /* payment data */
    }, { session });
    
    // Update in database 2
    const db2 = client.db('accounting');
    await db2.collection('ledger').insertOne({
      /* ledger entry */
    }, { session });
    
    // Both operations commit or rollback together
  });
  
  await session.endSession();
}
```

### Performance Considerations

1. **Transaction Duration**: Keep under 60 seconds
2. **Document Count**: Limit to 1,000 documents per transaction
3. **Oplog Size**: Stay under 16MB total
4. **Network Latency**: Minimize round trips
5. **Index Usage**: Ensure proper indexes for transaction queries

## Financial Compliance Requirements

### PCI-DSS Compliance

MongoDB Atlas achieved **PCI DSS 4.0 certification** (as of January 2025), making it suitable for storing, processing, and transmitting cardholder data.

#### Key PCI-DSS Features in MongoDB

1. **Encryption**
```javascript
// Client-side field level encryption
const encryption = new ClientEncryption(client, {
  keyVaultNamespace: 'encryption.__keyVault',
  kmsProviders: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
});

// Encrypt sensitive fields before storing
const encryptedCard = await encryption.encrypt(
  cardNumber,
  {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
    keyId: dataKeyId
  }
);
```

2. **Network Security**
```javascript
// TLS 1.2+ configuration
const client = new MongoClient(uri, {
  tls: true,
  tlsMinVersion: 'TLSv1.2',
  tlsCertificateKeyFile: '/path/to/client.pem',
  tlsCAFile: '/path/to/ca.pem'
});
```

3. **Access Control**
```javascript
// Role-based access control
db.createRole({
  role: "paymentProcessor",
  privileges: [
    {
      resource: { db: "payments", collection: "transactions" },
      actions: ["find", "insert"]
    },
    {
      resource: { db: "payments", collection: "cards" },
      actions: ["find"]
    }
  ],
  roles: []
});
```

### Audit Requirements

#### 1. Comprehensive Audit Configuration
```javascript
// MongoDB Enterprise audit configuration
{
  auditLog: {
    destination: "file",
    format: "JSON",
    path: "/secure/audit/mongodb-audit.json",
    filter: {
      $or: [
        { "atype": "authenticate" },
        { "atype": { $in: ["insert", "update", "remove"] },
          "param.ns": /^payments\./ },
        { "atype": "createCollection",
          "param.ns": /^payments\./ }
      ]
    }
  },
  setParameter: {
    auditAuthorizationSuccess: true
  }
}
```

#### 2. Audit Log Analysis
```javascript
// Parse and analyze audit logs
const auditEntry = {
  atype: "authenticate",
  ts: { "$date": "2024-01-15T10:30:00.000Z" },
  local: { ip: "127.0.0.1", port: 27017 },
  remote: { ip: "192.168.1.100", port: 54321 },
  users: [{ user: "paymentApp", db: "payments" }],
  roles: [{ role: "paymentProcessor", db: "payments" }],
  result: 0 // 0 = success
};

// Query audit logs for suspicious activity
db.auditLog.aggregate([
  { $match: {
    atype: "authenticate",
    result: { $ne: 0 }, // Failed attempts
    "ts": { $gte: new Date(Date.now() - 24*60*60*1000) }
  }},
  { $group: {
    _id: "$remote.ip",
    failedAttempts: { $sum: 1 }
  }},
  { $match: { failedAttempts: { $gt: 5 } }}
]);
```

### Data Retention and Privacy

#### 1. TTL Indexes for Automatic Data Expiration
```javascript
// Automatically delete old audit logs after 90 days
db.auditLogs.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);

// PII data retention (GDPR compliance)
db.customerData.createIndex(
  { "lastActive": 1 },
  { 
    expireAfterSeconds: 63072000, // 2 years
    partialFilterExpression: { "retentionRequired": false }
  }
);
```

#### 2. Data Masking for Non-Production
```javascript
// Aggregation pipeline for data masking
db.customers.aggregate([
  {
    $project: {
      customerId: 1,
      // Mask email
      email: {
        $concat: [
          { $substr: ["$email", 0, 3] },
          "****",
          { $substr: ["$email", { $indexOfCP: ["$email", "@"] }, -1] }
        ]
      },
      // Mask credit card
      cardNumber: {
        $concat: [
          { $substr: ["$cardNumber", 0, 4] },
          "********",
          { $substr: ["$cardNumber", -4, 4] }
        ]
      }
    }
  },
  { $out: "customers_masked" }
]);
```

### Compliance Checklist

1. **Encryption**
   - ✓ Encryption at rest (WiredTiger encryption)
   - ✓ Encryption in transit (TLS 1.2+)
   - ✓ Client-side field level encryption for sensitive data

2. **Access Control**
   - ✓ Role-based access control (RBAC)
   - ✓ Authentication mechanisms (SCRAM, x.509, LDAP)
   - ✓ IP whitelisting and VPC peering

3. **Auditing**
   - ✓ Comprehensive audit logging
   - ✓ Log analysis and monitoring
   - ✓ Retention policies

4. **Data Protection**
   - ✓ Backup and recovery procedures
   - ✓ Data masking for non-production
   - ✓ Secure key management

5. **Network Security**
   - ✓ Private endpoints
   - ✓ Network isolation
   - ✓ Firewall rules

### Compliance Resources

- MongoDB Atlas AOC (Attestation of Compliance) available on request
- SOC 2 Type II certification
- ISO 27001, ISO 27017, ISO 27018 certifications
- HIPAA compliance guidelines available

## Summary

MongoDB provides a comprehensive set of features for building financial services applications:

1. **ACID transactions** ensure data consistency across multiple documents
2. **Decimal128** type provides exact precision for monetary calculations
3. **Flexible document model** supports various financial data patterns
4. **Event sourcing** capabilities enable complete audit trails
5. **Optimistic and pessimistic locking** patterns handle concurrent access
6. **PCI-DSS compliance** features support regulatory requirements

When building financial applications with MongoDB:
- Design for your access patterns
- Use appropriate consistency guarantees
- Implement proper error handling and retry logic
- Monitor performance and optimize queries
- Maintain comprehensive audit trails
- Follow security best practices

MongoDB's combination of flexibility, scalability, and ACID compliance makes it a strong choice for modern financial services applications, from payment processing to banking systems and trading platforms.