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
        matchConfidence: amountMatch && timeMatch ? 90 : 70,
        matchMethod: 'metadata',
        issues: this.collectIssues(amountMatch, timeMatch, payment, registration)
      };
    }

    // 3. Try fuzzy match by amount and time
    registration = await this.matchByAmountAndTime(payment);
    if (registration) {
      return {
        payment,
        registration,
        matchConfidence: 60,
        matchMethod: 'amount_time',
        issues: ['Matched by amount and time only - no payment ID match']
      };
    }

    // 4. Try email match with amount
    if (payment.customerEmail) {
      registration = await this.matchByEmailAndAmount(payment);
      if (registration) {
        return {
          payment,
          registration,
          matchConfidence: 50,
          matchMethod: 'email_amount',
          issues: ['Matched by email and amount only - verify manually']
        };
      }
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

  private async matchByPaymentId(payment: PaymentData): Promise<RegistrationData | null> {
    const paymentId = payment.paymentId || payment.transactionId;
    
    if (payment.source === 'square') {
      // Try multiple field variations for Square
      return await this.registrationsCollection.findOne({
        $or: [
          { square_payment_id: paymentId },
          { squarePaymentId: paymentId },
          { 'registrationData.square_payment_id': paymentId }
        ]
      });
    } else {
      // Try multiple field variations for Stripe
      return await this.registrationsCollection.findOne({
        $or: [
          { stripe_payment_intent_id: paymentId },
          { stripePaymentIntentId: paymentId },
          { 'registrationData.stripe_payment_intent_id': paymentId }
        ]
      });
    }
  }

  private async matchByMetadata(payment: PaymentData): Promise<RegistrationData | null> {
    if (!payment.originalData) return null;

    // Extract metadata fields
    const metadata = payment.originalData;
    const registrationId = metadata['registrationId (metadata)'] || 
                          metadata['registrationId'] ||
                          metadata.registrationId;

    if (registrationId) {
      return await this.registrationsCollection.findOne({
        $or: [
          { registrationId: registrationId },
          { _id: registrationId }
        ]
      });
    }

    return null;
  }

  private async matchByAmountAndTime(payment: PaymentData): Promise<RegistrationData | null> {
    // Look for registrations within 5 minutes of payment time
    const timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
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

  private async matchByEmailAndAmount(payment: PaymentData): Promise<RegistrationData | null> {
    if (!payment.customerEmail) return null;

    return await this.registrationsCollection.findOne({
      customerEmail: payment.customerEmail,
      totalAmount: payment.amount
    });
  }

  private validateAmount(paymentAmount: number, registrationAmount: number): boolean {
    // Allow for small rounding differences (within $0.10)
    return Math.abs(paymentAmount - registrationAmount) <= 0.10;
  }

  private validateTimestamp(paymentTime: Date, registrationTime: Date): boolean {
    // Check if times are within 10 minutes of each other
    const timeDiff = Math.abs(paymentTime.getTime() - registrationTime.getTime());
    return timeDiff <= 10 * 60 * 1000; // 10 minutes
  }

  private collectIssues(
    amountMatch: boolean, 
    timeMatch: boolean, 
    payment: PaymentData, 
    registration: RegistrationData
  ): string[] {
    const issues: string[] = [];

    if (!amountMatch) {
      issues.push(`Amount mismatch: Payment ${payment.amount} vs Registration ${registration.totalAmount}`);
    }

    if (!timeMatch) {
      issues.push(`Time mismatch: Payment ${payment.timestamp} vs Registration ${registration.createdAt}`);
    }

    return issues;
  }

  /**
   * Match all unprocessed payments
   */
  async matchAllPayments(): Promise<MatchResult[]> {
    const unmatchedPayments = await this.paymentsCollection.find({
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
    }).sort({ timestamp: 1 }).toArray(); // Sort by oldest first

    const results: MatchResult[] = [];

    for (const payment of unmatchedPayments) {
      const result = await this.matchPayment(payment);
      results.push(result);
    }

    return results;
  }

  /**
   * Get match statistics
   */
  async getMatchStatistics(): Promise<{
    total: number;
    matched: number;
    unmatched: number;
    byConfidence: Record<string, number>;
    byMethod: Record<string, number>;
  }> {
    const results = await this.matchAllPayments();
    
    const stats = {
      total: results.length,
      matched: results.filter(r => r.registration !== null).length,
      unmatched: results.filter(r => r.registration === null).length,
      byConfidence: {} as Record<string, number>,
      byMethod: {} as Record<string, number>
    };

    // Group by confidence levels
    const confidenceBuckets = [
      { range: '90-100', min: 90, max: 100 },
      { range: '70-89', min: 70, max: 89 },
      { range: '50-69', min: 50, max: 69 },
      { range: '0-49', min: 0, max: 49 }
    ];

    confidenceBuckets.forEach(bucket => {
      stats.byConfidence[bucket.range] = results.filter(
        r => r.matchConfidence >= bucket.min && r.matchConfidence <= bucket.max
      ).length;
    });

    // Group by method
    results.forEach(result => {
      stats.byMethod[result.matchMethod] = (stats.byMethod[result.matchMethod] || 0) + 1;
    });

    return stats;
  }
}