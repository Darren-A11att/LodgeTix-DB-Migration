import { Db, Collection } from 'mongodb';

interface VersionedRecord {
  _id?: any;
  sourceUpdatedAt: number;  // Unix timestamp
  sourceCreatedAt: number;  // Unix timestamp
  _importedAt: number;      // Unix timestamp
  _lastSyncedAt: number;    // Unix timestamp
  _versionNumber: number;
  _versionHistory: VersionHistoryEntry[];
  _conflicts?: ConflictEntry[];
}

interface VersionHistoryEntry {
  version: number;
  timestamp: number;  // Unix timestamp
  changes: Record<string, any>;
  source: string;
  changeType: 'create' | 'update' | 'status_change' | 'manual_fix';
}

interface ConflictEntry {
  timestamp: number;  // Unix timestamp
  source: string;
  conflictingData: Record<string, any>;
  resolution: 'auto' | 'manual' | 'pending';
  resolutionReason?: string;
}

export class VersionControlService {
  constructor(private db: Db) {}

  /**
   * Determines if incoming record is newer than existing
   */
  isNewerVersion(existing: any, incoming: any, sourceType: string): boolean {
    const existingTimestamp = this.extractTimestamp(existing, sourceType);
    const incomingTimestamp = this.extractTimestamp(incoming, sourceType);
    
    if (!existingTimestamp) return true;
    if (!incomingTimestamp) return false;
    
    return incomingTimestamp > existingTimestamp;
  }

  /**
   * Extract timestamp based on source type and convert to Unix timestamp (seconds)
   */
  private extractTimestamp(record: any, sourceType: string): number | null {
    let date: Date | null = null;
    
    switch (sourceType) {
      case 'square':
        date = record.updatedAt || record.updated_at || record.createdAt || record.created_at;
        break;
      
      case 'stripe':
        // Stripe already uses Unix timestamps
        return record.updated || record.created || null;
      
      case 'supabase':
        date = record.updated_at || record.modified_at || record.created_at;
        break;
      
      case 'mongodb':
        // Check if already Unix timestamp
        if (typeof record._lastSyncedAt === 'number') {
          return record._lastSyncedAt;
        }
        if (typeof record._importedAt === 'number') {
          return record._importedAt;
        }
        // Convert from Date if needed
        date = record._lastSyncedAt || record._importedAt;
        break;
      
      default:
        date = record.updatedAt || record.updated_at || null;
    }
    
    // Convert Date to Unix timestamp (seconds)
    if (date) {
      const timestamp = date instanceof Date ? date : new Date(date);
      return Math.floor(timestamp.getTime() / 1000);
    }
    
    return null;
  }
  
  /**
   * Convert Unix timestamp to Date for display/MongoDB queries
   */
  unixToDate(unixTimestamp: number): Date {
    return new Date(unixTimestamp * 1000);
  }
  
  /**
   * Convert Date to Unix timestamp (seconds)
   */
  dateToUnix(date: Date | string | number): number {
    if (typeof date === 'number') {
      // Already Unix timestamp
      return date;
    }
    const dateObj = date instanceof Date ? date : new Date(date);
    return Math.floor(dateObj.getTime() / 1000);
  }

  /**
   * Resolve conflicts between two versions
   */
  async resolveConflict(
    existing: any,
    incoming: any,
    sourceType: string,
    strategy: 'newest' | 'source_priority' | 'manual' = 'newest'
  ): Promise<{ winner: any; conflict: ConflictEntry | null }> {
    
    if (strategy === 'newest') {
      const isNewer = this.isNewerVersion(existing, incoming, sourceType);
      
      if (isNewer) {
        return {
          winner: incoming,
          conflict: null
        };
      } else {
        // Incoming is older - create conflict record
        return {
          winner: existing,
          conflict: {
            timestamp: this.dateToUnix(new Date()),
            source: sourceType,
            conflictingData: incoming,
            resolution: 'auto',
            resolutionReason: 'Existing record is newer'
          }
        };
      }
    }
    
    // Other strategies can be implemented here
    return { winner: incoming, conflict: null };
  }

  /**
   * Create version history entry
   */
  createVersionHistoryEntry(
    oldRecord: any,
    newRecord: any,
    source: string,
    changeType: VersionHistoryEntry['changeType'] = 'update'
  ): VersionHistoryEntry {
    const changes: Record<string, any> = {};
    
    // Track what changed
    if (oldRecord) {
      for (const key in newRecord) {
        if (JSON.stringify(oldRecord[key]) !== JSON.stringify(newRecord[key])) {
          changes[key] = {
            old: oldRecord[key],
            new: newRecord[key]
          };
        }
      }
    } else {
      // New record
      changes._created = true;
    }
    
    return {
      version: (oldRecord?._versionNumber || 0) + 1,
      timestamp: this.dateToUnix(new Date()),
      changes,
      source,
      changeType
    };
  }

  /**
   * Apply version control to a record
   */
  async applyVersionControl(
    record: any,
    existingRecord: any | null,
    source: string
  ): Promise<any> {
    const now = this.dateToUnix(new Date());
    
    // Initialize version control fields
    if (!existingRecord) {
      return {
        ...record,
        _importedAt: now,
        _lastSyncedAt: now,
        _versionNumber: 1,
        _versionHistory: [
          this.createVersionHistoryEntry(null, record, source, 'create')
        ],
        sourceUpdatedAt: this.extractTimestamp(record, source) || now,
        sourceCreatedAt: this.extractTimestamp(record, source) || now
      };
    }
    
    // Update existing record with version control
    const versionEntry = this.createVersionHistoryEntry(
      existingRecord,
      record,
      source,
      this.detectChangeType(existingRecord, record)
    );
    
    return {
      ...record,
      _importedAt: existingRecord._importedAt,
      _lastSyncedAt: now,
      _versionNumber: versionEntry.version,
      _versionHistory: [
        ...(existingRecord._versionHistory || []),
        versionEntry
      ].slice(-50), // Keep last 50 versions
      _conflicts: existingRecord._conflicts,
      sourceUpdatedAt: this.extractTimestamp(record, source) || now,
      sourceCreatedAt: existingRecord.sourceCreatedAt || this.extractTimestamp(record, source) || now
    };
  }

  /**
   * Detect type of change
   */
  private detectChangeType(oldRecord: any, newRecord: any): VersionHistoryEntry['changeType'] {
    // Check for status changes
    if (oldRecord.status !== newRecord.status || 
        oldRecord.payment_status !== newRecord.payment_status ||
        oldRecord.paymentStatus !== newRecord.paymentStatus) {
      return 'status_change';
    }
    
    // Check if it's a manual fix (could be enhanced with more logic)
    if (oldRecord._lastModifiedBy === 'manual' || 
        newRecord._lastModifiedBy === 'manual') {
      return 'manual_fix';
    }
    
    return 'update';
  }

  /**
   * Propagate updates across collections
   */
  async propagateUpdates(
    record: any,
    paymentId: string,
    collections: string[]
  ): Promise<void> {
    const updatePromises = collections.map(async (collectionName) => {
      const collection = this.db.collection(collectionName);
      
      // Find existing record in target collection
      const existing = await collection.findOne({ 
        $or: [
          { squarePaymentId: paymentId },
          { stripePaymentId: paymentId },
          { paymentId: paymentId },
          { id: paymentId }
        ]
      });
      
      if (existing) {
        // Check if update is needed
        const shouldUpdate = this.isNewerVersion(existing, record, 'mongodb');
        
        if (shouldUpdate) {
          await collection.replaceOne(
            { _id: existing._id },
            await this.applyVersionControl(record, existing, 'cross-collection-sync')
          );
        }
      }
    });
    
    await Promise.all(updatePromises);
  }

  /**
   * Get complete version history for a payment
   */
  async getVersionHistory(paymentId: string): Promise<VersionHistoryEntry[]> {
    // Search across all collections for version history
    const collections = [
      'import_payments',
      'import_registrations',
      'payments',
      'registrations',
      'error_payments'
    ];
    
    const allHistories: VersionHistoryEntry[] = [];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      const record = await collection.findOne({
        $or: [
          { squarePaymentId: paymentId },
          { stripePaymentId: paymentId },
          { paymentId: paymentId },
          { id: paymentId }
        ]
      });
      
      if (record?._versionHistory) {
        allHistories.push(...record._versionHistory);
      }
    }
    
    // Sort by timestamp
    return allHistories.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Standardize timestamps in a record to Unix format
   */
  standardizeTimestamps(record: any, source: string): any {
    const standardized = { ...record };
    
    // List of timestamp fields to standardize
    const timestampFields = [
      'createdAt', 'created_at', 'created',
      'updatedAt', 'updated_at', 'updated',
      'modifiedAt', 'modified_at',
      'completedAt', 'completed_at',
      'refundedAt', 'refunded_at',
      'cancelledAt', 'cancelled_at',
      'processedAt', 'processed_at',
      'payment_date', 'registration_date',
      '_importedAt', '_lastSyncedAt',
      'sourceUpdatedAt', 'sourceCreatedAt'
    ];
    
    for (const field of timestampFields) {
      if (standardized[field]) {
        // Skip if already a Unix timestamp
        if (typeof standardized[field] === 'number' && standardized[field] < 10000000000) {
          continue;
        }
        
        // Convert to Unix timestamp
        standardized[field] = this.dateToUnix(standardized[field]);
      }
    }
    
    return standardized;
  }
}

export default VersionControlService;