import { Db } from 'mongodb';
import { PaymentImport, ImportBatch } from '../types/payment-import';

// Import Square SDK components
import { SquareClient, SquareEnvironment } from 'square';

/**
 * Square Payment Import Service V2
 * Updated for Square SDK v43
 * 
 * Handles importing payments from Square API into the payment_imports collection
 * for reconciliation with Supabase registrations
 */

export class SquarePaymentImportServiceV2 {
  private db: Db;
  private squareClient: SquareClient;
  
  constructor(db: Db, squareAccessToken: string, environment: string = 'production') {
    this.db = db;
    
    console.log('Initializing Square client...');
    console.log('Environment:', environment);
    console.log('Token exists:', !!squareAccessToken);
    console.log('Token length:', squareAccessToken?.length);
    console.log('Token prefix:', squareAccessToken?.substring(0, 4));
    console.log('Database name:', db.databaseName);
    
    this.squareClient = new SquareClient({
      token: squareAccessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
  }
  
  /**
   * Import payments from Square for a given date range
   */
  async importPayments(options: {
    startDate: Date;
    endDate: Date;
    locationIds?: string[];
    importedBy: string;
  }): Promise<ImportBatch> {
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create import batch record
    const batch: ImportBatch = {
      batchId,
      startedAt: new Date(),
      startedBy: options.importedBy,
      dateRange: {
        start: options.startDate,
        end: options.endDate
      },
      locationIds: options.locationIds,
      totalPayments: 0,
      importedPayments: 0,
      skippedPayments: 0,
      failedPayments: 0,
      status: 'running'
    };
    
    await this.db.collection<ImportBatch>('import_batches').insertOne(batch);
    
    try {
      // Get existing payment IDs to avoid duplicates
      const existingPaymentIds = await this.getExistingPaymentIds();
      
      let cursor: string | undefined;
      let totalProcessed = 0;
      
      do {
        // Fetch payments from Square using the new SDK
        console.log('Fetching payments from Square API...');
        console.log('Date range:', options.startDate.toISOString(), 'to', options.endDate.toISOString());
        
        const response = await this.squareClient.payments.list({
          beginTime: options.startDate.toISOString(),
          endTime: options.endDate.toISOString(),
          sortOrder: 'ASC',
          cursor: cursor,
          limit: 100
        });
        
        // Log the response structure to debug
        console.log('Square API raw response structure:', {
          hasResponse: !!response.response,
          hasResult: !!response.result,
          responseKeys: response.response ? Object.keys(response.response) : [],
          resultKeys: response.result ? Object.keys(response.result) : []
        });
        
        // Check for errors in the response
        if (response.errors && response.errors.length > 0) {
          console.error('Square API errors:', response.errors);
          const error = response.errors[0];
          throw new Error(`Square API error: ${error.code} - ${error.detail || error.category}`);
        }
        
        // Handle the actual Square SDK response structure
        const payments = response.response?.payments || response.result?.payments || [];
        
        console.log('Payments found in batch:', payments.length);
        
        if (!payments || payments.length === 0) {
          console.log('No payments found in this batch');
          break;
        }
        
        // Process each payment
        for (const squarePayment of payments) {
          totalProcessed++;
          
          // Skip if already imported or exists in payments collection
          if (existingPaymentIds.has(squarePayment.id!)) {
            console.log(`Skipping payment ${squarePayment.id} - already exists in database`);
            batch.skippedPayments++;
            continue;
          }
          
          // Filter by location if specified
          if (options.locationIds && options.locationIds.length > 0) {
            if (!squarePayment.locationId || !options.locationIds.includes(squarePayment.locationId)) {
              batch.skippedPayments++;
              continue;
            }
          }
          
          try {
            // Convert to PaymentImport format
            const paymentImport = await this.convertToPaymentImport(
              squarePayment,
              importId,
              options.importedBy
            );
            
            // Insert into payment_imports collection
            await this.db.collection<PaymentImport>('payment_imports').insertOne(paymentImport);
            batch.importedPayments++;
            
          } catch (error) {
            console.error(`Error importing payment ${squarePayment.id}:`, error);
            batch.failedPayments++;
          }
        }
        
        batch.totalPayments = totalProcessed;
        cursor = response.response?.cursor || response.result?.cursor;
        
        // Update batch progress
        await this.db.collection<ImportBatch>('import_batches').updateOne(
          { batchId },
          {
            $set: {
              totalPayments: batch.totalPayments,
              importedPayments: batch.importedPayments,
              skippedPayments: batch.skippedPayments,
              failedPayments: batch.failedPayments
            }
          }
        );
        
      } while (cursor);
      
      // Complete the batch
      batch.status = 'completed';
      batch.completedAt = new Date();
      batch.processingTimeMs = batch.completedAt.getTime() - batch.startedAt.getTime();
      batch.averageTimePerPayment = batch.totalPayments > 0 
        ? batch.processingTimeMs / batch.totalPayments 
        : 0;
      
      await this.db.collection<ImportBatch>('import_batches').updateOne(
        { batchId },
        {
          $set: {
            status: batch.status,
            completedAt: batch.completedAt,
            processingTimeMs: batch.processingTimeMs,
            averageTimePerPayment: batch.averageTimePerPayment
          }
        }
      );
      
      return batch;
      
    } catch (error) {
      // Mark batch as failed
      batch.status = 'failed';
      
      // Enhanced error handling for better debugging
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Import failed with error:', error.message);
        console.error('Error stack:', error.stack);
        
        // Check for specific Square API errors
        if (error.message.includes('AUTHENTICATION_ERROR') || error.message.includes('UNAUTHORIZED')) {
          errorMessage = 'Square API authentication failed. Please check your access token.';
          console.error('Authentication error detected. Token may be invalid or expired.');
        }
      }
      
      batch.error = errorMessage;
      
      await this.db.collection<ImportBatch>('import_batches').updateOne(
        { batchId },
        {
          $set: {
            status: batch.status,
            error: batch.error
          }
        }
      );
      
      throw error;
    }
  }
  
  /**
   * Get list of already imported Square payment IDs from both collections
   */
  private async getExistingPaymentIds(): Promise<Set<string>> {
    // Check payment_imports collection
    const existingImports = await this.db.collection<PaymentImport>('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    // Check main payments collection using paymentId field
    const existingPayments = await this.db.collection('payments')
      .find(
        { paymentId: { $exists: true } },
        { projection: { paymentId: 1 } }
      )
      .toArray();
    
    // Combine both sets of IDs
    const allPaymentIds = new Set<string>();
    
    // Add from payment_imports
    existingImports.forEach(p => allPaymentIds.add(p.squarePaymentId));
    
    // Add from payments collection
    existingPayments.forEach(p => {
      if (p.paymentId) {
        allPaymentIds.add(p.paymentId);
      }
    });
    
    console.log(`Found ${existingImports.length} in payment_imports, ${existingPayments.length} in payments collection`);
    console.log(`Total unique payment IDs to skip: ${allPaymentIds.size}`);
    
    return allPaymentIds;
  }
  
  /**
   * Convert Square payment to PaymentImport format
   */
  private async convertToPaymentImport(
    squarePayment: any,
    importId: string,
    importedBy: string
  ): Promise<PaymentImport> {
    // Parse amounts (Square uses smallest currency unit)
    const amount = squarePayment.amountMoney 
      ? parseInt(squarePayment.amountMoney.amount) 
      : 0;
    
    const currency = squarePayment.amountMoney?.currency || 'USD';
    const divisor = currency === 'JPY' ? 1 : 100; // Most currencies use cents, JPY doesn't
    
    const amountInDollars = amount / divisor;
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amountInDollars);
    
    // Extract customer info
    let customerName = undefined;
    if (squarePayment.shippingAddress) {
      const firstName = squarePayment.shippingAddress.firstName || '';
      const lastName = squarePayment.shippingAddress.lastName || '';
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    }
    
    // Extract card details
    const cardDetails = squarePayment.cardDetails?.card;
    
    // Get order details if available
    let orderReference = undefined;
    let orderDetails = undefined;
    
    if (squarePayment.orderId) {
      try {
        const orderResponse = await this.squareClient.orders.retrieve({
          orderId: squarePayment.orderId
        });
        const order = orderResponse.result?.order;
        
        // Extract reference from order metadata or line items
        if (order?.metadata) {
          orderReference = order.metadata.reference || order.metadata.confirmation_number;
        }
        
        orderDetails = order;
      } catch (error) {
        console.warn(`Could not fetch order details for ${squarePayment.orderId}:`, error);
      }
    }
    
    const paymentImport: PaymentImport = {
      // === Our Import Tracking Fields ===
      importId,
      importedAt: new Date(),
      importedBy,
      processingStatus: 'pending',
      
      // === Key Fields Extracted for Search/Display ===
      squarePaymentId: squarePayment.id!,
      transactionId: squarePayment.id!,
      amount: amountInDollars,
      amountFormatted,
      currency,
      status: squarePayment.status || 'UNKNOWN',
      createdAt: new Date(squarePayment.createdAt!),
      updatedAt: new Date(squarePayment.updatedAt || squarePayment.createdAt!),
      
      // Customer Information
      customerEmail: squarePayment.buyerEmailAddress,
      customerName,
      buyerId: squarePayment.customerId,
      
      // Payment Details
      paymentMethod: squarePayment.sourceType,
      cardBrand: cardDetails?.cardBrand,
      last4: cardDetails?.last4,
      receiptUrl: squarePayment.receiptUrl,
      
      // Location Info
      locationId: squarePayment.locationId,
      
      // Order Info
      orderId: squarePayment.orderId,
      orderReference,
      
      // Metadata (combination of Square metadata and our additions)
      metadata: {
        ...squarePayment.metadata,
        orderDetails: orderDetails ? {
          referenceId: orderDetails.referenceId,
          metadata: orderDetails.metadata,
          totalMoney: orderDetails.totalMoney
        } : undefined
      },
      
      // === Original Payment Gateway Response ===
      paymentGatewayData: squarePayment
    };
    
    return paymentImport;
  }
  
  /**
   * Get payment by Square payment ID
   */
  async getPaymentBySquareId(squarePaymentId: string): Promise<PaymentImport | null> {
    return await this.db.collection<PaymentImport>('payment_imports').findOne({
      squarePaymentId
    });
  }
  
  /**
   * Update payment processing status
   */
  async updatePaymentStatus(
    squarePaymentId: string,
    status: PaymentImport['processingStatus'],
    updates: Partial<PaymentImport> = {}
  ): Promise<boolean> {
    const result = await this.db.collection<PaymentImport>('payment_imports').updateOne(
      { squarePaymentId },
      {
        $set: {
          processingStatus: status,
          ...updates
        }
      }
    );
    
    return result.modifiedCount > 0;
  }
  
  /**
   * Get import statistics
   */
  async getImportStats(importId?: string): Promise<{
    total: number;
    pending: number;
    matched: number;
    imported: number;
    failed: number;
    skipped: number;
  }> {
    const match = importId ? { importId } : {};
    
    const stats = await this.db.collection<PaymentImport>('payment_imports').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$processingStatus',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const statusCounts = stats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);
    
    const total = await this.db.collection<PaymentImport>('payment_imports')
      .countDocuments(match);
    
    return {
      total,
      pending: statusCounts.pending || 0,
      matched: statusCounts.matched || 0,
      imported: statusCounts.imported || 0,
      failed: statusCounts.failed || 0,
      skipped: statusCounts.skipped || 0
    };
  }
}

/**
 * Utility function to import recent Square payments
 */
export async function importRecentSquarePayments(
  db: Db,
  squareAccessToken: string,
  options: {
    daysBack?: number;
    locationIds?: string[];
    importedBy?: string;
    environment?: string;
  } = {}
): Promise<ImportBatch> {
  const service = new SquarePaymentImportServiceV2(db, squareAccessToken, options.environment);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (options.daysBack || 30));
  
  return await service.importPayments({
    startDate,
    endDate,
    locationIds: options.locationIds,
    importedBy: options.importedBy || 'system'
  });
}