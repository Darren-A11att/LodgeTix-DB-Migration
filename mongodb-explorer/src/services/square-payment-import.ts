import { Db } from 'mongodb';
import { PaymentImport, ImportBatch } from '../types/payment-import';

const square = require('square');

/**
 * Square Payment Import Service
 * 
 * Handles importing payments from Square API into the payment_imports collection
 * for reconciliation with Supabase registrations
 */

export class SquarePaymentImportService {
  private db: Db;
  private squareClient: any;
  
  constructor(db: Db, squareAccessToken: string, environment: string = 'production') {
    this.db = db;
    this.squareClient = new square.SquareClient({
      accessToken: squareAccessToken,
      environment: environment === 'production' ? square.SquareEnvironment.Production : square.SquareEnvironment.Sandbox
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
        // Fetch payments from Square
        const response = await this.squareClient.paymentsApi.listPayments(
          options.startDate.toISOString(),
          options.endDate.toISOString(),
          'ASC',
          cursor,
          undefined, // location ID (we'll filter after if needed)
          undefined, // total
          undefined, // last4
          undefined, // cardBrand
          100        // limit
        );
        
        if (!response.result.payments || response.result.payments.length === 0) {
          break;
        }
        
        // Process each payment
        for (const squarePayment of response.result.payments) {
          totalProcessed++;
          
          // Skip if already imported
          if (existingPaymentIds.has(squarePayment.id!)) {
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
            
            // Also insert to unified 'payments' collection for new unified structure
            if (paymentImport.unifiedPayment) {
              try {
                await this.db.collection('payments').insertOne(paymentImport.unifiedPayment);
              } catch (unifiedError) {
                console.warn(`Warning: Could not add to unified payments - ${unifiedError}`);
              }
            }
            
            batch.importedPayments++;
            
          } catch (error) {
            console.error(`Error importing payment ${squarePayment.id}:`, error);
            batch.failedPayments++;
          }
        }
        
        batch.totalPayments = totalProcessed;
        cursor = response.result.cursor;
        
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
      batch.error = error instanceof Error ? error.message : 'Unknown error';
      
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
   * Get list of already imported Square payment IDs
   */
  private async getExistingPaymentIds(): Promise<Set<string>> {
    const existingPayments = await this.db.collection<PaymentImport>('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    return new Set(existingPayments.map(p => p.squarePaymentId));
  }
  
  /**
   * Convert Square payment to PaymentImport format with unified structure
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
        const orderResponse = await this.squareClient.ordersApi.retrieveOrder(squarePayment.orderId);
        const order = orderResponse.result.order;
        
        // Extract reference from order metadata or line items
        if (order?.metadata) {
          orderReference = order.metadata.reference || order.metadata.confirmation_number;
        }
        
        orderDetails = order;
      } catch (error) {
        console.warn(`Could not fetch order details for ${squarePayment.orderId}:`, error);
      }
    }
    
    // Create unified payment structure
    const unifiedPayment = {
      // Core Identity (unified schema)
      id: `square_${squarePayment.id}`, // Unified payment ID
      sourcePaymentId: squarePayment.id, // Original ID from source
      source: 'square' as const,
      
      // Amount Fields (normalized)
      amount: amountInDollars,
      currency: currency.toUpperCase(),
      
      // Status (normalized)
      status: this.normalizeSquareStatus(squarePayment.status || 'UNKNOWN'),
      statusOriginal: squarePayment.status || 'UNKNOWN',
      
      // Timestamps
      createdAt: new Date(squarePayment.createdAt!),
      
      // Customer Data
      customerEmail: squarePayment.buyerEmailAddress || null,
      customerName: customerName || null,
      customerId: squarePayment.customerId || null,
      
      // References
      orderId: squarePayment.orderId || null,
      registrationId: null, // Will be populated by matching logic
      
      // Invoice Fields
      receiptEmail: squarePayment.buyerEmailAddress || null,
      billingAddress: this.extractBillingAddress(squarePayment),
      
      // Preserve Original
      rawData: squarePayment
    };
    
    const paymentImport: PaymentImport = {
      importId,
      importedAt: new Date(),
      importedBy,
      
      // Legacy Square Payment Data (for backward compatibility)
      squarePaymentId: squarePayment.id!,
      transactionId: squarePayment.id!,
      amount: amountInDollars,
      amountFormatted,
      currency,
      status: squarePayment.status || 'UNKNOWN',
      createdAt: new Date(squarePayment.createdAt!),
      updatedAt: new Date(squarePayment.updatedAt || squarePayment.createdAt!),
      
      // Customer Information (legacy)
      customerEmail: squarePayment.buyerEmailAddress,
      customerName,
      buyerId: squarePayment.customerId,
      
      // Payment Details (legacy)
      paymentMethod: squarePayment.sourceType,
      cardBrand: cardDetails?.cardBrand,
      last4: cardDetails?.last4,
      receiptUrl: squarePayment.receiptUrl,
      
      // Processing Status
      processingStatus: 'pending',
      
      // Location Info (legacy)
      locationId: squarePayment.locationId,
      
      // Order Info (legacy)
      orderId: squarePayment.orderId,
      orderReference,
      
      // Metadata (legacy)
      metadata: {
        ...squarePayment.metadata,
        orderDetails: orderDetails ? {
          referenceId: orderDetails.referenceId,
          metadata: orderDetails.metadata,
          totalMoney: orderDetails.totalMoney
        } : undefined
      },
      
      // Raw data for reference (legacy)
      rawSquareData: squarePayment,
      
      // NEW: Unified payment structure
      unifiedPayment: unifiedPayment
    };
    
    return paymentImport;
  }
  
  /**
   * Normalize Square payment status to unified status
   */
  private normalizeSquareStatus(squareStatus: string): 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled' {
    const STATUS_MAP: Record<string, 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled'> = {
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'REFUNDED': 'refunded',
      'CANCELED': 'cancelled',
      'PENDING': 'pending'
    };
    
    return STATUS_MAP[squareStatus] || 'pending';
  }
  
  /**
   * Extract billing address for invoice generation
   */
  private extractBillingAddress(payment: any) {
    // Try billing address first
    if (payment.billingAddress) {
      return {
        name: payment.billingAddress.name || null,
        firstName: payment.billingAddress.firstName || null,
        lastName: payment.billingAddress.lastName || null,
        addressLine1: payment.billingAddress.addressLine1 || null,
        addressLine2: payment.billingAddress.addressLine2 || null,
        locality: payment.billingAddress.locality || null,
        administrativeDistrictLevel1: payment.billingAddress.administrativeDistrictLevel1 || null,
        postalCode: payment.billingAddress.postalCode || null,
        country: payment.billingAddress.country || null,
        phone: payment.billingAddress.phone || null
      };
    }
    
    // Try shipping address as fallback
    if (payment.shippingAddress) {
      return {
        name: payment.shippingAddress.name || null,
        firstName: payment.shippingAddress.firstName || null,  
        lastName: payment.shippingAddress.lastName || null,
        addressLine1: payment.shippingAddress.addressLine1 || null,
        addressLine2: payment.shippingAddress.addressLine2 || null,
        locality: payment.shippingAddress.locality || null,
        administrativeDistrictLevel1: payment.shippingAddress.administrativeDistrictLevel1 || null,
        postalCode: payment.shippingAddress.postalCode || null,
        country: payment.shippingAddress.country || null,
        phone: payment.shippingAddress.phone || null
      };
    }
    
    return null;
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
  const service = new SquarePaymentImportService(db, squareAccessToken, options.environment);
  
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