# Data Cleanup and Migration Strategy

## Overview
Transform messy PostgreSQL data (now in MongoDB) into a clean, reliable MongoDB database with ACID transaction support for a production ticketing system.

## Current Problems
1. **Unknown ticket count**: Can't determine actual tickets sold
2. **Overselling risk**: No capacity management
3. **Payment uncertainty**: Can't verify all payments received
4. **Feature limitations**: Can't support updates, additional purchases
5. **Data inconsistencies**: Duplicate records, missing relationships

## Solution Architecture

### Phase 1: Data Analysis & Reconciliation

#### 1.1 Create Reconciliation Reports
```javascript
// Ticket count reconciliation
const reconcileTickets = async () => {
  // Sum from registrations
  const registrationCount = await db.registrations.aggregate([
    { $group: { _id: null, total: { $sum: "$attendeeCount" } } }
  ]);
  
  // Count individual tickets
  const ticketCount = await db.tickets.countDocuments();
  
  // Count from payments
  const paymentCount = await db.payments.aggregate([
    { $match: { status: "paid" } },
    { $group: { _id: null, total: { $sum: "$metadata.totalAttendees" } } }
  ]);
  
  return {
    fromRegistrations: registrationCount,
    fromTickets: ticketCount,
    fromPayments: paymentCount,
    discrepancies: [] // identify mismatches
  };
};
```

#### 1.2 Payment Reconciliation
```javascript
const reconcilePayments = async () => {
  // Match registrations to payments
  const unmatchedRegistrations = [];
  const unmatchedPayments = [];
  const matched = [];
  
  // Cross-reference by confirmationNumber, amount, date
  // Identify gaps and duplicates
};
```

### Phase 2: Clean Database Schema

#### Core Collections with Transactions

```javascript
// events collection - with capacity management
{
  _id: ObjectId,
  eventId: "gp-2025",
  name: "Grand Proclamation 2025",
  functions: [{
    functionId: "banquet-2025",
    name: "Proclamation Banquet",
    date: ISODate("2025-11-15T18:00:00Z"),
    venue: "Grand Ballroom",
    capacity: {
      total: 500,
      sold: 0,        // Updated via transactions
      reserved: 0,    // Temporary holds
      available: 500
    },
    pricing: [{
      packageId: "individual",
      price: Decimal128("120.00"),
      currency: "AUD"
    }]
  }],
  version: 1  // Optimistic locking
}

// tickets collection - individual ticket records
{
  _id: ObjectId,
  ticketNumber: "GP2025-00001",  // Sequential, unique
  barcode: "...",                 // For scanning
  eventId: "gp-2025",
  functionId: "banquet-2025",
  registrationId: ObjectId,
  status: "active",  // active, cancelled, transferred, used
  attendee: {
    name: "John Smith",
    email: "john@example.com",
    dietary: "vegetarian",
    tablePreference: "Lodge ABC"
  },
  seat: {
    table: "T12",
    seat: "4"
  },
  pricing: {
    basePrice: Decimal128("120.00"),
    fees: Decimal128("2.40"),
    total: Decimal128("122.40")
  },
  history: [{
    action: "created",
    timestamp: ISODate(),
    userId: ObjectId,
    details: {}
  }],
  createdAt: ISODate(),
  updatedAt: ISODate()
}

// registrations collection - purchase records
{
  _id: ObjectId,
  confirmationNumber: "ABC123",
  type: "lodge",  // lodge, individual
  lodge: {
    lodgeId: ObjectId,
    name: "Example Lodge No. 123",
    contact: {
      name: "Secretary Name",
      email: "secretary@lodge.com",
      phone: "+61400000000"
    }
  },
  tickets: [ObjectId, ObjectId],  // References to tickets
  payment: {
    method: "stripe",
    paymentIntentId: "pi_xxx",
    chargeId: "ch_xxx",
    amount: Decimal128("2448.00"),
    currency: "AUD",
    status: "paid",
    paidAt: ISODate()
  },
  metadata: {
    source: "web",
    userAgent: "...",
    ipAddress: "..."
  },
  createdAt: ISODate(),
  updatedAt: ISODate()
}

// inventory_transactions collection - audit trail
{
  _id: ObjectId,
  transactionId: UUID(),
  type: "ticket_purchase",  // ticket_purchase, ticket_cancel, ticket_transfer
  eventId: "gp-2025",
  functionId: "banquet-2025",
  quantity: 20,
  direction: "decrease",  // increase, decrease
  registrationId: ObjectId,
  snapshot: {
    before: { sold: 240, available: 260 },
    after: { sold: 260, available: 240 }
  },
  timestamp: ISODate(),
  userId: ObjectId
}
```

### Phase 3: Migration Implementation

#### 3.1 Transaction-Safe Ticket Creation
```javascript
const createTicketsWithTransaction = async (registrationData) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // 1. Check availability with lock
      const event = await Event.findOneAndUpdate(
        { 
          eventId: registrationData.eventId,
          "functions.functionId": registrationData.functionId,
          "functions.capacity.available": { $gte: registrationData.quantity }
        },
        {
          $inc: {
            "functions.$.capacity.sold": registrationData.quantity,
            "functions.$.capacity.available": -registrationData.quantity
          }
        },
        { session, new: true }
      );
      
      if (!event) {
        throw new Error('Insufficient capacity');
      }
      
      // 2. Create tickets
      const tickets = await Ticket.insertMany(
        registrationData.attendees.map(attendee => ({
          eventId: registrationData.eventId,
          functionId: registrationData.functionId,
          attendee,
          status: 'active'
        })),
        { session }
      );
      
      // 3. Create registration
      const registration = await Registration.create([{
        ...registrationData,
        tickets: tickets.map(t => t._id)
      }], { session });
      
      // 4. Create audit record
      await InventoryTransaction.create([{
        type: 'ticket_purchase',
        eventId: registrationData.eventId,
        quantity: registrationData.quantity,
        registrationId: registration[0]._id
      }], { session });
      
      return { registration: registration[0], tickets };
    });
  } finally {
    await session.endSession();
  }
};
```

#### 3.2 Data Migration Script
```javascript
const migrateRegistrations = async () => {
  const oldRegistrations = await db.collection('registrations').find({}).toArray();
  
  for (const oldReg of oldRegistrations) {
    try {
      // Validate and clean data
      const cleanedData = validateAndClean(oldReg);
      
      // Find matching payment
      const payment = await findMatchingPayment(oldReg);
      
      // Create new registration with transaction
      await createTicketsWithTransaction({
        ...cleanedData,
        payment
      });
      
      // Mark as migrated
      await db.collection('migration_log').insertOne({
        collection: 'registrations',
        oldId: oldReg._id,
        status: 'completed',
        timestamp: new Date()
      });
    } catch (error) {
      await db.collection('migration_errors').insertOne({
        collection: 'registrations',
        oldId: oldReg._id,
        error: error.message,
        data: oldReg
      });
    }
  }
};
```

### Phase 4: Validation & Verification

#### 4.1 Integrity Checks
```javascript
const validateDataIntegrity = async () => {
  const checks = {
    // Every ticket has a valid registration
    orphanedTickets: await db.tickets.find({
      registrationId: { $exists: false }
    }).count(),
    
    // Every paid registration has tickets
    registrationsWithoutTickets: await db.registrations.find({
      'payment.status': 'paid',
      tickets: { $size: 0 }
    }).count(),
    
    // Capacity matches ticket count
    capacityMismatch: await validateCapacityCounts(),
    
    // Payment totals match
    paymentMismatch: await validatePaymentTotals()
  };
  
  return checks;
};
```

## Implementation Steps

### Week 1: Analysis & Planning
1. Run reconciliation reports
2. Identify data quality issues
3. Document business rules
4. Design clean schema

### Week 2: Build Migration Tools
1. Create Next.js migration dashboard
2. Build data validation functions
3. Implement transaction handlers
4. Create rollback procedures

### Week 3: Test Migration
1. Set up test environment
2. Run trial migrations
3. Validate results
4. Fix edge cases

### Week 4: Production Migration
1. Final data snapshot
2. Run migration with monitoring
3. Validate integrity
4. Switch production app

## Key Benefits

1. **ACID Transactions**: Prevent overselling with atomic operations
2. **Audit Trail**: Complete history of all changes
3. **Clean Schema**: Enables all required features
4. **Payment Certainty**: Clear payment reconciliation
5. **Scalability**: Ready for growth

## MongoDB Features to Leverage

### 1. Transactions for Consistency
```javascript
// Ensure atomic ticket purchases
session.withTransaction(async () => {
  // Check capacity
  // Create tickets
  // Update inventory
  // Log transaction
});
```

### 2. Change Streams for Real-time
```javascript
// Monitor ticket sales in real-time
const changeStream = db.collection('tickets').watch();
changeStream.on('change', (change) => {
  // Update dashboards
  // Send notifications
});
```

### 3. Aggregation for Analytics
```javascript
// Complex reporting
db.registrations.aggregate([
  { $match: { eventId: "gp-2025" } },
  { $group: { 
    _id: "$lodge.name",
    totalTickets: { $sum: { $size: "$tickets" } },
    totalRevenue: { $sum: "$payment.amount" }
  }},
  { $sort: { totalTickets: -1 } }
]);
```

## Next Steps

1. **Create migration dashboard** in Next.js
2. **Build reconciliation reports** to identify issues
3. **Design validation rules** for data quality
4. **Implement test migrations** with rollback
5. **Plan production cutover** with minimal downtime