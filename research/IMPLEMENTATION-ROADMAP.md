# MongoDB Schema Implementation Roadmap

## Overview

This roadmap provides a concrete implementation plan based on the comprehensive research conducted on MongoDB patterns for financial services, e-commerce, and registration systems.

## Current State Analysis

Based on the existing codebase analysis:
- **Current Collections**: registrations, eventTickets, square_transactions, invoices
- **Pain Points**: Inconsistent schemas, manual reconciliation, no unified order model
- **Opportunities**: Implement superordinate order pattern, improve financial tracking, add audit trails

## Implementation Phases

### Phase 0: Preparation & Planning (Week 0)

#### Tasks:
1. **Environment Setup**
   ```javascript
   // Create development environment with replica set for transactions
   // MongoDB 5.0+ required for latest transaction features
   ```

2. **Create Migration Framework**
   ```javascript
   // migrations/framework.js
   class Migration {
     async up() { /* forward migration */ }
     async down() { /* rollback */ }
     async verify() { /* data integrity check */ }
   }
   ```

3. **Establish Testing Strategy**
   - Unit tests for schema validators
   - Integration tests for transactions
   - Performance benchmarks baseline

### Phase 1: Financial Foundation (Weeks 1-2)

#### 1.1 Implement Decimal128 for Money

**Migration Script**:
```javascript
// migrations/001-decimal128-conversion.js
async function up(db) {
  // Convert all monetary fields to Decimal128
  const updates = await db.collection('registrations').aggregate([
    { $match: { 'paymentDetails.amount': { $type: 'double' } } },
    { $project: { 
      _id: 1, 
      newAmount: { $toDecimal: '$paymentDetails.amount' } 
    }}
  ]).toArray();
  
  // Bulk update with progress tracking
  const bulk = db.collection('registrations').initializeUnorderedBulkOp();
  updates.forEach(doc => {
    bulk.find({ _id: doc._id }).updateOne({
      $set: { 'paymentDetails.amount': doc.newAmount }
    });
  });
  await bulk.execute();
}
```

#### 1.2 Create Financial Ledger

**Schema**:
```javascript
// schemas/financial-ledger.js
const ledgerEntrySchema = {
  _id: ObjectId,
  entryId: String, // "led_2025_001234"
  timestamp: Date,
  type: String, // "payment", "refund", "adjustment"
  
  // Double-entry bookkeeping
  entries: [{
    account: String, // "revenue", "receivable", "cash"
    debit: Decimal128,
    credit: Decimal128,
    description: String
  }],
  
  // Reference
  orderId: ObjectId,
  orderType: String,
  
  // Audit
  createdBy: String,
  metadata: Object,
  
  // Idempotency
  idempotencyKey: String, // unique index
  
  // Immutability
  isReversed: Boolean,
  reversalId: ObjectId
}
```

#### 1.3 Implement Idempotency

**Implementation**:
```javascript
// services/idempotency.js
class IdempotencyService {
  async executeOnce(key, operation, ttl = 86400) {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Check if operation already executed
        const existing = await db.idempotencyKeys.findOne({ 
          key, 
          expiresAt: { $gt: new Date() } 
        });
        
        if (existing) {
          return existing.result;
        }
        
        // Execute operation
        const result = await operation(session);
        
        // Store result
        await db.idempotencyKeys.insertOne({
          key,
          result,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000)
        }, { session });
        
        return result;
      });
    } finally {
      await session.endSession();
    }
  }
}
```

### Phase 2: Superordinate Order Schema (Weeks 3-4)

#### 2.1 Create Base Order Collection

**Schema Implementation**:
```javascript
// schemas/orders.js
const orderSchema = new Schema({
  // Identity
  _id: ObjectId,
  orderNumber: { 
    type: String, 
    unique: true,
    required: true 
  },
  orderType: {
    type: String,
    enum: ['registration', 'sponsorship', 'pos', 'merchandise'],
    required: true
  },
  
  // Customer snapshot
  customer: {
    id: ObjectId,
    email: String,
    name: String,
    // Snapshot at order time
    snapshotData: Object
  },
  
  // Financial
  financial: {
    currency: { type: String, default: 'USD' },
    subtotal: Decimal128,
    tax: Decimal128,
    discount: Decimal128,
    total: Decimal128,
    paid: Decimal128,
    balance: Decimal128
  },
  
  // Status with history
  status: {
    current: String,
    history: [{
      status: String,
      timestamp: Date,
      actor: String,
      reason: String
    }]
  },
  
  // Type-specific data
  typeSpecificData: Schema.Types.Mixed,
  
  // Common fields
  items: [orderItemSchema],
  metadata: Object,
  tags: [String],
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}, {
  discriminatorKey: 'orderType',
  collection: 'orders'
});

// Add indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'customer.id': 1, createdAt: -1 });
orderSchema.index({ orderType: 1, 'status.current': 1 });
orderSchema.index({ tags: 1 });
```

#### 2.2 Implement Order Type Discriminators

**Registration Orders**:
```javascript
// schemas/orders/registration.js
const RegistrationOrder = Order.discriminator('registration', 
  new Schema({
    typeSpecificData: {
      eventId: ObjectId,
      eventName: String,
      tickets: [{
        ticketId: ObjectId,
        name: String,
        price: Decimal128,
        attendee: {
          name: String,
          email: String,
          customFields: Object
        }
      }],
      lodgeId: ObjectId,
      lodgeName: String
    }
  })
);
```

#### 2.3 Create Order Service

**Service Layer**:
```javascript
// services/orders/order-service.js
class OrderService {
  async createOrder(orderData, session) {
    // Generate order number
    const orderNumber = await this.generateOrderNumber(orderData.orderType);
    
    // Calculate financials
    const financial = await this.calculateFinancials(orderData);
    
    // Create order with transaction
    const order = await Order.create([{
      ...orderData,
      orderNumber,
      financial,
      status: {
        current: 'draft',
        history: [{
          status: 'draft',
          timestamp: new Date(),
          actor: orderData.createdBy
        }]
      }
    }], { session });
    
    // Create audit entry
    await this.auditService.log('order.created', order[0], session);
    
    // Emit event
    await this.eventBus.emit('order.created', order[0]);
    
    return order[0];
  }
  
  async transitionStatus(orderId, newStatus, actor, session) {
    // Validate transition
    const order = await Order.findById(orderId).session(session);
    const validTransition = this.validateTransition(
      order.status.current, 
      newStatus
    );
    
    if (!validTransition) {
      throw new Error(`Invalid transition: ${order.status.current} -> ${newStatus}`);
    }
    
    // Update with history
    return Order.findByIdAndUpdate(
      orderId,
      {
        $set: { 'status.current': newStatus },
        $push: { 
          'status.history': {
            status: newStatus,
            timestamp: new Date(),
            actor,
            previousStatus: order.status.current
          }
        }
      },
      { new: true, session }
    );
  }
}
```

### Phase 3: Data Migration (Weeks 5-6)

#### 3.1 Migrate Existing Registrations

**Migration Strategy**:
```javascript
// migrations/002-registrations-to-orders.js
async function migrateRegistrations() {
  const batchSize = 1000;
  let processed = 0;
  
  const cursor = db.registrations.find({}).batchSize(batchSize);
  
  while (await cursor.hasNext()) {
    const batch = [];
    
    for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
      const reg = await cursor.next();
      
      // Transform to order format
      const order = {
        _id: new ObjectId(),
        orderNumber: `REG-LEGACY-${reg._id}`,
        orderType: 'registration',
        
        customer: {
          id: reg.userId,
          email: reg.contactDetails?.email,
          name: reg.contactDetails?.name,
          snapshotData: reg.contactDetails
        },
        
        financial: {
          currency: 'USD',
          total: Decimal128(reg.paymentDetails?.amount || '0'),
          paid: Decimal128(reg.paymentDetails?.paid || '0'),
          balance: Decimal128(
            (reg.paymentDetails?.amount || 0) - 
            (reg.paymentDetails?.paid || 0)
          )
        },
        
        status: {
          current: mapRegistrationStatus(reg.status),
          history: reg.statusHistory || []
        },
        
        typeSpecificData: {
          eventId: reg.eventId,
          tickets: reg.registrationData?.tickets || [],
          lodgeId: reg.lodgeId
        },
        
        // Preserve original data
        legacyId: reg._id,
        legacyData: reg,
        
        createdAt: reg.createdAt || reg._id.getTimestamp(),
        updatedAt: reg.updatedAt || new Date()
      };
      
      batch.push(order);
    }
    
    // Bulk insert
    if (batch.length > 0) {
      await db.orders.insertMany(batch, { ordered: false });
      processed += batch.length;
      console.log(`Migrated ${processed} registrations`);
    }
  }
}
```

#### 3.2 Create Reconciliation Views

**Materialized Views**:
```javascript
// Create reconciliation view
db.createView('order_reconciliation', 'orders', [
  {
    $lookup: {
      from: 'square_transactions',
      localField: 'financial.transactionIds',
      foreignField: '_id',
      as: 'transactions'
    }
  },
  {
    $project: {
      orderNumber: 1,
      orderType: 1,
      'customer.email': 1,
      'financial.total': 1,
      'financial.paid': 1,
      'financial.balance': 1,
      transactionCount: { $size: '$transactions' },
      hasDiscrepancy: {
        $ne: ['$financial.balance', Decimal128('0')]
      }
    }
  }
]);
```

### Phase 4: Integration & Optimization (Weeks 7-8)

#### 4.1 Payment Integration

**Payment Processor Integration**:
```javascript
// services/payments/payment-processor.js
class PaymentProcessor {
  async processPayment(order, paymentMethod, idempotencyKey) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Check idempotency
        const existing = await this.idempotencyService.get(idempotencyKey);
        if (existing) return existing;
        
        // Process with provider (Stripe/Square)
        const paymentResult = await this.provider.charge({
          amount: order.financial.balance,
          currency: order.financial.currency,
          customer: order.customer.providerId,
          metadata: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber
          },
          idempotencyKey
        });
        
        // Update order
        await Order.findByIdAndUpdate(
          order._id,
          {
            $push: { 
              'financial.transactions': {
                id: paymentResult.id,
                amount: paymentResult.amount,
                status: paymentResult.status,
                provider: this.provider.name,
                timestamp: new Date()
              }
            },
            $inc: {
              'financial.paid': paymentResult.amount
            },
            $set: {
              'financial.balance': order.financial.total - 
                (order.financial.paid + paymentResult.amount)
            }
          },
          { session }
        );
        
        // Create ledger entry
        await this.createLedgerEntry(order, paymentResult, session);
        
        // Store idempotency result
        await this.idempotencyService.store(
          idempotencyKey, 
          paymentResult,
          session
        );
        
        return paymentResult;
      });
    } finally {
      await session.endSession();
    }
  }
}
```

#### 4.2 Performance Optimization

**Indexing Strategy**:
```javascript
// Analyze query patterns and create indexes
async function optimizeIndexes() {
  // Remove unused indexes
  const indexStats = await db.orders.aggregate([
    { $indexStats: {} }
  ]).toArray();
  
  // Create new compound indexes
  await db.orders.createIndex(
    { orderType: 1, 'status.current': 1, createdAt: -1 },
    { name: 'type_status_date' }
  );
  
  // Partial index for active orders
  await db.orders.createIndex(
    { 'financial.balance': 1 },
    { 
      partialFilterExpression: { 
        'financial.balance': { $gt: Decimal128('0') } 
      },
      name: 'unpaid_orders'
    }
  );
  
  // Text index for search
  await db.orders.createIndex({
    orderNumber: 'text',
    'customer.email': 'text',
    'customer.name': 'text',
    tags: 'text'
  });
}
```

### Phase 5: Monitoring & Maintenance

#### 5.1 Setup Change Streams

```javascript
// services/monitoring/change-streams.js
class OrderChangeStream {
  async initialize() {
    const pipeline = [
      { $match: { 
        operationType: { $in: ['insert', 'update'] },
        'fullDocument.orderType': { $exists: true }
      }}
    ];
    
    const changeStream = db.orders.watch(pipeline, {
      fullDocument: 'updateLookup'
    });
    
    changeStream.on('change', async (change) => {
      // Process changes
      await this.processChange(change);
      
      // Update metrics
      await this.updateMetrics(change);
      
      // Trigger webhooks
      await this.triggerWebhooks(change);
    });
  }
}
```

#### 5.2 Create Monitoring Dashboard

```javascript
// Metrics to track
const metrics = {
  orderVolume: {
    total: await db.orders.countDocuments(),
    byType: await db.orders.aggregate([
      { $group: { _id: '$orderType', count: { $sum: 1 } } }
    ]),
    byStatus: await db.orders.aggregate([
      { $group: { _id: '$status.current', count: { $sum: 1 } } }
    ])
  },
  
  financial: {
    totalRevenue: await db.orders.aggregate([
      { $group: { _id: null, total: { $sum: '$financial.total' } } }
    ]),
    outstandingBalance: await db.orders.aggregate([
      { $match: { 'financial.balance': { $gt: Decimal128('0') } } },
      { $group: { _id: null, total: { $sum: '$financial.balance' } } }
    ])
  },
  
  performance: {
    avgQueryTime: await db.orders.explain('executionStats'),
    indexEfficiency: await db.orders.aggregate([{ $indexStats: {} }])
  }
};
```

## Success Metrics

### Technical Metrics
- Query performance < 100ms for 95th percentile
- Transaction success rate > 99.9%
- Zero financial discrepancies
- 100% audit trail coverage

### Business Metrics
- Reduced manual reconciliation by 90%
- Unified reporting across all order types
- Real-time financial visibility
- Improved checkout conversion

## Risk Mitigation

1. **Data Loss Prevention**
   - Full backup before migration
   - Incremental migration approach
   - Rollback procedures for each phase

2. **Performance Degradation**
   - Load testing before production
   - Gradual rollout with monitoring
   - Index optimization based on real usage

3. **Business Continuity**
   - Parallel run of old and new systems
   - Feature flags for gradual adoption
   - Comprehensive logging and monitoring

## Timeline Summary

- **Week 0**: Planning and environment setup
- **Weeks 1-2**: Financial foundation (Decimal128, ledger, idempotency)
- **Weeks 3-4**: Superordinate order schema implementation
- **Weeks 5-6**: Data migration and reconciliation
- **Weeks 7-8**: Integration, optimization, and monitoring

## Next Actions

1. Review and approve implementation plan
2. Set up development environment with replica set
3. Create proof-of-concept for order schema
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews

This roadmap provides a systematic approach to implementing a robust, scalable MongoDB schema based on industry best practices while addressing your specific business requirements.