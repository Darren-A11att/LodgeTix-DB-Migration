# MongoDB Atomic Operations and Immutability Patterns

## Table of Contents
1. [FindAndModify Patterns](#findandmodify-patterns)
2. [Bulk Write Operations](#bulk-write-operations)
3. [Transactions and Sessions](#transactions-and-sessions)
4. [Write Concerns and Journaling](#write-concerns-and-journaling)
5. [Causal Consistency](#causal-consistency)
6. [Change Streams for Event Sourcing](#change-streams-for-event-sourcing)
7. [Schema Versioning Strategies](#schema-versioning-strategies)
8. [Immutable Document Patterns](#immutable-document-patterns)
9. [Append-Only Designs](#append-only-designs)
10. [Conflict Resolution Strategies](#conflict-resolution-strategies)

## FindAndModify Patterns

### Overview
`findAndModify` operations are atomic at the document level, allowing you to find and update a document in a single operation while returning either the original or modified document.

### Basic Pattern
```javascript
// Find and update with return of modified document
const result = await db.collection('orders').findOneAndUpdate(
  { _id: orderId, status: 'pending' },
  { 
    $set: { status: 'processing' },
    $inc: { version: 1 },
    $currentDate: { lastModified: true }
  },
  { 
    returnDocument: 'after',
    upsert: false
  }
);

if (!result.value) {
  throw new Error('Order not found or already processing');
}
```

### Optimistic Locking Pattern
```javascript
async function updateWithOptimisticLock(collection, id, updates) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Find current document
      const current = await collection.findOne({ _id: id });
      if (!current) throw new Error('Document not found');
      
      // Attempt atomic update with version check
      const result = await collection.findOneAndUpdate(
        { 
          _id: id, 
          version: current.version 
        },
        {
          $set: updates,
          $inc: { version: 1 }
        },
        { returnDocument: 'after' }
      );
      
      if (result.value) return result.value;
      
      // Version mismatch, retry
      retries++;
      await new Promise(resolve => setTimeout(resolve, 100 * retries));
    } catch (error) {
      throw error;
    }
  }
  
  throw new Error('Optimistic lock failed after max retries');
}
```

### Queue Processing Pattern
```javascript
// Atomic dequeue operation
async function dequeueTask(db) {
  const now = new Date();
  
  const task = await db.collection('tasks').findOneAndUpdate(
    {
      status: 'pending',
      scheduledFor: { $lte: now },
      lockedUntil: { $lte: now }
    },
    {
      $set: {
        status: 'processing',
        lockedUntil: new Date(now.getTime() + 5 * 60 * 1000), // 5 min lock
        processingStarted: now
      }
    },
    {
      sort: { priority: -1, createdAt: 1 },
      returnDocument: 'after'
    }
  );
  
  return task.value;
}
```

## Bulk Write Operations

### Overview
Bulk operations allow multiple write operations to be executed with a single command, reducing network overhead and improving performance.

### Ordered vs Unordered Operations
```javascript
// Ordered bulk operations (stop on first error)
const orderedBulk = await db.collection('inventory').bulkWrite([
  {
    updateOne: {
      filter: { sku: 'ABC123' },
      update: { $inc: { quantity: -5 } }
    }
  },
  {
    insertOne: {
      document: {
        sku: 'DEF456',
        quantity: 100,
        createdAt: new Date()
      }
    }
  },
  {
    deleteOne: {
      filter: { sku: 'GHI789', quantity: 0 }
    }
  }
], { ordered: true });

// Unordered bulk operations (continue on error)
const unorderedBulk = await db.collection('logs').bulkWrite([
  ...logEntries.map(entry => ({
    insertOne: { document: entry }
  }))
], { ordered: false });
```

### Batch Processing Pattern
```javascript
async function batchProcess(collection, documents, batchSize = 1000) {
  const results = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    const operations = batch.map(doc => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true
      }
    }));
    
    try {
      const result = await collection.bulkWrite(operations, {
        ordered: false,
        writeConcern: { w: 'majority', j: true }
      });
      
      results.push({
        batch: Math.floor(i / batchSize) + 1,
        ...result
      });
    } catch (error) {
      // Handle partial failures
      if (error.writeErrors) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} had ${error.writeErrors.length} errors`);
      }
      throw error;
    }
  }
  
  return results;
}
```

## Transactions and Sessions

### Overview
Multi-document ACID transactions ensure data consistency across multiple documents and collections.

### Basic Transaction Pattern
```javascript
async function transferFunds(db, fromAccount, toAccount, amount) {
  const session = db.client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Debit source account
      const source = await db.collection('accounts').findOneAndUpdate(
        { _id: fromAccount, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session, returnDocument: 'after' }
      );
      
      if (!source.value) {
        throw new Error('Insufficient funds');
      }
      
      // Credit destination account
      await db.collection('accounts').updateOne(
        { _id: toAccount },
        { $inc: { balance: amount } },
        { session }
      );
      
      // Record transaction
      await db.collection('transactions').insertOne({
        from: fromAccount,
        to: toAccount,
        amount,
        timestamp: new Date(),
        type: 'transfer'
      }, { session });
    }, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true }
    });
  } finally {
    await session.endSession();
  }
}
```

### Saga Pattern for Long-Running Transactions
```javascript
class SagaOrchestrator {
  constructor(db) {
    this.db = db;
  }
  
  async executeOrderSaga(orderData) {
    const sagaId = new ObjectId();
    const saga = {
      _id: sagaId,
      type: 'order',
      status: 'started',
      steps: [],
      data: orderData,
      createdAt: new Date()
    };
    
    await this.db.collection('sagas').insertOne(saga);
    
    try {
      // Step 1: Reserve inventory
      await this.executeStep(sagaId, 'reserveInventory', async () => {
        return await this.reserveInventory(orderData.items);
      });
      
      // Step 2: Process payment
      await this.executeStep(sagaId, 'processPayment', async () => {
        return await this.processPayment(orderData.payment);
      });
      
      // Step 3: Create order
      await this.executeStep(sagaId, 'createOrder', async () => {
        return await this.createOrder(orderData);
      });
      
      // Mark saga as completed
      await this.db.collection('sagas').updateOne(
        { _id: sagaId },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
      
    } catch (error) {
      await this.compensate(sagaId);
      throw error;
    }
  }
  
  async executeStep(sagaId, stepName, action) {
    try {
      const result = await action();
      
      await this.db.collection('sagas').updateOne(
        { _id: sagaId },
        {
          $push: {
            steps: {
              name: stepName,
              status: 'completed',
              result,
              timestamp: new Date()
            }
          }
        }
      );
      
      return result;
    } catch (error) {
      await this.db.collection('sagas').updateOne(
        { _id: sagaId },
        {
          $set: { status: 'failed' },
          $push: {
            steps: {
              name: stepName,
              status: 'failed',
              error: error.message,
              timestamp: new Date()
            }
          }
        }
      );
      throw error;
    }
  }
  
  async compensate(sagaId) {
    const saga = await this.db.collection('sagas').findOne({ _id: sagaId });
    
    // Reverse completed steps
    for (const step of saga.steps.reverse()) {
      if (step.status === 'completed') {
        await this.compensateStep(step);
      }
    }
  }
}
```

## Write Concerns and Journaling

### Overview
Write concerns determine the level of acknowledgment requested from MongoDB for write operations.

### Write Concern Levels
```javascript
// Majority write concern (recommended for critical data)
await collection.insertOne(document, {
  writeConcern: {
    w: 'majority',
    j: true,  // Wait for journal sync
    wtimeout: 5000
  }
});

// Custom write concern for specific replica set members
await collection.updateMany(filter, update, {
  writeConcern: {
    w: 3,  // Wait for 3 members
    j: true,
    wtimeout: 10000
  }
});

// Fire-and-forget (use with caution)
await collection.insertOne(logEntry, {
  writeConcern: { w: 0 }
});
```

### Journaling Patterns
```javascript
class JournaledWriter {
  constructor(db) {
    this.db = db;
  }
  
  async writeWithJournal(collection, document) {
    const journalEntry = {
      collection: collection.collectionName,
      operation: 'insert',
      document,
      timestamp: new Date(),
      status: 'pending'
    };
    
    // Write to journal first
    const journal = await this.db.collection('write_journal').insertOne(
      journalEntry,
      { writeConcern: { w: 'majority', j: true } }
    );
    
    try {
      // Perform actual write
      const result = await collection.insertOne(document, {
        writeConcern: { w: 'majority', j: true }
      });
      
      // Mark journal entry as completed
      await this.db.collection('write_journal').updateOne(
        { _id: journal.insertedId },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
      
      return result;
    } catch (error) {
      // Mark journal entry as failed
      await this.db.collection('write_journal').updateOne(
        { _id: journal.insertedId },
        { 
          $set: { 
            status: 'failed', 
            error: error.message,
            failedAt: new Date()
          } 
        }
      );
      throw error;
    }
  }
}
```

## Causal Consistency

### Overview
Causal consistency ensures that operations are observed in a causally consistent order across sessions.

### Causal Consistency Pattern
```javascript
async function causallyConsistentOperations(client) {
  // Start a causally consistent session
  const session = client.startSession({
    causalConsistency: true
  });
  
  try {
    // Write operation
    await client.db('app').collection('users').updateOne(
      { _id: userId },
      { $set: { status: 'active' } },
      { session }
    );
    
    // Subsequent read will see the write
    const user = await client.db('app').collection('users').findOne(
      { _id: userId },
      { session }
    );
    
    // Pass cluster time to another operation
    const clusterTime = session.clusterTime;
    
    // Another session can read at this cluster time
    const newSession = client.startSession({
      causalConsistency: true,
      defaultTransactionOptions: {
        readConcern: { level: 'majority', afterClusterTime: clusterTime }
      }
    });
    
    const consistentRead = await client.db('app').collection('users').findOne(
      { _id: userId },
      { session: newSession }
    );
    
  } finally {
    await session.endSession();
  }
}
```

## Change Streams for Event Sourcing

### Overview
Change streams provide a real-time stream of data changes, enabling event-driven architectures and event sourcing patterns.

### Basic Change Stream Pattern
```javascript
class EventStore {
  constructor(db) {
    this.db = db;
  }
  
  async startChangeStream() {
    const pipeline = [
      {
        $match: {
          'fullDocument.eventType': { $exists: true },
          operationType: { $in: ['insert', 'update', 'replace'] }
        }
      }
    ];
    
    const options = {
      fullDocument: 'updateLookup',
      resumeAfter: await this.getResumeToken()
    };
    
    const changeStream = this.db.collection('events').watch(pipeline, options);
    
    changeStream.on('change', async (change) => {
      try {
        await this.processEvent(change);
        await this.saveResumeToken(change._id);
      } catch (error) {
        console.error('Error processing change:', error);
      }
    });
    
    changeStream.on('error', (error) => {
      console.error('Change stream error:', error);
      // Implement reconnection logic
    });
  }
  
  async processEvent(change) {
    const event = change.fullDocument;
    
    switch (event.eventType) {
      case 'OrderCreated':
        await this.handleOrderCreated(event);
        break;
      case 'PaymentReceived':
        await this.handlePaymentReceived(event);
        break;
      // ... other event handlers
    }
  }
  
  async saveResumeToken(token) {
    await this.db.collection('stream_checkpoints').replaceOne(
      { _id: 'events_stream' },
      { _id: 'events_stream', token, updatedAt: new Date() },
      { upsert: true }
    );
  }
}
```

### Event Sourcing Implementation
```javascript
class EventSourcingRepository {
  constructor(db) {
    this.db = db;
    this.events = db.collection('events');
    this.snapshots = db.collection('snapshots');
  }
  
  async save(aggregate) {
    const events = aggregate.getUncommittedEvents();
    if (events.length === 0) return;
    
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Save events
        const eventDocs = events.map((event, index) => ({
          aggregateId: aggregate.id,
          aggregateType: aggregate.constructor.name,
          eventType: event.type,
          eventData: event.data,
          eventVersion: aggregate.version - events.length + index + 1,
          timestamp: new Date(),
          metadata: {
            userId: event.userId,
            correlationId: event.correlationId
          }
        }));
        
        await this.events.insertMany(eventDocs, { session });
        
        // Update snapshot if needed
        if (aggregate.version % 10 === 0) {
          await this.snapshots.replaceOne(
            { _id: aggregate.id },
            {
              _id: aggregate.id,
              aggregateType: aggregate.constructor.name,
              data: aggregate.toSnapshot(),
              version: aggregate.version,
              timestamp: new Date()
            },
            { upsert: true, session }
          );
        }
      });
      
      aggregate.markEventsAsCommitted();
    } finally {
      await session.endSession();
    }
  }
  
  async load(AggregateClass, aggregateId) {
    // Try to load from snapshot
    const snapshot = await this.snapshots.findOne({ _id: aggregateId });
    
    let aggregate;
    let fromVersion = 0;
    
    if (snapshot) {
      aggregate = AggregateClass.fromSnapshot(snapshot.data);
      fromVersion = snapshot.version;
    } else {
      aggregate = new AggregateClass(aggregateId);
    }
    
    // Load events after snapshot
    const events = await this.events.find({
      aggregateId,
      eventVersion: { $gt: fromVersion }
    }).sort({ eventVersion: 1 }).toArray();
    
    // Replay events
    for (const event of events) {
      aggregate.applyEvent({
        type: event.eventType,
        data: event.eventData
      });
    }
    
    return aggregate;
  }
}
```

## Schema Versioning Strategies

### Overview
Schema versioning helps manage evolving data models while maintaining backward compatibility.

### Embedded Version Field Pattern
```javascript
class VersionedDocumentManager {
  constructor(db) {
    this.db = db;
    this.schemaVersions = {
      1: this.migrateV1ToV2.bind(this),
      2: this.migrateV2ToV3.bind(this)
    };
    this.currentVersion = 3;
  }
  
  async save(collection, document) {
    const versionedDoc = {
      ...document,
      schemaVersion: this.currentVersion,
      updatedAt: new Date()
    };
    
    return await this.db.collection(collection).insertOne(versionedDoc);
  }
  
  async find(collection, query) {
    const documents = await this.db.collection(collection).find(query).toArray();
    return Promise.all(documents.map(doc => this.migrate(doc)));
  }
  
  async migrate(document) {
    let currentDoc = { ...document };
    const docVersion = document.schemaVersion || 1;
    
    for (let v = docVersion; v < this.currentVersion; v++) {
      if (this.schemaVersions[v]) {
        currentDoc = await this.schemaVersions[v](currentDoc);
      }
    }
    
    return currentDoc;
  }
  
  async migrateV1ToV2(doc) {
    return {
      ...doc,
      schemaVersion: 2,
      fullName: `${doc.firstName} ${doc.lastName}`,
      firstName: undefined,
      lastName: undefined
    };
  }
  
  async migrateV2ToV3(doc) {
    return {
      ...doc,
      schemaVersion: 3,
      contact: {
        email: doc.email,
        phone: doc.phone
      },
      email: undefined,
      phone: undefined
    };
  }
}
```

### Lazy Migration Pattern
```javascript
class LazyMigrationService {
  async findAndMigrate(collection, filter) {
    const doc = await collection.findOne(filter);
    if (!doc) return null;
    
    if (doc.schemaVersion < this.currentVersion) {
      const migrated = await this.migrate(doc);
      
      // Update document with new schema
      await collection.replaceOne(
        { _id: doc._id, schemaVersion: doc.schemaVersion },
        migrated
      );
      
      return migrated;
    }
    
    return doc;
  }
}
```

## Immutable Document Patterns

### Overview
Immutable patterns ensure data integrity by never modifying existing documents, only creating new versions.

### Append-Only Pattern
```javascript
class ImmutableDocumentStore {
  constructor(db) {
    this.db = db;
  }
  
  async create(collection, data) {
    const document = {
      _id: new ObjectId(),
      entityId: data.entityId || new ObjectId(),
      version: 1,
      data,
      createdAt: new Date(),
      createdBy: data.userId,
      isActive: true
    };
    
    await this.db.collection(collection).insertOne(document);
    return document;
  }
  
  async update(collection, entityId, updates, userId) {
    // Get current version
    const current = await this.db.collection(collection).findOne(
      { entityId, isActive: true },
      { sort: { version: -1 } }
    );
    
    if (!current) {
      throw new Error('Entity not found');
    }
    
    // Create new version
    const newVersion = {
      _id: new ObjectId(),
      entityId,
      version: current.version + 1,
      data: { ...current.data, ...updates },
      createdAt: new Date(),
      createdBy: userId,
      isActive: true,
      previousVersion: current._id
    };
    
    const session = this.db.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Deactivate current version
        await this.db.collection(collection).updateOne(
          { _id: current._id },
          { $set: { isActive: false, deactivatedAt: new Date() } },
          { session }
        );
        
        // Insert new version
        await this.db.collection(collection).insertOne(newVersion, { session });
      });
      
      return newVersion;
    } finally {
      await session.endSession();
    }
  }
  
  async getHistory(collection, entityId) {
    return await this.db.collection(collection)
      .find({ entityId })
      .sort({ version: -1 })
      .toArray();
  }
}
```

### Event-Based Immutability
```javascript
class EventBasedEntity {
  constructor(db) {
    this.db = db;
  }
  
  async createEntity(type, initialData, userId) {
    const entityId = new ObjectId();
    const event = {
      _id: new ObjectId(),
      entityId,
      entityType: type,
      eventType: 'Created',
      eventData: initialData,
      eventVersion: 1,
      timestamp: new Date(),
      userId
    };
    
    await this.db.collection('entity_events').insertOne(event);
    
    // Materialize initial state
    await this.materializeState(entityId);
    
    return entityId;
  }
  
  async updateEntity(entityId, eventType, eventData, userId) {
    // Get current version
    const lastEvent = await this.db.collection('entity_events')
      .findOne(
        { entityId },
        { sort: { eventVersion: -1 } }
      );
    
    const newEvent = {
      _id: new ObjectId(),
      entityId,
      entityType: lastEvent.entityType,
      eventType,
      eventData,
      eventVersion: (lastEvent?.eventVersion || 0) + 1,
      timestamp: new Date(),
      userId
    };
    
    await this.db.collection('entity_events').insertOne(newEvent);
    
    // Update materialized view
    await this.materializeState(entityId);
    
    return newEvent;
  }
  
  async materializeState(entityId) {
    const events = await this.db.collection('entity_events')
      .find({ entityId })
      .sort({ eventVersion: 1 })
      .toArray();
    
    const state = events.reduce((acc, event) => {
      switch (event.eventType) {
        case 'Created':
          return { ...event.eventData, version: event.eventVersion };
        case 'Updated':
          return { ...acc, ...event.eventData, version: event.eventVersion };
        case 'Deleted':
          return { ...acc, deleted: true, version: event.eventVersion };
        default:
          return acc;
      }
    }, {});
    
    await this.db.collection('entity_states').replaceOne(
      { _id: entityId },
      {
        _id: entityId,
        ...state,
        lastEventId: events[events.length - 1]._id,
        materializedAt: new Date()
      },
      { upsert: true }
    );
  }
}
```

## Append-Only Designs

### Overview
Append-only designs never delete or update data, only add new records, providing complete audit trails.

### Audit Log Pattern
```javascript
class AuditableDataStore {
  constructor(db) {
    this.db = db;
    this.data = db.collection('data');
    this.audit = db.collection('audit_log');
  }
  
  async performOperation(operation, entityId, data, userId) {
    const session = this.db.client.startSession();
    const operationId = new ObjectId();
    
    try {
      let result;
      
      await session.withTransaction(async () => {
        // Record audit entry first
        const auditEntry = {
          _id: operationId,
          entityId,
          operation,
          data,
          userId,
          timestamp: new Date(),
          status: 'pending'
        };
        
        await this.audit.insertOne(auditEntry, { session });
        
        // Perform actual operation
        switch (operation) {
          case 'create':
            result = await this.data.insertOne(
              { _id: entityId, ...data },
              { session }
            );
            break;
          case 'update':
            result = await this.data.updateOne(
              { _id: entityId },
              { $set: data },
              { session }
            );
            break;
          case 'delete':
            result = await this.data.updateOne(
              { _id: entityId },
              { $set: { deleted: true, deletedAt: new Date() } },
              { session }
            );
            break;
        }
        
        // Update audit entry with result
        await this.audit.updateOne(
          { _id: operationId },
          {
            $set: {
              status: 'completed',
              result: {
                acknowledged: result.acknowledged,
                modifiedCount: result.modifiedCount
              }
            }
          },
          { session }
        );
      });
      
      return result;
    } catch (error) {
      // Mark audit entry as failed
      await this.audit.updateOne(
        { _id: operationId },
        {
          $set: {
            status: 'failed',
            error: error.message,
            failedAt: new Date()
          }
        }
      );
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
```

### Time-Series Pattern
```javascript
class TimeSeriesStore {
  constructor(db) {
    this.db = db;
  }
  
  async appendMetric(metric) {
    const bucketTime = this.getBucketTime(metric.timestamp);
    
    await this.db.collection('metrics').updateOne(
      {
        metricName: metric.name,
        bucketTime,
        count: { $lt: 1000 } // Bucket size limit
      },
      {
        $push: {
          measurements: {
            value: metric.value,
            timestamp: metric.timestamp,
            tags: metric.tags
          }
        },
        $inc: { count: 1 },
        $min: { minValue: metric.value },
        $max: { maxValue: metric.value },
        $setOnInsert: {
          metricName: metric.name,
          bucketTime
        }
      },
      { upsert: true }
    );
  }
  
  getBucketTime(timestamp) {
    // Round down to hour
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0);
    return date;
  }
  
  async queryMetrics(metricName, startTime, endTime) {
    const buckets = await this.db.collection('metrics').find({
      metricName,
      bucketTime: {
        $gte: this.getBucketTime(startTime),
        $lte: this.getBucketTime(endTime)
      }
    }).toArray();
    
    // Flatten measurements
    return buckets.flatMap(bucket => 
      bucket.measurements.filter(m => 
        m.timestamp >= startTime && m.timestamp <= endTime
      )
    );
  }
}
```

## Conflict Resolution Strategies

### Overview
Strategies for handling concurrent updates and resolving conflicts in distributed systems.

### Last-Write-Wins with Vector Clocks
```javascript
class VectorClockDocument {
  constructor(db) {
    this.db = db;
  }
  
  async update(collection, docId, updates, nodeId) {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // Get current document
        const current = await this.db.collection(collection).findOne({ _id: docId });
        
        if (!current) {
          // First write
          const newDoc = {
            _id: docId,
            data: updates,
            vectorClock: { [nodeId]: 1 },
            lastModified: new Date()
          };
          
          await this.db.collection(collection).insertOne(newDoc);
          return newDoc;
        }
        
        // Update vector clock
        const newVectorClock = { ...current.vectorClock };
        newVectorClock[nodeId] = (newVectorClock[nodeId] || 0) + 1;
        
        // Check for conflicts
        const conflicts = this.detectConflicts(current.vectorClock, newVectorClock);
        
        if (conflicts.length > 0) {
          // Resolve conflicts
          const resolved = await this.resolveConflicts(current, updates, conflicts);
          updates = resolved;
        }
        
        // Attempt update
        const result = await this.db.collection(collection).findOneAndUpdate(
          { 
            _id: docId,
            vectorClock: current.vectorClock
          },
          {
            $set: {
              data: updates,
              vectorClock: newVectorClock,
              lastModified: new Date()
            }
          },
          { returnDocument: 'after' }
        );
        
        if (result.value) return result.value;
        
        // Concurrent update occurred, retry
        retries++;
        await new Promise(resolve => setTimeout(resolve, 100 * retries));
        
      } catch (error) {
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }
  
  detectConflicts(currentClock, newClock) {
    const conflicts = [];
    
    for (const [node, timestamp] of Object.entries(currentClock)) {
      if (!newClock[node] || newClock[node] < timestamp) {
        conflicts.push({ node, timestamp });
      }
    }
    
    return conflicts;
  }
  
  async resolveConflicts(current, updates, conflicts) {
    // Custom conflict resolution logic
    // This example merges arrays and takes latest for other fields
    const resolved = { ...current.data };
    
    for (const [key, value] of Object.entries(updates)) {
      if (Array.isArray(resolved[key]) && Array.isArray(value)) {
        // Merge arrays (union)
        resolved[key] = [...new Set([...resolved[key], ...value])];
      } else if (typeof resolved[key] === 'object' && typeof value === 'object') {
        // Deep merge objects
        resolved[key] = { ...resolved[key], ...value };
      } else {
        // Last write wins for primitives
        resolved[key] = value;
      }
    }
    
    return resolved;
  }
}
```

### CRDT (Conflict-free Replicated Data Type) Pattern
```javascript
class GCounter {
  constructor(db, nodeId) {
    this.db = db;
    this.nodeId = nodeId;
  }
  
  async increment(counterId, amount = 1) {
    await this.db.collection('counters').updateOne(
      { _id: counterId },
      {
        $inc: { [`counts.${this.nodeId}`]: amount },
        $set: { lastModified: new Date() }
      },
      { upsert: true }
    );
  }
  
  async getValue(counterId) {
    const counter = await this.db.collection('counters').findOne({ _id: counterId });
    
    if (!counter || !counter.counts) return 0;
    
    return Object.values(counter.counts).reduce((sum, count) => sum + count, 0);
  }
  
  async merge(counterId, remoteCounts) {
    await this.db.collection('counters').updateOne(
      { _id: counterId },
      {
        $max: Object.entries(remoteCounts).reduce((acc, [node, count]) => {
          acc[`counts.${node}`] = count;
          return acc;
        }, {})
      },
      { upsert: true }
    );
  }
}

class LWWRegister {
  constructor(db, nodeId) {
    this.db = db;
    this.nodeId = nodeId;
  }
  
  async set(registerId, value) {
    const timestamp = new Date();
    
    await this.db.collection('registers').findOneAndUpdate(
      { 
        _id: registerId,
        $or: [
          { timestamp: { $lt: timestamp } },
          { timestamp: { $exists: false } }
        ]
      },
      {
        $set: {
          value,
          timestamp,
          nodeId: this.nodeId
        }
      },
      { upsert: true }
    );
  }
  
  async get(registerId) {
    const register = await this.db.collection('registers').findOne({ _id: registerId });
    return register?.value;
  }
}
```

## Best Practices Summary

### 1. **Atomic Operations**
- Use `findAndModify` for single document atomicity
- Implement optimistic locking with version fields
- Leverage bulk operations for batch processing

### 2. **Transactions**
- Use transactions for multi-document consistency
- Implement saga patterns for long-running operations
- Always use appropriate read/write concerns

### 3. **Immutability**
- Prefer append-only designs for audit trails
- Use event sourcing for complex domain logic
- Implement proper versioning strategies

### 4. **Consistency**
- Use causal consistency for related operations
- Implement proper write concerns for critical data
- Use change streams for real-time consistency

### 5. **Conflict Resolution**
- Implement vector clocks for distributed updates
- Use CRDTs for eventually consistent data
- Design for eventual consistency where appropriate

### 6. **Performance**
- Batch operations when possible
- Use appropriate indexes for atomic operations
- Monitor and tune write concern performance

### 7. **Error Handling**
- Implement retry logic for transient failures
- Use idempotent operations where possible
- Maintain comprehensive audit logs

## Conclusion

MongoDB provides powerful features for implementing atomic operations and immutable patterns. By combining these patterns appropriately, you can build robust, scalable, and maintainable applications that handle concurrent operations gracefully while maintaining data integrity and providing complete audit trails.

The key is to choose the right pattern for your specific use case:
- Use transactions for strong consistency requirements
- Use event sourcing for complex business logic
- Use append-only designs for audit requirements
- Use CRDTs for distributed, eventually consistent systems

Remember that these patterns can be combined and adapted to meet your specific requirements, and always test thoroughly under concurrent load to ensure correctness.