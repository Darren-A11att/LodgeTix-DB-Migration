/**
 * Data service for fetching payments and registrations from MongoDB
 */

import { connectMongoDB } from '@/lib/mongodb';
import { PaymentData, RegistrationData } from './types';

export class InvoiceDataService {
  /**
   * Fetch a payment by ID
   */
  static async getPayment(paymentId: string): Promise<PaymentData | null> {
    const { db } = await connectMongoDB();
    const payment = await db.collection('payments').findOne({ 
      $or: [
        { paymentId },
        { _id: paymentId },
        { transactionId: paymentId }
      ]
    });
    return payment as PaymentData | null;
  }

  /**
   * Fetch a registration by confirmation number
   */
  static async getRegistration(confirmationNumber: string): Promise<RegistrationData | null> {
    const { db } = await connectMongoDB();
    const registration = await db.collection('registrations').findOne({ 
      confirmationNumber 
    });
    return registration as RegistrationData | null;
  }

  /**
   * Fetch payment and registration for invoice generation
   */
  static async getInvoiceData(paymentId: string, confirmationNumber?: string): Promise<{
    payment: PaymentData | null;
    registration: RegistrationData | null;
  }> {
    const { db } = await connectMongoDB();
    
    // Get payment
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      return { payment: null, registration: null };
    }

    // Try to find confirmation number from payment if not provided
    if (!confirmationNumber) {
      confirmationNumber = payment.metadata?.confirmationNumber ||
                          payment.description?.match(/[A-Z]{3}-\d{6}[A-Z]{2}/)?.[0];
    }

    // Get registration
    const registration = confirmationNumber 
      ? await this.getRegistration(confirmationNumber)
      : null;

    return { payment, registration };
  }

  /**
   * Fetch multiple payments and registrations
   */
  static async getBulkInvoiceData(paymentIds: string[]): Promise<Array<{
    paymentId: string;
    payment: PaymentData | null;
    registration: RegistrationData | null;
  }>> {
    const results = await Promise.all(
      paymentIds.map(async (paymentId) => {
        const { payment, registration } = await this.getInvoiceData(paymentId);
        return { paymentId, payment, registration };
      })
    );
    return results;
  }
}