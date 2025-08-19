import { Db, Collection } from 'mongodb';

export interface PaymentData {
  _id?: string;
  paymentId?: string;
  transactionId: string;
  amount: number;
  timestamp: Date;
  source: 'square' | 'stripe';
  customerEmail?: string;
  status: string;
  metadata?: any;
  originalData?: any;
}

export interface RegistrationData {
  _id?: string;
  registrationId: string;
  confirmationNumber: string;
  square_payment_id?: string;
  stripe_payment_intent_id?: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmount: number;
  createdAt: Date;
  customerEmail?: string;
  registrationData?: any;
}

export interface MatchResult {
  payment: PaymentData;
  registration: RegistrationData | null;
  matchConfidence: number;
  matchMethod: string;
  issues: string[];
}

export class PaymentRegistrationMatcher {
  private paymentsCollection: Collection<PaymentData>;
  private registrationsCollection: Collection<RegistrationData>;

  constructor(db: Db) {
    this.paymentsCollection = db.collection<PaymentData>('payments');
    this.registrationsCollection = db.collection<RegistrationData>('registrations');
  }

  /**
   * Match a single payment to a registration
   */
  async matchPayment(payment: PaymentData): Promise<MatchResult> {
    const issues: string[] = [];
    
    // Try different matching strategies in order of preference
    
    // 1. Try exact payment ID match
    let registration = await this.matchByPaymentId(payment);
    if (registration) {
      const amountMatch = this.validateAmount(payment.amount, registration.totalAmount);
      const timeMatch = this.validateTimestamp(payment.timestamp, registration.createdAt);
      
      return {
        payment,
        registration,
        matchConfidence: amountMatch && timeMatch ? 100 : 80,
        matchMethod: 'payment_id',
        issues: this.collectIssues(amountMatch, timeMatch, payment, registration)
      };
    }

    // 2. Try metadata match
    registration = await this.matchByMetadata(payment);
    if (registration) {
      const amountMatch = this.validateAmount(payment.amount, registration.totalAmount);
      const timeMatch = this.validateTimestamp(payment.timestamp, registration.createdAt);
      
      return {
        payment,
        registration,
        matchConfidence: amountMatch && timeMatch ? 80 : 60,
        matchMethod: 'metadata',
        issues: this.collectIssues(amountMatch, timeMatch, payment, registration)
      };
    }

    // 3. Try fuzzy match by amount and time window
    registration = await this.matchByAmountAndTime(payment);
    if (registration) {
      const amountMatch = this.validateAmount(payment.amount, registration.totalAmount);
      const timeMatch = this.validateTimestamp(payment.timestamp, registration.createdAt);
      
      return {
        payment,
        registration,
        matchConfidence: 40,
        matchMethod: 'fuzzy',
        issues: this.collectIssues(amountMatch, timeMatch, payment, registration)
      };
    }

    // No match found
    return {
      payment,
      registration: null,
      matchConfidence: 0,
      matchMethod: 'none',
      issues: ['No matching registration found']
    };
  }

  /**
   * Match multiple payments in batch
   */
  async matchPayments(payments: PaymentData[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    
    for (const payment of payments) {
      const result = await this.matchPayment(payment);
      results.push(result);
    }
    
    return results;
  }

  private async matchByPaymentId(payment: PaymentData): Promise<RegistrationData | null> {
    const query = payment.source === 'square' 
      ? {
          $or: [
            { square_payment_id: payment.paymentId },
            { squarePaymentId: payment.paymentId },
            { 'paymentInfo.square_payment_id': payment.paymentId },
            { 'paymentData.paymentId': payment.paymentId }
          ]
        }
      : {
          $or: [
            { stripe_payment_intent_id: payment.transactionId },
            { stripePaymentIntentId: payment.transactionId },
            { 'paymentInfo.stripe_payment_intent_id': payment.transactionId },
            { 'paymentData.transactionId': payment.transactionId }
          ]
        };

    return await this.registrationsCollection.findOne(query);
  }

  private async matchByMetadata(payment: PaymentData): Promise<RegistrationData | null> {
    if (!payment.metadata) return null;

    const registrationId = payment.metadata.registrationId || 
                          payment.metadata.registration_id ||
                          payment.originalData?.metadata?.registration_id;

    if (!registrationId) return null;

    return await this.registrationsCollection.findOne({
      $or: [
        { registrationId: registrationId },
        { _id: registrationId }
      ]
    });
  }

  private async matchByAmountAndTime(payment: PaymentData): Promise<RegistrationData | null> {
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    const startTime = new Date(payment.timestamp.getTime() - timeWindow);
    const endTime = new Date(payment.timestamp.getTime() + timeWindow);

    return await this.registrationsCollection.findOne({
      totalAmount: payment.amount,
      createdAt: {
        $gte: startTime,
        $lte: endTime
      }
    });
  }

  private validateAmount(paymentAmount: number, registrationAmount: number): boolean {
    const tolerance = 0.01; // 1 cent tolerance
    return Math.abs(paymentAmount - registrationAmount) <= tolerance;
  }

  private validateTimestamp(paymentTime: Date, registrationTime: Date): boolean {
    const maxDiff = 7 * 24 * 60 * 60 * 1000; // 7 days
    return Math.abs(paymentTime.getTime() - registrationTime.getTime()) <= maxDiff;
  }

  private collectIssues(
    amountMatch: boolean, 
    timeMatch: boolean, 
    payment: PaymentData, 
    registration: RegistrationData
  ): string[] {
    const issues: string[] = [];
    
    if (!amountMatch) {
      issues.push(`Amount mismatch: payment ${payment.amount} vs registration ${registration.totalAmount}`);
    }
    
    if (!timeMatch) {
      const daysDiff = Math.abs(payment.timestamp.getTime() - registration.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      issues.push(`Time difference: ${daysDiff.toFixed(1)} days`);
    }
    
    return issues;
  }
}