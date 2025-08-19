import { Db, Collection, ObjectId } from 'mongodb';

export interface StrictMatchResult {
  registration: any | null;
  matchMethod: 'paymentId' | 'transactionId' | 'none';
  isMatch: boolean;
  paymentIdUsed?: string;
  fieldMatched?: string;
}

export class StrictPaymentMatcher {
  private db: Db;
  private paymentsCollection: Collection;
  private registrationsCollection: Collection;

  constructor(db: Db) {
    this.db = db;
    this.paymentsCollection = db.collection('payments');
    this.registrationsCollection = db.collection('registrations');
  }

  /**
   * Strict matching - ONLY match if payment ID is found in registration
   */
  async findMatch(payment: any): Promise<StrictMatchResult> {
    // Extract payment IDs from the payment
    const paymentIds = this.extractPaymentIds(payment);
    
    if (paymentIds.length === 0) {
      return {
        registration: null,
        matchMethod: 'none',
        isMatch: false
      };
    }

    // Search for registrations containing any of these payment IDs
    for (const { id: paymentId, field: paymentField } of paymentIds) {
      const registration = await this.findRegistrationWithPaymentId(paymentId);
      
      if (registration) {
        // Verify the payment ID actually exists in the registration
        const fieldMatched = this.findPaymentIdField(registration, paymentId);
        
        if (fieldMatched) {
          return {
            registration,
            matchMethod: paymentField === 'paymentId' ? 'paymentId' : 'transactionId',
            isMatch: true,
            paymentIdUsed: paymentId,
            fieldMatched
          };
        }
      }
    }

    return {
      registration: null,
      matchMethod: 'none',
      isMatch: false
    };
  }

  /**
   * Extract all possible payment IDs from a payment
   */
  private extractPaymentIds(payment: any): Array<{ id: string; field: string }> {
    const ids: Array<{ id: string; field: string }> = [];
    
    // Primary payment ID
    if (payment.paymentId) {
      ids.push({ id: payment.paymentId, field: 'paymentId' });
    }
    
    // Transaction ID (sometimes used as payment ID)
    if (payment.transactionId && payment.transactionId !== payment.paymentId) {
      ids.push({ id: payment.transactionId, field: 'transactionId' });
    }
    
    // Square-specific fields
    if (payment.originalData?.['Payment ID']) {
      ids.push({ id: payment.originalData['Payment ID'], field: 'originalData.Payment ID' });
    }
    
    // Stripe-specific fields
    if (payment.originalData?.['PaymentIntent ID']) {
      ids.push({ id: payment.originalData['PaymentIntent ID'], field: 'originalData.PaymentIntent ID' });
    }
    
    return ids.filter(item => item.id); // Remove empty values
  }

  /**
   * Find a registration that contains the payment ID
   */
  private async findRegistrationWithPaymentId(paymentId: string): Promise<any | null> {
    // Build query to search for payment ID in all relevant fields
    const query = {
      $or: [
        { stripePaymentIntentId: paymentId },
        { squarePaymentId: paymentId },
        { 'registrationData.stripePaymentIntentId': paymentId },
        { 'registrationData.squarePaymentId': paymentId },
        { 'registrationData.stripe_payment_intent_id': paymentId },
        { 'registrationData.square_payment_id': paymentId },
        { 'paymentInfo.stripe_payment_intent_id': paymentId },
        { 'paymentInfo.square_payment_id': paymentId },
        { 'paymentData.transactionId': paymentId },
        { 'paymentData.paymentId': paymentId }
      ]
    };

    return await this.registrationsCollection.findOne(query);
  }

  /**
   * Find which field in the registration contains the payment ID
   */
  private findPaymentIdField(registration: any, paymentId: string): string | null {
    // Check top-level fields
    if (registration.stripePaymentIntentId === paymentId) return 'stripePaymentIntentId';
    if (registration.squarePaymentId === paymentId) return 'squarePaymentId';
    
    // Check nested fields
    if (registration.registrationData?.stripePaymentIntentId === paymentId) return 'registrationData.stripePaymentIntentId';
    if (registration.registrationData?.squarePaymentId === paymentId) return 'registrationData.squarePaymentId';
    if (registration.registrationData?.stripe_payment_intent_id === paymentId) return 'registrationData.stripe_payment_intent_id';
    if (registration.registrationData?.square_payment_id === paymentId) return 'registrationData.square_payment_id';
    
    if (registration.paymentInfo?.stripe_payment_intent_id === paymentId) return 'paymentInfo.stripe_payment_intent_id';
    if (registration.paymentInfo?.square_payment_id === paymentId) return 'paymentInfo.square_payment_id';
    
    if (registration.paymentData?.transactionId === paymentId) return 'paymentData.transactionId';
    if (registration.paymentData?.paymentId === paymentId) return 'paymentData.paymentId';
    
    return null;
  }

  /**
   * Update payment with match information
   */
  async updatePaymentMatch(paymentId: string | ObjectId, matchResult: StrictMatchResult): Promise<void> {
    if (!matchResult.registration || !matchResult.isMatch) {
      // Clear any existing match
      await this.paymentsCollection.updateOne(
        { _id: typeof paymentId === 'string' ? new ObjectId(paymentId) : paymentId },
        {
          $unset: {
            matchedRegistrationId: '',
            matchMethod: '',
            matchedAt: '',
            matchedBy: ''
          }
        }
      );
      return;
    }

    await this.paymentsCollection.updateOne(
      { _id: typeof paymentId === 'string' ? new ObjectId(paymentId) : paymentId },
      {
        $set: {
          matchedRegistrationId: matchResult.registration._id.toString(),
          matchMethod: matchResult.matchMethod,
          matchedAt: new Date(),
          matchedBy: 'strict_matcher',
          matchDetails: [{
            fieldName: 'paymentId',
            paymentValue: matchResult.paymentIdUsed,
            registrationValue: matchResult.paymentIdUsed,
            paymentPath: matchResult.matchMethod,
            registrationPath: matchResult.fieldMatched,
            points: 100,
            isMatch: true
          }],
          matchConfidence: 100
        }
      }
    );
  }

  /**
   * Re-match all payments with strict criteria
   */
  async rematchAllPayments(clearExisting = false): Promise<{ processed: number; matched: number; cleared: number }> {
    let processed = 0;
    let matched = 0;
    let cleared = 0;

    const payments = await this.paymentsCollection.find({}).toArray();

    for (const payment of payments) {
      processed++;

      if (clearExisting && payment.matchedRegistrationId) {
        // First check if current match is valid
        const currentMatch = await this.findMatch(payment);
        
        if (!currentMatch.isMatch || 
            currentMatch.registration?._id.toString() !== payment.matchedRegistrationId) {
          // Current match is invalid, clear it
          await this.updatePaymentMatch(payment._id, {
            registration: null,
            matchMethod: 'none',
            isMatch: false
          });
          cleared++;
        }
      }

      // Find new match with strict criteria
      const matchResult = await this.findMatch(payment);
      
      if (matchResult.isMatch) {
        await this.updatePaymentMatch(payment._id, matchResult);
        matched++;
      }
    }

    return { processed, matched, cleared };
  }
}