import { Db, Collection, ObjectId } from 'mongodb';
import {
  ID_FIELD_MAPPINGS,
  MATCH_METHODS,
  extractValue,
  buildIdOnlyQuery,
  MatchResult
} from '@/constants/unified-field-mappings';

export class UnifiedMatchingService {
  private db: Db;
  private paymentsCollection: Collection;
  private registrationsCollection: Collection;

  constructor(db: Db) {
    this.db = db;
    this.paymentsCollection = db.collection('payments');
    this.registrationsCollection = db.collection('registrations');
  }

  /**
   * Main matching function - checks server match first, then performs new search
   */
  async findMatch(payment: any): Promise<MatchResult> {
    // 1. Check if payment already has a server-side match
    const serverMatch = await this.checkServerMatch(payment);
    if (serverMatch) {
      return serverMatch;
    }

    // 2. Perform new unified search
    const newMatch = await this.performUnifiedMatch(payment);
    
    // 3. Update payment record if match found
    if (newMatch.registration && newMatch.isMatch) {
      await this.updatePaymentMatch(payment._id, newMatch);
    }

    return newMatch;
  }

  /**
   * Check if payment already has a valid server-side match
   */
  private async checkServerMatch(payment: any): Promise<MatchResult | null> {
    const matchedId = payment.matchedRegistrationId || payment.linkedRegistrationId;

    if (matchedId) {
      try {
        const registration = await this.registrationsCollection.findOne({
          _id: new ObjectId(matchedId)
        });

        if (registration) {
          return {
            registration,
            matchMethod: payment.matchMethod || MATCH_METHODS.MANUAL,
            isMatch: true
          };
        }
      } catch (error) {
        console.error('Error fetching server match:', error);
      }
    }

    return null;
  }

  /**
   * Perform ID-only matching
   */
  private async performUnifiedMatch(payment: any): Promise<MatchResult> {
    // Build MongoDB query using ID fields only
    const query = buildIdOnlyQuery(payment);
    
    if (Object.keys(query).length === 0) {
      return this.createNoMatchResult();
    }

    // Search registrations collection
    const registrations = await this.registrationsCollection
      .find(query)
      .limit(20)
      .toArray();

    // Also search registration_imports collection
    const registrationImports = await this.db.collection('registration_imports')
      .find(query)
      .limit(10)
      .toArray();

    const allRegistrations = [...registrations, ...registrationImports];

    if (allRegistrations.length === 0) {
      return this.createNoMatchResult();
    }

    // Find exact ID match - take the first one found
    for (const registration of allRegistrations) {
      const matchResult = this.findIdMatch(payment, registration);
      
      if (matchResult.isMatch) {
        return matchResult;
      }
    }

    return this.createNoMatchResult();
  }

  /**
   * Find ID match between payment and registration (STRICT matching)
   */
  private findIdMatch(payment: any, registration: any): MatchResult {
    // Only check paymentId field type for STRICT matching
    const paymentIdMapping = ID_FIELD_MAPPINGS.paymentId;
    
    // Extract payment IDs from payment
    const paymentIds = paymentIdMapping.paymentPaths
      .map(path => extractValue(payment, path))
      .filter(val => val !== null && val !== undefined && val !== '');
    
    if (paymentIds.length === 0) {
      return this.createNoMatchResult();
    }
    
    // For each payment ID, verify it exists in the registration
    for (const paymentId of paymentIds) {
      // Check all possible registration fields for this exact payment ID
      for (const regPath of paymentIdMapping.registrationPaths) {
        const regValue = extractValue(registration, regPath);
        
        // STRICT: Payment ID must be found in registration
        if (regValue === paymentId) {
          console.log(`✅ STRICT MATCH: Payment ID "${paymentId}" found in registration field "${regPath}"`);
          return {
            registration,
            matchMethod: MATCH_METHODS.PAYMENT_ID,
            isMatch: true
          };
        }
      }
    }
    
    // No payment ID found in registration = NO MATCH
    return this.createNoMatchResult();
  }

  /**
   * Get match method from field type
   */
  private getMatchMethod(fieldType: string): string {
    switch (fieldType) {
      case 'paymentId': return MATCH_METHODS.PAYMENT_ID;
      case 'registrationId': return MATCH_METHODS.REGISTRATION_ID;
      case 'confirmationNumber': return MATCH_METHODS.CONFIRMATION_NUMBER;
      default: return MATCH_METHODS.NO_MATCH;
    }
  }

  /**
   * Create a "no match" result
   */
  private createNoMatchResult(): MatchResult {
    return {
      registration: null,
      matchMethod: MATCH_METHODS.NO_MATCH,
      isMatch: false
    };
  }

  /**
   * Update payment record with match information
   */
  private async updatePaymentMatch(paymentId: string | ObjectId, matchResult: MatchResult): Promise<void> {
    if (!matchResult.registration) return;

    try {
      // Handle both string and ObjectId types
      const filter = typeof paymentId === 'string' && ObjectId.isValid(paymentId) 
        ? { _id: new ObjectId(paymentId) }
        : { _id: paymentId };

      await this.paymentsCollection.updateOne(
        filter as any,
        {
          $set: {
            matchedRegistrationId: matchResult.registration._id.toString(),
            matchMethod: matchResult.matchMethod,
            matchedAt: new Date(),
            matchedBy: 'unified_service'
          }
        }
      );
    } catch (error) {
      console.error('Error updating payment match:', error);
    }
  }

  /**
   * Batch process multiple payments
   */
  async findMatches(payments: any[]): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    for (const payment of payments) {
      const result = await this.findMatch(payment);
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
    byMethod: Record<string, number>;
  }> {
    const payments = await this.paymentsCollection.find({}).toArray();
    
    const stats = {
      total: payments.length,
      matched: 0,
      unmatched: 0,
      byMethod: {}
    };

    for (const payment of payments) {
      const hasMatch = payment.matchedRegistrationId && payment.matchMethod;
      
      if (hasMatch) {
        stats.matched++;
        const method = payment.matchMethod || 'unknown';
        stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
      } else {
        stats.unmatched++;
      }
    }

    return stats;
  }

  /**
   * Reprocess all unmatched payments
   */
  async reprocessUnmatched(): Promise<{ processed: number; matched: number }> {
    const unmatchedPayments = await this.paymentsCollection.find({
      $or: [
        { matchedRegistrationId: { $exists: false } },
        { matchedRegistrationId: null },
        { matchedRegistrationId: '' }
      ]
    }).toArray();

    let processed = 0;
    let matched = 0;

    for (const payment of unmatchedPayments) {
      const result = await this.performUnifiedMatch(payment);
      processed++;

      if (result.registration && result.isMatch) {
        await this.updatePaymentMatch(payment._id, result);
        matched++;
      }
    }

    return { processed, matched };
  }
}