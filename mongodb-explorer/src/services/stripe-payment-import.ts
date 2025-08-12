import { Db } from 'mongodb';
import { PaymentImport } from '../types/payment-import';
import { ImportBatch } from '../types/import-batch';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

/**
 * Stripe Payment Import Service
 * 
 * Handles importing payments from multiple Stripe accounts and fetching
 * corresponding registrations from Supabase
 */
export class StripePaymentImportService {
  private db: Db;
  private supabaseClient: any;
  
  constructor(db: Db) {
    this.db = db;
    this.supabaseClient = createClient(config.supabase.url, config.supabase.key);
  }

  /**
   * Import payments from all three Stripe accounts
   */
  async importPaymentsFromAllAccounts(options: {
    startDate: Date;
    endDate: Date;
    importedBy: string;
  }): Promise<ImportBatch[]> {
    const accounts = [
      { account: 'account1', ...config.stripe.account1 },
      { account: 'account2', ...config.stripe.account2 },
      { account: 'account3', ...config.stripe.account3 },
    ];

    const batches: ImportBatch[] = [];

    for (const account of accounts) {
      try {
        const batch = await this.importPaymentsFromAccount({
          ...options,
          accountName: account.name,
          secretKey: account.secretKey,
        });
        batches.push(batch);
      } catch (error) {
        console.error(`Failed to import from ${account.name}:`, error);
      }
    }

    return batches;
  }
  
  /**
   * Import payments from a single Stripe account
   */
  async importPaymentsFromAccount(options: {
    startDate: Date;
    endDate: Date;
    accountName: string;
    secretKey: string;
    importedBy: string;
  }): Promise<ImportBatch> {
    const stripe = new Stripe(options.secretKey, { 
      apiVersion: '2025-07-30.basil'
    });
    
    const batchId = `STRIPE-${options.accountName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-STRIPE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create import batch record
    const batch: ImportBatch = {
      batchId,
      startedAt: new Date(),
      startedBy: options.importedBy,
      dateRange: {
        start: options.startDate,
        end: options.endDate
      },
      accountName: options.accountName,
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
      
      let hasMore = true;
      let startingAfter: string | undefined;
      let totalProcessed = 0;
      
      while (hasMore) {
        // Fetch payment intents from Stripe (using payment intents for better tracking)
        const paymentIntents = await stripe.paymentIntents.list({
          limit: 100,
          created: {
            gte: Math.floor(options.startDate.getTime() / 1000),
            lte: Math.floor(options.endDate.getTime() / 1000),
          },
          starting_after: startingAfter,
        });

        if (!paymentIntents.data || paymentIntents.data.length === 0) {
          break;
        }

        // Process each payment intent
        for (const paymentIntent of paymentIntents.data) {
          totalProcessed++;
          
          // Skip if already imported
          if (existingPaymentIds.has(paymentIntent.id)) {
            batch.skippedPayments++;
            continue;
          }
          
          // Only import completed payments (skip refunded, pending, failed, cancelled)
          if (paymentIntent.status !== 'succeeded') {
            batch.skippedPayments++;
            continue;
          }

          try {
            // Convert to PaymentImport format and fetch corresponding registration
            const paymentImport = await this.convertToPaymentImport(
              paymentIntent,
              importId,
              options.importedBy,
              options.accountName
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
            console.error(`Error importing payment ${paymentIntent.id}:`, error);
            batch.failedPayments++;
          }
        }
        
        batch.totalPayments = totalProcessed;
        hasMore = paymentIntents.has_more;
        startingAfter = paymentIntents.data[paymentIntents.data.length - 1]?.id;
        
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
      }
      
      // Complete the batch
      batch.status = 'completed';
      batch.completedAt = new Date();
      batch.processingTimeMs = batch.completedAt.getTime() - batch.startedAt.getTime();
      batch.averageTimePerPayment = batch.totalPayments > 0 
        ? batch.processingTimeMs / batch.totalPayments 
        : 0;
      
      await this.db.collection<ImportBatch>('import_batches').updateOne(
        { batchId },
        { $set: batch }
      );
      
      return batch;
      
    } catch (error: any) {
      console.error(`Stripe import error for ${options.accountName}:`, error);
      
      batch.status = 'failed';
      batch.completedAt = new Date();
      batch.error = error.message;
      
      await this.db.collection<ImportBatch>('import_batches').updateOne(
        { batchId },
        { $set: batch }
      );
      
      throw error;
    }
  }
  
  /**
   * Get existing payment IDs to avoid duplicates
   */
  private async getExistingPaymentIds(): Promise<Set<string>> {
    const existingPayments = await this.db.collection('payment_imports')
      .find({}, { projection: { paymentId: 1 } })
      .toArray();
    
    return new Set(existingPayments.map(p => p.paymentId).filter(Boolean));
  }
  
  /**
   * Convert Stripe PaymentIntent to PaymentImport format and fetch registration
   */
  private async convertToPaymentImport(
    paymentIntent: Stripe.PaymentIntent,
    importId: string,
    importedBy: string,
    accountName: string
  ): Promise<PaymentImport> {
    
    // Extract amounts
    const amount = paymentIntent.amount / 100; // Convert cents to dollars
    const currency = paymentIntent.currency.toUpperCase();
    const feeAmount = 0; // We'd need to fetch from balance transactions for exact fee
    
    // Try to fetch corresponding registration from Supabase
    let registrationData = null;
    try {
      const { data, error } = await this.supabaseClient
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();
        
      if (!error && data) {
        registrationData = data;
      }
    } catch (error) {
      console.warn(`Could not fetch registration for payment ${paymentIntent.id}:`, error);
    }
    
    const paymentImport: PaymentImport = {
      // Core Identity
      _id: undefined,
      importId,
      batchId: `STRIPE-${accountName}`,
      paymentId: paymentIntent.id,
      source: 'stripe',
      accountName: accountName,
      
      // Import Metadata
      importedAt: new Date(),
      importedBy,
      processingStatus: 'imported',
      
      // Amount Fields (normalized)
      amount,
      currency,
      
      // Status (normalized)
      status: this.normalizeStripeStatus(paymentIntent.status),
      statusOriginal: paymentIntent.status,
      
      // Timestamps
      createdAt: new Date(paymentIntent.created * 1000),
      
      // Customer Data
      customerEmail: paymentIntent.receipt_email || null,
      customerName: this.extractCustomerName(paymentIntent),
      customerId: paymentIntent.customer as string || null,
      
      // References
      orderId: paymentIntent.metadata?.order_id || null,
      registrationId: registrationData?.id || null,
      
      // Registration data if found
      registrationData: registrationData || null,
      
      // Invoice Fields
      receiptEmail: paymentIntent.receipt_email || null,
      billingAddress: this.extractBillingAddress(paymentIntent),
      
      // Preserve Original
      rawData: paymentIntent,
      
      // Unified Payment for new structure
      unifiedPayment: {
        _id: undefined,
        paymentId: paymentIntent.id,
        source: 'stripe',
        accountName: accountName,
        transactionId: paymentIntent.id,
        amount,
        amountFormatted: this.formatAmount(amount, currency),
        currency,
        status: paymentIntent.status,
        createdAt: new Date(paymentIntent.created * 1000),
        updatedAt: new Date(),
        
        // Customer Information
        customerEmail: paymentIntent.receipt_email,
        customerId: paymentIntent.customer as string || null,
        
        // References
        registrationId: registrationData?.id || null,
        registrationData: registrationData || null,
        
        // Raw data
        rawData: paymentIntent,
        importMetadata: {
          importId,
          importedAt: new Date(),
          importedBy
        }
      }
    };
    
    return paymentImport;
  }
  
  /**
   * Normalize Stripe payment status to unified status
   */
  private normalizeStripeStatus(stripeStatus: string): 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled' {
    const STATUS_MAP: Record<string, 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled'> = {
      'succeeded': 'completed',
      'failed': 'failed',
      'canceled': 'cancelled',
      'processing': 'pending',
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'requires_capture': 'pending'
    };
    
    return STATUS_MAP[stripeStatus] || 'pending';
  }
  
  /**
   * Extract customer name from various Stripe fields
   */
  private extractCustomerName(paymentIntent: Stripe.PaymentIntent): string | null {
    // Try billing details first
    if (paymentIntent.shipping?.name) {
      return paymentIntent.shipping.name;
    }
    
    // Try latest charge for billing details
    if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object') {
      const charge = paymentIntent.latest_charge as any;
      if (charge.billing_details?.name) {
        return charge.billing_details.name;
      }
    }
    
    return null;
  }
  
  /**
   * Extract billing address for invoice generation
   */
  private extractBillingAddress(paymentIntent: Stripe.PaymentIntent) {
    // Try to get billing details from latest charge
    let billingDetails = null;
    if (paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object') {
      const charge = paymentIntent.latest_charge as any;
      billingDetails = charge.billing_details;
    }
    
    if (!billingDetails?.address) {
      return null;
    }
    
    return {
      name: billingDetails.name || null,
      email: billingDetails.email || null,
      line1: billingDetails.address.line1 || null,
      line2: billingDetails.address.line2 || null,
      city: billingDetails.address.city || null,
      state: billingDetails.address.state || null,
      postalCode: billingDetails.address.postal_code || null,
      country: billingDetails.address.country || null,
    };
  }
  
  /**
   * Format amount for display
   */
  private formatAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}