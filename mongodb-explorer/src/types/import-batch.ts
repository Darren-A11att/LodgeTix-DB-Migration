export interface ImportBatch {
  batchId: string;
  startedAt: Date;
  startedBy: string;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  
  // Date range
  dateRange: {
    start: Date;
    end: Date;
  };
  
  // Location/Account filters
  locationIds?: string[];
  accountName?: string;
  
  // Metrics
  totalPayments: number;
  importedPayments: number;
  skippedPayments: number;
  failedPayments: number;
  processingTimeMs?: number;
  averageTimePerPayment?: number;
}