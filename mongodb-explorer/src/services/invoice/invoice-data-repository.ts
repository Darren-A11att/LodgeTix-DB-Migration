/**
 * Repository for fetching invoice-related data from MongoDB
 * Follows the same patterns as existing server code
 */

import { Db, Collection, ObjectId } from 'mongodb';
import { PaymentData, RegistrationData } from './types';

export class InvoiceDataRepository {
  private db: Db;
  private paymentsCollection: Collection<PaymentData>;
  private registrationsCollection: Collection<RegistrationData>;

  constructor(db: Db) {
    this.db = db;
    this.paymentsCollection = db.collection<PaymentData>('payments');
    this.registrationsCollection = db.collection<RegistrationData>('registrations');
  }

  /**
   * Fetch a payment by various ID fields
   * Updated to use unified payment structure with backward compatibility
   */
  async getPayment(paymentId: string): Promise<PaymentData | null> {
    const payment = await this.paymentsCollection.findOne({
      $or: [
        // Unified structure fields
        { id: paymentId },
        { sourcePaymentId: paymentId },
        // Legacy fields for backward compatibility
        { paymentId },
        { _id: paymentId },
        { transactionId: paymentId },
        { stripePaymentIntentId: paymentId },
        { squarePaymentId: paymentId }
      ]
    });
    
    return payment;
  }

  /**
   * Fetch a registration by confirmation number
   * Follows the existing server pattern
   */
  async getRegistrationByConfirmation(confirmationNumber: string): Promise<RegistrationData | null> {
    const registration = await this.registrationsCollection.findOne({
      confirmationNumber
    });
    
    return registration;
  }

  /**
   * Fetch a registration by payment ID
   * Updated to include unified payment ID fields with backward compatibility
   */
  async getRegistrationByPaymentId(paymentId: string): Promise<RegistrationData | null> {
    const registration = await this.registrationsCollection.findOne({
      $or: [
        // Legacy fields for backward compatibility
        { stripePaymentIntentId: paymentId },
        { stripe_payment_intent_id: paymentId },
        { squarePaymentId: paymentId },
        { square_payment_id: paymentId },
        { 'registrationData.squarePaymentId': paymentId },
        { 'registrationData.square_payment_id': paymentId },
        { 'metadata.squarePaymentId': paymentId }
      ]
    });
    
    return registration;
  }

  /**
   * Fetch unmatched payments for invoice generation
   * Same query as used in server.ts
   */
  async getUnmatchedPayments(limit: number = 100): Promise<PaymentData[]> {
    const payments = await this.paymentsCollection.find({
      $and: [
        {
          $or: [
            { invoiceCreated: { $ne: true } },
            { invoiceCreated: { $exists: false } }
          ]
        },
        {
          $or: [
            { invoiceDeclined: { $ne: true } },
            { invoiceDeclined: { $exists: false } }
          ]
        }
      ]
    })
    .sort({ timestamp: 1 })
    .limit(limit)
    .toArray();
    
    return payments;
  }

  /**
   * Fetch payment and matching registration
   * Combines logic from multiple server patterns
   */
  async getPaymentWithRegistration(paymentId: string): Promise<{
    payment: PaymentData | null;
    registration: RegistrationData | null;
  }> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      return { payment: null, registration: null };
    }

    // Try to find registration by confirmation number first
    let registration: RegistrationData | null = null;
    
    // Extract confirmation number from unified payment structure
    const confirmationNumber = 
      payment.registrationId ||  // Direct registrationId from unified structure
      payment.metadata?.confirmationNumber ||
      payment.rawData?.metadata?.confirmationNumber ||  // From rawData in unified structure
      payment.description?.match(/[A-Z]{3}-\d{6}[A-Z]{2}/)?.[0];
    
    if (confirmationNumber) {
      registration = await this.getRegistrationByConfirmation(confirmationNumber);
    }
    
    // If not found by confirmation, try by payment ID
    if (!registration) {
      registration = await this.getRegistrationByPaymentId(paymentId);
    }
    
    return { payment, registration };
  }

  /**
   * Update payment with invoice information
   * Updated to use unified payment structure with backward compatibility
   */
  async updatePaymentWithInvoice(
    paymentId: string, 
    invoiceId: string,
    invoiceNumber: string
  ): Promise<boolean> {
    const result = await this.paymentsCollection.updateOne(
      {
        $or: [
          // Unified structure fields
          { id: paymentId },
          { sourcePaymentId: paymentId },
          // Legacy fields for backward compatibility
          { paymentId },
          { _id: paymentId }
        ]
      },
      {
        $set: {
          invoiceId,
          invoiceNumber,
          invoiceCreated: true,
          invoiceCreatedAt: new Date()
        }
      }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Get function details by ID
   * Used for fetching function names
   */
  async getFunctionDetails(functionId: string): Promise<any> {
    const functionsCollection = this.db.collection('functions');
    return functionsCollection.findOne({ _id: new ObjectId(functionId) });
  }
}