# Stripe API Schema Design Patterns Analysis

## Table of Contents
1. [Object Model Hierarchy](#object-model-hierarchy)
2. [Idempotency Patterns](#idempotency-patterns)
3. [Immutability Approach](#immutability-approach)
4. [Event and Webhook Patterns](#event-and-webhook-patterns)
5. [Metadata and Extensibility](#metadata-and-extensibility)
6. [Relationship Patterns](#relationship-patterns)
7. [Status/State Machine Patterns](#statusstate-machine-patterns)
8. [Error Handling and Recovery](#error-handling-and-recovery)
9. [Audit and Compliance](#audit-and-compliance)
10. [Expansion and Includes Patterns](#expansion-and-includes-patterns)
11. [MongoDB Implementation Insights](#mongodb-implementation-insights)

## 1. Object Model Hierarchy

### Stripe's Hierarchical Structure

Stripe's API follows a clear hierarchical pattern:

```
Customer (top level)
├── PaymentIntent (transaction orchestrator)
│   ├── PaymentMethod (payment instrument)
│   └── Charge (actual payment attempt)
├── Subscription (recurring payments)
└── Invoice (billing document)
```

### Key Characteristics
- **Parent-Child Relationships**: Clear ownership hierarchy (Customer → PaymentIntent → Charge)
- **Resource Isolation**: Each object type has its own namespace and ID prefix (e.g., `cus_`, `pi_`, `ch_`)
- **Lazy Loading**: Related objects are referenced by ID, not embedded by default

### MongoDB Implementation Insights
```javascript
// Customer collection
{
  _id: "cus_123456789",
  created: ISODate("2024-01-01T00:00:00Z"),
  email: "customer@example.com",
  metadata: { /* custom fields */ }
}

// PaymentIntents collection
{
  _id: "pi_123456789",
  customer: "cus_123456789", // Reference to customer
  amount: 5000,
  currency: "usd",
  status: "succeeded",
  charges: ["ch_123456789"], // Array of charge IDs
  created: ISODate("2024-01-01T00:00:00Z")
}

// Charges collection
{
  _id: "ch_123456789",
  payment_intent: "pi_123456789",
  customer: "cus_123456789",
  amount: 5000,
  created: ISODate("2024-01-01T00:00:00Z")
}
```

## 2. Idempotency Patterns

### Stripe's Implementation
- **Header-based**: Uses `Idempotency-Key` header for POST requests
- **24-hour retention**: Keys expire after 24 hours
- **Request fingerprinting**: Stores request/response pairs keyed by idempotency key
- **Parameter validation**: Ensures identical parameters for same key

### MongoDB Implementation Strategy

```javascript
// Idempotency collection
{
  _id: "uuid-v4-key", // The idempotency key
  request: {
    method: "POST",
    path: "/api/payments",
    body: { /* original request */ },
    headers: { /* headers */ }
  },
  response: {
    status: 200,
    body: { /* original response */ }
  },
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  expiresAt: ISODate("2024-01-02T00:00:00Z") // TTL index
}

// Implementation pattern
async function handleIdempotentRequest(key, requestHandler) {
  // Check for existing key
  const existing = await db.idempotency.findOne({ _id: key });
  if (existing) {
    return existing.response;
  }
  
  // Process new request
  const response = await requestHandler();
  
  // Store for future use
  await db.idempotency.insertOne({
    _id: key,
    request: { /* request details */ },
    response: response,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  
  return response;
}
```

## 3. Immutability Approach

### Stripe's Strategy
- **Version Pinning**: Account-level API version pinning
- **Object Preservation**: Objects maintain structure based on creation-time API version
- **No Bulk Updates**: One object per request enforces immutability
- **Event History**: Objects store their state at event creation time

### MongoDB Patterns for Immutability

```javascript
// Version-aware schema
{
  _id: "obj_123",
  api_version: "2024-01-01",
  data: { /* version-specific structure */ },
  created: ISODate("2024-01-01T00:00:00Z"),
  // Never modify, only create new versions
  versions: [
    {
      version: "2024-01-01",
      data: { /* original data */ },
      created: ISODate("2024-01-01T00:00:00Z")
    },
    {
      version: "2024-02-01",
      data: { /* updated structure */ },
      created: ISODate("2024-02-01T00:00:00Z")
    }
  ]
}

// Event sourcing for changes
{
  _id: "event_123",
  type: "customer.updated",
  data: {
    object: { /* snapshot at event time */ },
    previous_attributes: { /* what changed */ }
  },
  api_version: "2024-01-01",
  created: ISODate("2024-01-01T00:00:00Z")
}
```

## 4. Event and Webhook Patterns

### Stripe's Event Architecture
- **Asynchronous Processing**: Events created for all significant state changes
- **Thin vs Snapshot Events**: API v2 uses thin events (IDs only), v1 includes snapshots
- **Event Types**: Hierarchical naming (e.g., `payment_intent.succeeded`)
- **Webhook Delivery**: HTTPS POST with retry logic

### MongoDB Event Sourcing Implementation

```javascript
// Events collection
{
  _id: "evt_123456789",
  type: "payment_intent.succeeded",
  api_version: "2024-01-01",
  created: ISODate("2024-01-01T00:00:00Z"),
  data: {
    object: "pi_123456789", // Thin event pattern
    // OR full snapshot for v1 compatibility
    object: { /* full object snapshot */ }
  },
  livemode: true,
  pending_webhooks: 2,
  request: {
    id: "req_123",
    idempotency_key: "key_123"
  }
}

// Webhook delivery tracking
{
  _id: "webhook_delivery_123",
  event_id: "evt_123456789",
  endpoint_id: "we_123",
  url: "https://example.com/webhook",
  attempts: [
    {
      timestamp: ISODate("2024-01-01T00:00:00Z"),
      response_status: 200,
      response_time_ms: 150
    }
  ],
  status: "succeeded"
}
```

### Queue-Based Processing Pattern
```javascript
// Event queue for asynchronous processing
{
  _id: ObjectId(),
  event_id: "evt_123456789",
  type: "payment_intent.succeeded",
  status: "pending", // pending, processing, completed, failed
  attempts: 0,
  max_attempts: 3,
  next_retry: ISODate("2024-01-01T00:00:00Z"),
  created: ISODate("2024-01-01T00:00:00Z")
}
```

## 5. Metadata and Extensibility

### Stripe's Approach
- **Key-Value Storage**: Up to 50 keys, 40 char keys, 500 char values
- **String-Only Values**: All metadata stored as strings
- **No Square Brackets**: Restriction on key naming
- **Object-Specific**: Metadata doesn't cascade to related objects

### MongoDB Flexible Schema Implementation

```javascript
// Enhanced metadata pattern
{
  _id: "cus_123",
  // Core fields
  email: "customer@example.com",
  
  // Stripe-like metadata
  metadata: {
    order_id: "12345",
    customer_tier: "premium",
    source: "mobile_app"
  },
  
  // Extended data (MongoDB advantage)
  extended_metadata: {
    preferences: {
      notifications: true,
      language: "en"
    },
    custom_fields: {
      // Can store complex objects, not just strings
      address_history: [],
      risk_score: 0.15
    }
  },
  
  // Searchable metadata indexes
  metadata_search: [
    "order_id:12345",
    "customer_tier:premium"
  ]
}

// Index for metadata search
db.customers.createIndex({ "metadata_search": 1 })
```

## 6. Relationship Patterns

### Stripe's Approach
- **ID References**: Objects reference others by ID
- **Expansion Pattern**: Use `expand` parameter to include related objects
- **Lazy Loading**: Related data fetched only when needed
- **Maximum Depth**: 4 levels of expansion allowed

### MongoDB Relationship Strategies

```javascript
// 1. Reference Pattern (like Stripe)
{
  _id: "pi_123",
  customer: "cus_123", // Just the ID
  payment_method: "pm_123"
}

// 2. Denormalized Pattern (performance optimization)
{
  _id: "pi_123",
  customer: {
    id: "cus_123",
    email: "customer@example.com", // Frequently needed fields
    name: "John Doe"
  },
  payment_method: "pm_123"
}

// 3. Aggregation Pipeline for Expansion
const expandedPaymentIntent = await db.paymentIntents.aggregate([
  { $match: { _id: "pi_123" } },
  {
    $lookup: {
      from: "customers",
      localField: "customer",
      foreignField: "_id",
      as: "customer_data"
    }
  },
  {
    $lookup: {
      from: "paymentMethods",
      localField: "payment_method",
      foreignField: "_id",
      as: "payment_method_data"
    }
  },
  {
    $project: {
      _id: 1,
      amount: 1,
      customer: { $arrayElemAt: ["$customer_data", 0] },
      payment_method: { $arrayElemAt: ["$payment_method_data", 0] }
    }
  }
]);
```

## 7. Status/State Machine Patterns

### Stripe's PaymentIntent State Machine
```
requires_payment_method → requires_confirmation → requires_action → processing → succeeded
                                                                  ↓
                                                              canceled/failed
```

### MongoDB State Machine Implementation

```javascript
// State machine configuration
const PAYMENT_STATES = {
  CREATED: {
    transitions: ['REQUIRES_PAYMENT_METHOD']
  },
  REQUIRES_PAYMENT_METHOD: {
    transitions: ['REQUIRES_CONFIRMATION', 'CANCELED']
  },
  REQUIRES_CONFIRMATION: {
    transitions: ['REQUIRES_ACTION', 'PROCESSING', 'FAILED', 'CANCELED']
  },
  REQUIRES_ACTION: {
    transitions: ['PROCESSING', 'FAILED', 'CANCELED']
  },
  PROCESSING: {
    transitions: ['SUCCEEDED', 'FAILED']
  },
  SUCCEEDED: {
    transitions: [] // Terminal state
  },
  FAILED: {
    transitions: ['REQUIRES_PAYMENT_METHOD'] // Allow retry
  },
  CANCELED: {
    transitions: [] // Terminal state
  }
};

// Payment document with state
{
  _id: "pi_123",
  status: "REQUIRES_CONFIRMATION",
  status_history: [
    {
      status: "CREATED",
      timestamp: ISODate("2024-01-01T00:00:00Z"),
      metadata: {}
    },
    {
      status: "REQUIRES_PAYMENT_METHOD",
      timestamp: ISODate("2024-01-01T00:00:01Z"),
      metadata: { payment_method: "pm_123" }
    }
  ],
  next_action: {
    type: "confirm_payment",
    confirm_url: "https://..."
  }
}

// State transition function
async function transitionState(paymentId, newStatus, metadata = {}) {
  const payment = await db.payments.findOne({ _id: paymentId });
  const currentState = PAYMENT_STATES[payment.status];
  
  if (!currentState.transitions.includes(newStatus)) {
    throw new Error(`Invalid transition from ${payment.status} to ${newStatus}`);
  }
  
  await db.payments.updateOne(
    { _id: paymentId },
    {
      $set: { status: newStatus },
      $push: {
        status_history: {
          status: newStatus,
          timestamp: new Date(),
          metadata
        }
      }
    }
  );
}
```

## 8. Error Handling and Recovery

### Stripe's Error Categories
- **Content Errors (4xx)**: Invalid requests
- **Server Errors (5xx)**: Stripe server issues
- **Network Errors**: Connectivity problems
- **Payment Errors**: Declines, fraud blocks

### MongoDB Error Handling Patterns

```javascript
// Error tracking collection
{
  _id: ObjectId(),
  request_id: "req_123",
  error_type: "payment_declined",
  error_code: "card_declined",
  decline_code: "insufficient_funds",
  timestamp: ISODate("2024-01-01T00:00:00Z"),
  context: {
    payment_intent: "pi_123",
    amount: 5000,
    customer: "cus_123"
  },
  recovery_attempts: [
    {
      timestamp: ISODate("2024-01-01T00:01:00Z"),
      action: "retry_with_different_payment_method",
      result: "succeeded"
    }
  ]
}

// Retry strategy with exponential backoff
class RetryManager {
  async executeWithRetry(operation, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelay = options.baseDelay || 1000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts || !this.isRetryable(error)) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  isRetryable(error) {
    return error.type === 'network_error' || 
           error.code === 'rate_limit_error' ||
           (error.statusCode >= 500 && error.statusCode < 600);
  }
}
```

## 9. Audit and Compliance

### Stripe's Approach
- **PCI Level 1 Compliance**: Highest level certification
- **Audit Logs**: Track all sensitive operations
- **Encryption**: AES-256 for data at rest
- **Access Control**: Role-based permissions

### MongoDB Audit Implementation

```javascript
// Audit log collection
{
  _id: ObjectId(),
  timestamp: ISODate("2024-01-01T00:00:00Z"),
  user_id: "user_123",
  action: "payment.create",
  resource_type: "payment_intent",
  resource_id: "pi_123",
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0...",
  request: {
    method: "POST",
    path: "/api/payment_intents",
    body: { /* sanitized request body */ }
  },
  response: {
    status: 200,
    duration_ms: 150
  },
  changes: {
    before: null,
    after: { /* new object state */ }
  },
  compliance_flags: {
    pci_relevant: true,
    contains_pii: true
  }
}

// Indexes for compliance queries
db.audit_logs.createIndex({ timestamp: -1 });
db.audit_logs.createIndex({ user_id: 1, timestamp: -1 });
db.audit_logs.createIndex({ "compliance_flags.pci_relevant": 1 });

// TTL index for retention policy (1 year for PCI)
db.audit_logs.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);
```

## 10. Expansion and Includes Patterns

### Stripe's Expansion Features
- **Dot Notation**: `expand[]=customer.default_source`
- **Multiple Expansions**: Array of paths
- **Performance Limits**: 4 levels maximum depth
- **List Expansions**: `data.customer` for list endpoints

### MongoDB Aggregation for Expansion

```javascript
// Expansion utility class
class ExpansionBuilder {
  constructor(collection) {
    this.collection = collection;
    this.pipeline = [];
  }
  
  expand(path, maxDepth = 4) {
    const parts = path.split('.');
    if (parts.length > maxDepth) {
      throw new Error(`Expansion depth exceeds maximum of ${maxDepth}`);
    }
    
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}.${part}` : part;
      
      this.pipeline.push({
        $lookup: {
          from: this.getCollectionForField(part),
          localField: currentPath,
          foreignField: '_id',
          as: `${currentPath}_expanded`
        }
      });
      
      this.pipeline.push({
        $addFields: {
          [currentPath]: {
            $arrayElemAt: [`$${currentPath}_expanded`, 0]
          }
        }
      });
    }
    
    return this;
  }
  
  async execute(filter) {
    return await this.collection.aggregate([
      { $match: filter },
      ...this.pipeline
    ]).toArray();
  }
}

// Usage example
const expanded = await new ExpansionBuilder(db.paymentIntents)
  .expand('customer')
  .expand('customer.default_payment_method')
  .execute({ _id: 'pi_123' });
```

## 11. MongoDB Implementation Insights

### Key Takeaways for MongoDB Schema Design

1. **Use Prefixed IDs**
   ```javascript
   function generateId(prefix) {
     return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
   }
   ```

2. **Implement Version Control**
   ```javascript
   {
     _id: "obj_123",
     schema_version: "2024-01-01",
     data: { /* versioned structure */ }
   }
   ```

3. **Event Sourcing for Audit Trail**
   ```javascript
   // Store all changes as events
   await db.events.insertOne({
     type: 'customer.updated',
     timestamp: new Date(),
     data: { /* change details */ }
   });
   ```

4. **Flexible Metadata Storage**
   ```javascript
   // Unlike Stripe's string-only limitation
   metadata: {
     tags: ['premium', 'verified'],
     scores: { risk: 0.15, loyalty: 0.85 },
     nested: { data: { structure: true } }
   }
   ```

5. **Optimize for Common Access Patterns**
   ```javascript
   // Denormalize frequently accessed data
   {
     _id: "pi_123",
     customer: "cus_123",
     customer_email: "customer@example.com", // Denormalized
     customer_name: "John Doe" // Denormalized
   }
   ```

6. **Implement Idempotency at Database Level**
   ```javascript
   // Use unique indexes for natural idempotency
   db.payments.createIndex(
     { customer_id: 1, order_id: 1 },
     { unique: true }
   );
   ```

7. **State Machine Validation**
   ```javascript
   // Use MongoDB validation rules
   db.createCollection("payments", {
     validator: {
       $jsonSchema: {
         properties: {
           status: {
             enum: ["created", "processing", "succeeded", "failed"]
           }
         }
       }
     }
   });
   ```

### Performance Optimizations

1. **Strategic Indexing**
   ```javascript
   // Compound indexes for common queries
   db.payments.createIndex({ customer: 1, created: -1 });
   db.payments.createIndex({ status: 1, created: -1 });
   ```

2. **Aggregation Pipeline Caching**
   ```javascript
   // Cache expanded results
   const cacheKey = `expanded:${objectId}:${expandFields.join(',')}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

3. **Partial Indexes for Status**
   ```javascript
   // Index only active records
   db.payments.createIndex(
     { created: -1 },
     { partialFilterExpression: { status: { $in: ["processing", "requires_action"] } } }
   );
   ```

### Security Considerations

1. **Field-Level Encryption**
   ```javascript
   // Encrypt sensitive fields
   {
     _id: "cus_123",
     email: encrypt("customer@example.com"),
     payment_methods: [] // Store separately with stricter access
   }
   ```

2. **Access Control Lists**
   ```javascript
   // Role-based access
   {
     _id: "resource_123",
     acl: {
       read: ["role:viewer", "role:admin"],
       write: ["role:admin"],
       delete: ["role:super_admin"]
     }
   }
   ```

### Conclusion

Stripe's API design patterns provide excellent guidance for building robust, scalable MongoDB schemas. Key principles to adopt:

1. **Immutability through versioning** rather than updates
2. **Event sourcing** for complete audit trails
3. **State machines** for complex workflows
4. **Idempotency** for reliable operations
5. **Flexible expansion** patterns for related data
6. **Strategic denormalization** for performance
7. **Comprehensive error handling** with retry strategies

By implementing these patterns in MongoDB, you can create a payment system that matches Stripe's reliability and developer experience while leveraging MongoDB's flexibility for custom business requirements.