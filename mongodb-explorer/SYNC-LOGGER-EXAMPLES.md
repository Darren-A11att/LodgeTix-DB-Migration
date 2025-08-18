# Sync Logger Examples

## Overview
The comprehensive sync logging system tracks all sync operations in a `sync_log` collection with detailed action tracking, error reporting, and performance metrics.

## Document Schema

### Sync Log Document Structure
```typescript
interface SyncLogDocument {
  _id: ObjectId;
  sessionId: string;           // UUID for this sync session
  runId: string;               // Human-readable run identifier
  startTimestamp: Date;
  endTimestamp?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  
  configuration: {
    providers: string[];       // ['stripe', 'square']
    limit?: number;
    dryRun: boolean;
    options: any;
  };
  
  actions: SyncAction[];       // All operations performed
  
  statistics: {
    totalRecords: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: number;
    warnings: number;
    duration: number;          // milliseconds
    ratePerSecond?: number;
  };
  
  summary: {
    totalDuration: number;
    operationsPerformed: string[];  // ['payment_processing', 'contact_sync']
    entitiesProcessed: string[];    // ['payment', 'registration', 'contact']
    providersUsed: string[];        // ['stripe', 'square']
    errorSummary: string[];         // First 10 error messages
    warningSummary: string[];       // First 10 warning messages
  };
  
  environment: {
    nodeVersion: string;
    timestamp: Date;
    hostname?: string;
    version?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

### Sync Action Structure
```typescript
interface SyncAction {
  id: string;                    // UUID for this action
  timestamp: Date;
  operation: string;             // 'payment_processing', 'contact_sync', etc.
  entity: string;                // 'payment', 'registration', 'contact'
  entityId?: string;             // Specific record ID
  provider?: string;             // 'stripe', 'square'
  status: 'started' | 'completed' | 'failed' | 'skipped';
  message: string;
  duration?: number;             // milliseconds
  details?: any;                 // Additional context
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}
```

## Example Log Output

### Console Output During Sync
```
[SYNC] Enhanced Payment Sync Started - Session ID: a1b2c3d4
[SYNC:INFO] initialization:database - Collections ensured and contacts map cleared
[SYNC:INFO] [stripe] provider_processing:provider stripe - Starting stripe processing
[SYNC:INFO] [stripe] payment_processing:payment ch_1234567890 - Processing Stripe charge: ch_1234567890 (150ms)
[SYNC:INFO] [stripe] payment_processing:payment ch_1234567890 - Stripe charge processed successfully (production eligible) (150ms)
[SYNC:INFO] [square] provider_processing:provider square - Starting square processing
[SYNC:ERROR] [square] payment_processing:payment sqpmt_1234567890 - Payment not found in Supabase
[SYNC:WARN] [stripe] payment_processing:payment ch_0987654321 - Payment already exists
[SYNC:INFO] selective_sync:production - Starting selective production sync
[SYNC:INFO] selective_sync:production - Selective production sync completed (2500ms)
[SYNC:INFO] error_verification:verification - Starting error verification
[SYNC:INFO] error_verification:verification - Error verification completed (500ms)

[SYNC] === SESSION SUMMARY ===
Session ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Status: COMPLETED
Duration: 15.3s
Total Records: 150
Processed: 142
Successful: 138
Failed: 4
Skipped: 8
Errors: 4
Warnings: 8
Rate: 9.3 records/second
Operations: initialization, provider_processing, payment_processing, selective_sync, error_verification
Entities: database, provider, payment, production, verification
Providers: stripe, square
=== END SUMMARY ===
```

### MongoDB Document Example
```json
{
  "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "runId": "sync-1692345678901",
  "startTimestamp": "2024-08-18T10:30:00.000Z",
  "endTimestamp": "2024-08-18T10:30:15.300Z",
  "status": "completed",
  
  "configuration": {
    "providers": ["stripe", "square"],
    "limit": null,
    "dryRun": false,
    "options": {}
  },
  
  "actions": [
    {
      "id": "action-uuid-1",
      "timestamp": "2024-08-18T10:30:00.100Z",
      "operation": "initialization",
      "entity": "database",
      "status": "completed",
      "message": "Collections ensured and contacts map cleared",
      "duration": 50
    },
    {
      "id": "action-uuid-2",
      "timestamp": "2024-08-18T10:30:00.200Z",
      "operation": "payment_processing",
      "entity": "payment",
      "entityId": "ch_1234567890",
      "provider": "stripe",
      "status": "completed",
      "message": "Stripe charge processed successfully (production eligible)",
      "duration": 150,
      "details": {
        "shouldMoveToProduction": true,
        "amount": 5000,
        "status": "succeeded",
        "paid": true
      }
    },
    {
      "id": "action-uuid-3",
      "timestamp": "2024-08-18T10:30:05.100Z",
      "operation": "payment_processing",
      "entity": "payment",
      "entityId": "sqpmt_1234567890",
      "provider": "square",
      "status": "failed",
      "message": "Payment not found in Supabase",
      "duration": 80,
      "error": {
        "message": "No registration found for payment ID: sqpmt_1234567890",
        "code": "REGISTRATION_NOT_FOUND"
      }
    }
  ],
  
  "statistics": {
    "totalRecords": 150,
    "processed": 142,
    "successful": 138,
    "failed": 4,
    "skipped": 8,
    "errors": 4,
    "warnings": 8,
    "duration": 15300,
    "ratePerSecond": 9.28
  },
  
  "summary": {
    "totalDuration": 15300,
    "operationsPerformed": [
      "initialization",
      "provider_processing", 
      "payment_processing",
      "selective_sync",
      "error_verification"
    ],
    "entitiesProcessed": [
      "database",
      "provider", 
      "payment",
      "production",
      "verification"
    ],
    "providersUsed": ["stripe", "square"],
    "errorSummary": [
      "payment_processing:payment - Payment not found in Supabase",
      "payment_processing:payment - Invalid payment amount",
      "provider_processing:provider - API rate limit exceeded"
    ],
    "warningSummary": [
      "payment_processing:payment - Payment already exists",
      "payment_processing:payment - Partial refund detected"
    ]
  },
  
  "environment": {
    "nodeVersion": "v18.17.0",
    "timestamp": "2024-08-18T10:30:00.000Z",
    "hostname": "sync-server-01"
  },
  
  "createdAt": "2024-08-18T10:30:00.000Z",
  "updatedAt": "2024-08-18T10:30:15.300Z"
}
```

## Integration Points

### Enhanced Payment Sync Integration
The sync logger is integrated into `enhanced-payment-sync.ts` at these key points:

1. **Session Start**: Initialize logger with configuration
2. **Provider Processing**: Log each provider's start/completion/errors
3. **Payment Processing**: Log individual payment processing with detailed context
4. **Selective Sync**: Track production sync operations
5. **Error Verification**: Log verification steps
6. **Session End**: Finalize with statistics and summary

### Usage Example
```typescript
// Initialize sync logger
const syncConfig: SyncConfiguration = {
  providers: this.providers.map(p => p.name),
  limit: options.limit,
  dryRun: false,
  options: options
};

this.syncLogger = new SyncLogger(db, this.syncRunId, syncConfig);
await this.syncLogger.startSession('Enhanced Payment Sync Started');

// Log individual operations
const actionId = this.syncLogger.logAction(
  'payment_processing', 
  'payment', 
  payment.id, 
  'started', 
  `Processing payment: ${payment.id}`, 
  'stripe'
);

// Update on completion
this.syncLogger.updateAction(
  actionId, 
  'completed', 
  'Payment processed successfully',
  { amount: payment.amount, status: payment.status }
);

// End session
await this.syncLogger.endSession('completed', 'Sync completed successfully');
```

## Querying Sync Logs

### Common Queries
```typescript
// Get recent sync sessions
const recentSyncs = await SyncLogger.queryLogs(db, {}, 10);

// Get failed sessions
const failedSyncs = await SyncLogger.queryLogs(db, { status: 'failed' });

// Get sessions with errors
const errorSyncs = await SyncLogger.queryLogs(db, { hasErrors: true });

// Get sessions from today
const todaySyncs = await SyncLogger.queryLogs(db, { 
  startDate: new Date(new Date().setHours(0, 0, 0, 0)) 
});

// Get statistics summary
const stats = await SyncLogger.getStatisticsSummary(db, 7); // Last 7 days
```

### MongoDB Aggregation Examples
```javascript
// Error analysis by provider
db.sync_log.aggregate([
  { $unwind: "$actions" },
  { $match: { "actions.status": "failed" } },
  { $group: { 
    _id: "$actions.provider", 
    errorCount: { $sum: 1 },
    errors: { $push: "$actions.message" }
  }}
]);

// Performance trends
db.sync_log.aggregate([
  { $match: { status: "completed" } },
  { $group: {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$startTimestamp" } },
    avgDuration: { $avg: "$statistics.duration" },
    avgRate: { $avg: "$statistics.ratePerSecond" },
    totalRecords: { $sum: "$statistics.processed" }
  }},
  { $sort: { "_id": 1 } }
]);
```

## Performance Benefits

1. **Centralized Logging**: All sync operations tracked in one place
2. **Detailed Context**: Each action includes timing, provider, and result details
3. **Error Tracking**: Full error context with stack traces
4. **Performance Metrics**: Duration tracking and rate calculations
5. **Historical Analysis**: Trend analysis and pattern detection
6. **Debugging Support**: Detailed action logs for troubleshooting

## Maintenance

### Cleanup Old Logs
```typescript
// Clean up logs older than 30 days
const deletedCount = await SyncLogger.cleanupOldLogs(db, 30);
console.log(`Cleaned up ${deletedCount} old log entries`);
```

### Index Recommendations
The logger automatically creates these indexes:
- `{ sessionId: 1 }`
- `{ runId: 1 }`
- `{ startTimestamp: -1 }`
- `{ status: 1 }`
- `{ 'configuration.providers': 1 }`

For additional performance, consider:
```javascript
// For error analysis
db.sync_log.createIndex({ "statistics.errors": 1 });

// For provider-specific queries
db.sync_log.createIndex({ "actions.provider": 1 });

// For operation-specific queries
db.sync_log.createIndex({ "actions.operation": 1 });
```