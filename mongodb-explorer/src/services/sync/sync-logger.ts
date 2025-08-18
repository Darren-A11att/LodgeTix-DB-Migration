import { MongoClient, Db, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

// Sync log document interfaces
export interface SyncAction {
  id: string;
  timestamp: Date;
  operation: string;
  entity: string;
  entityId?: string;
  provider?: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  message: string;
  duration?: number; // milliseconds
  details?: any;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface SyncStatistics {
  totalRecords: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: number;
  warnings: number;
  duration: number; // milliseconds
  ratePerSecond?: number;
}

export interface SyncConfiguration {
  providers: string[];
  limit?: number;
  dryRun: boolean;
  options: any;
  filters?: any;
}

export interface SyncLogDocument {
  _id?: ObjectId;
  sessionId: string;
  runId: string;
  startTimestamp: Date;
  endTimestamp?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  configuration: SyncConfiguration;
  actions: SyncAction[];
  statistics: SyncStatistics;
  summary: {
    totalDuration: number;
    operationsPerformed: string[];
    entitiesProcessed: string[];
    providersUsed: string[];
    errorSummary: string[];
    warningSummary: string[];
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

export interface SyncLogQuery {
  sessionId?: string;
  runId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  hasErrors?: boolean;
}

export class SyncLogger {
  private db: Db;
  private sessionId: string;
  private runId: string;
  private startTime: Date;
  private actions: SyncAction[] = [];
  private statistics: SyncStatistics;
  private configuration: SyncConfiguration;
  private logDocument: SyncLogDocument;
  private actionStartTimes: Map<string, number> = new Map();

  constructor(
    db: Db, 
    runId?: string, 
    configuration?: Partial<SyncConfiguration>
  ) {
    this.db = db;
    this.sessionId = uuidv4();
    this.runId = runId || `sync-${Date.now()}`;
    this.startTime = new Date();
    
    this.statistics = {
      totalRecords: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      warnings: 0,
      duration: 0
    };

    this.configuration = {
      providers: [],
      dryRun: false,
      options: {},
      ...configuration
    };

    this.logDocument = {
      sessionId: this.sessionId,
      runId: this.runId,
      startTimestamp: this.startTime,
      status: 'running',
      configuration: this.configuration,
      actions: [],
      statistics: this.statistics,
      summary: {
        totalDuration: 0,
        operationsPerformed: [],
        entitiesProcessed: [],
        providersUsed: this.configuration.providers,
        errorSummary: [],
        warningSummary: []
      },
      environment: {
        nodeVersion: process.version,
        timestamp: new Date(),
        hostname: process.env.HOSTNAME,
        version: process.env.npm_package_version
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Initialize sync session and create log document
  async startSession(message: string = 'Sync session started'): Promise<void> {
    await this.ensureCollections();
    
    const result = await this.db.collection('sync_log').insertOne(this.logDocument);
    this.logDocument._id = result.insertedId;
    
    this.logAction('session', 'session', undefined, 'started', message);
    console.log(`[SYNC] ${message} - Session ID: ${this.sessionId}`);
  }

  // Log individual actions
  logAction(
    operation: string,
    entity: string,
    entityId?: string,
    status: 'started' | 'completed' | 'failed' | 'skipped' = 'started',
    message: string = '',
    provider?: string,
    details?: any
  ): string {
    const actionId = uuidv4();
    const timestamp = new Date();
    
    if (status === 'started') {
      this.actionStartTimes.set(actionId, Date.now());
    }

    const action: SyncAction = {
      id: actionId,
      timestamp,
      operation,
      entity,
      entityId,
      provider,
      status,
      message,
      details
    };

    // Calculate duration if action is completing
    if (status !== 'started') {
      const startTime = this.actionStartTimes.get(actionId);
      if (startTime) {
        action.duration = Date.now() - startTime;
        this.actionStartTimes.delete(actionId);
      }
    }

    this.actions.push(action);
    
    // Update statistics based on action
    this.updateStatistics(action);
    
    // Log to console with appropriate level
    const logLevel = status === 'failed' ? 'ERROR' : status === 'skipped' ? 'WARN' : 'INFO';
    const providerInfo = provider ? ` [${provider}]` : '';
    const entityInfo = entityId ? ` ${entityId}` : '';
    console.log(`[SYNC:${logLevel}]${providerInfo} ${operation}:${entity}${entityInfo} - ${message}`);
    
    return actionId;
  }

  // Log errors with full context
  logError(
    operation: string,
    entity: string,
    error: Error,
    entityId?: string,
    provider?: string,
    details?: any
  ): string {
    const action: SyncAction = {
      id: uuidv4(),
      timestamp: new Date(),
      operation,
      entity,
      entityId,
      provider,
      status: 'failed',
      message: error.message,
      details,
      error: {
        message: error.message,
        code: (error as any).code,
        stack: error.stack
      }
    };

    this.actions.push(action);
    this.statistics.errors++;
    this.statistics.failed++;
    
    const providerInfo = provider ? ` [${provider}]` : '';
    const entityInfo = entityId ? ` ${entityId}` : '';
    console.error(`[SYNC:ERROR]${providerInfo} ${operation}:${entity}${entityInfo} - ${error.message}`);
    
    return action.id;
  }

  // Log warnings
  logWarning(
    operation: string,
    entity: string,
    message: string,
    entityId?: string,
    provider?: string,
    details?: any
  ): string {
    const action: SyncAction = {
      id: uuidv4(),
      timestamp: new Date(),
      operation,
      entity,
      entityId,
      provider,
      status: 'skipped',
      message,
      details
    };

    this.actions.push(action);
    this.statistics.warnings++;
    this.statistics.skipped++;
    
    const providerInfo = provider ? ` [${provider}]` : '';
    const entityInfo = entityId ? ` ${entityId}` : '';
    console.warn(`[SYNC:WARN]${providerInfo} ${operation}:${entity}${entityInfo} - ${message}`);
    
    return action.id;
  }

  // Update an existing action (e.g., from 'started' to 'completed')
  updateAction(
    actionId: string,
    status: 'completed' | 'failed' | 'skipped',
    message?: string,
    details?: any
  ): void {
    const action = this.actions.find(a => a.id === actionId);
    if (action) {
      const startTime = this.actionStartTimes.get(actionId);
      if (startTime) {
        action.duration = Date.now() - startTime;
        this.actionStartTimes.delete(actionId);
      }
      
      action.status = status;
      if (message) action.message = message;
      if (details) action.details = { ...action.details, ...details };
      
      this.updateStatistics(action);
      
      const logLevel = status === 'failed' ? 'ERROR' : status === 'skipped' ? 'WARN' : 'INFO';
      const providerInfo = action.provider ? ` [${action.provider}]` : '';
      const entityInfo = action.entityId ? ` ${action.entityId}` : '';
      const durationInfo = action.duration ? ` (${action.duration}ms)` : '';
      console.log(`[SYNC:${logLevel}]${providerInfo} ${action.operation}:${action.entity}${entityInfo} - ${action.message}${durationInfo}`);
    }
  }

  // Update statistics based on action
  private updateStatistics(action: SyncAction): void {
    switch (action.status) {
      case 'completed':
        this.statistics.successful++;
        this.statistics.processed++;
        break;
      case 'failed':
        this.statistics.failed++;
        this.statistics.processed++;
        if (!action.error) this.statistics.errors++;
        break;
      case 'skipped':
        this.statistics.skipped++;
        if (!action.details?.isWarning) this.statistics.warnings++;
        break;
    }
  }

  // Set total records to process
  setTotalRecords(count: number): void {
    this.statistics.totalRecords = count;
    console.log(`[SYNC] Processing ${count} total records`);
  }

  // Get current statistics
  getStatistics(): SyncStatistics {
    const duration = Date.now() - this.startTime.getTime();
    return {
      ...this.statistics,
      duration,
      ratePerSecond: duration > 0 ? (this.statistics.processed * 1000) / duration : 0
    };
  }

  // End sync session and save final log
  async endSession(status: 'completed' | 'failed' | 'cancelled' = 'completed', message?: string): Promise<void> {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();
    
    // Finalize statistics
    this.statistics.duration = totalDuration;
    this.statistics.ratePerSecond = totalDuration > 0 ? (this.statistics.processed * 1000) / totalDuration : 0;
    
    // Build summary
    const operationsSet = new Set(this.actions.map(a => a.operation));
    const entitiesSet = new Set(this.actions.map(a => a.entity));
    const providersSet = new Set(this.actions.map(a => a.provider).filter(Boolean));
    
    const summary = {
      totalDuration,
      operationsPerformed: Array.from(operationsSet),
      entitiesProcessed: Array.from(entitiesSet),
      providersUsed: Array.from(providersSet),
      errorSummary: this.actions
        .filter(a => a.status === 'failed')
        .map(a => `${a.operation}:${a.entity} - ${a.message}`)
        .slice(0, 10), // Limit to first 10 errors
      warningSummary: this.actions
        .filter(a => a.status === 'skipped')
        .map(a => `${a.operation}:${a.entity} - ${a.message}`)
        .slice(0, 10) // Limit to first 10 warnings
    };

    // Update the log document
    await this.db.collection('sync_log').updateOne(
      { _id: this.logDocument._id },
      {
        $set: {
          endTimestamp: endTime,
          status,
          actions: this.actions,
          statistics: this.statistics,
          summary,
          updatedAt: new Date()
        }
      }
    );

    // Log final summary
    const finalMessage = message || `Sync session ${status}`;
    this.logAction('session', 'session', undefined, status === 'completed' ? 'completed' : 'failed', finalMessage);
    
    console.log(`\n[SYNC] === SESSION SUMMARY ===`);
    console.log(`Session ID: ${this.sessionId}`);
    console.log(`Status: ${status.toUpperCase()}`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Total Records: ${this.statistics.totalRecords}`);
    console.log(`Processed: ${this.statistics.processed}`);
    console.log(`Successful: ${this.statistics.successful}`);
    console.log(`Failed: ${this.statistics.failed}`);
    console.log(`Skipped: ${this.statistics.skipped}`);
    console.log(`Errors: ${this.statistics.errors}`);
    console.log(`Warnings: ${this.statistics.warnings}`);
    if (this.statistics.ratePerSecond) {
      console.log(`Rate: ${this.statistics.ratePerSecond.toFixed(2)} records/second`);
    }
    console.log(`Operations: ${summary.operationsPerformed.join(', ')}`);
    console.log(`Entities: ${summary.entitiesProcessed.join(', ')}`);
    if (summary.providersUsed.length > 0) {
      console.log(`Providers: ${summary.providersUsed.join(', ')}`);
    }
    console.log(`=== END SUMMARY ===\n`);
  }

  // Get session ID for external reference
  getSessionId(): string {
    return this.sessionId;
  }

  // Get run ID for external reference
  getRunId(): string {
    return this.runId;
  }

  // Ensure required collections exist
  private async ensureCollections(): Promise<void> {
    const collections = await this.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('sync_log')) {
      await this.db.createCollection('sync_log');
      
      // Create indexes for efficient querying
      await this.db.collection('sync_log').createIndex({ sessionId: 1 });
      await this.db.collection('sync_log').createIndex({ runId: 1 });
      await this.db.collection('sync_log').createIndex({ startTimestamp: -1 });
      await this.db.collection('sync_log').createIndex({ status: 1 });
      await this.db.collection('sync_log').createIndex({ 'configuration.providers': 1 });
    }
  }

  // Static method to query sync logs
  static async queryLogs(
    db: Db,
    query: SyncLogQuery = {},
    limit: number = 50,
    sort: any = { startTimestamp: -1 }
  ): Promise<SyncLogDocument[]> {
    const filter: any = {};
    
    if (query.sessionId) filter.sessionId = query.sessionId;
    if (query.runId) filter.runId = query.runId;
    if (query.status) filter.status = query.status;
    if (query.hasErrors) filter['statistics.errors'] = { $gt: 0 };
    
    if (query.startDate || query.endDate) {
      filter.startTimestamp = {};
      if (query.startDate) filter.startTimestamp.$gte = query.startDate;
      if (query.endDate) filter.startTimestamp.$lte = query.endDate;
    }
    
    return await db.collection('sync_log')
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray() as SyncLogDocument[];
  }

  // Static method to get sync statistics summary
  static async getStatisticsSummary(
    db: Db,
    days: number = 7
  ): Promise<any> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    const pipeline = [
      {
        $match: {
          startTimestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalRecordsProcessed: { $sum: '$statistics.processed' },
          totalSuccessful: { $sum: '$statistics.successful' },
          totalFailed: { $sum: '$statistics.failed' },
          totalErrors: { $sum: '$statistics.errors' },
          totalWarnings: { $sum: '$statistics.warnings' },
          avgDuration: { $avg: '$statistics.duration' },
          avgRatePerSecond: { $avg: '$statistics.ratePerSecond' }
        }
      }
    ];
    
    const result = await db.collection('sync_log').aggregate(pipeline).toArray();
    return result[0] || {
      totalSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      totalRecordsProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalErrors: 0,
      totalWarnings: 0,
      avgDuration: 0,
      avgRatePerSecond: 0
    };
  }

  // Static method to clean up old logs
  static async cleanupOldLogs(
    db: Db,
    daysToKeep: number = 30
  ): Promise<number> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const result = await db.collection('sync_log').deleteMany({
      startTimestamp: { $lt: cutoffDate }
    });
    
    return result.deletedCount;
  }
}