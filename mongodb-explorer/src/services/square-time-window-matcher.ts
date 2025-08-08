import { Db } from 'mongodb';

const square = require('square');

/**
 * Square API Time-Window Registration Matcher
 * 
 * Implements a targeted approach for matching Supabase registrations to Square payments
 * by making Square API calls within specific time windows around each registration's creation time.
 * 
 * This approach is more efficient than loading all Square payments and reduces memory usage
 * while providing more accurate timestamp-based matching.
 */

export interface RegistrationRecord {
  registration_id: string;
  created_at: string;
  total_amount_paid?: number;
  confirmation_number?: string;
  registration_data?: any;
  stripe_payment_intent_id?: string | null;
}

export interface SquarePaymentCandidate {
  id: string;
  amount: number;
  currency: string;
  createdAt: Date;
  customerEmail?: string | null;
  customerName?: string | null;
  status: string;
  orderId?: string | null;
  locationId?: string | null;
  rawPayment: any;
}

export interface TimeWindowSearchResult {
  registration: RegistrationRecord;
  candidates: SquarePaymentCandidate[];
  searchWindow: {
    beginTime: string;
    endTime: string;
    windowSizeMinutes: number;
  };
  searchStats: {
    totalCandidates: number;
    apiCallDurationMs: number;
    hasMoreResults: boolean;
  };
  error?: string;
}

export class SquareTimeWindowMatcher {
  private db: Db;
  private squareClient: any;
  private rateLimitDelay: number = 100; // 100ms between API calls to respect rate limits
  
  constructor(db: Db, squareAccessToken: string, environment: string = 'production') {
    this.db = db;
    this.squareClient = new square.SquareClient({
      accessToken: squareAccessToken,
      environment: environment === 'production' 
        ? square.SquareEnvironment.Production 
        : square.SquareEnvironment.Sandbox
    });
  }

  /**
   * Search for Square payments within a time window around a registration's creation time
   * 
   * @param registration - The registration to find payments for
   * @param windowMinutes - Time window size in minutes (default: 5)
   * @param locationIds - Optional array of Square location IDs to filter by
   * @returns Promise<TimeWindowSearchResult>
   */
  async searchPaymentsInTimeWindow(
    registration: RegistrationRecord,
    windowMinutes: number = 5,
    locationIds?: string[]
  ): Promise<TimeWindowSearchResult> {
    
    const registrationTime = new Date(registration.created_at);
    
    // Create time window (±windowMinutes around registration time)
    const beginTime = new Date(registrationTime.getTime() - (windowMinutes * 60 * 1000));
    const endTime = new Date(registrationTime.getTime() + (windowMinutes * 60 * 1000));
    
    // Convert to RFC 3339 format for Square API
    const beginTimeRFC3339 = beginTime.toISOString();
    const endTimeRFC3339 = endTime.toISOString();
    
    const result: TimeWindowSearchResult = {
      registration,
      candidates: [],
      searchWindow: {
        beginTime: beginTimeRFC3339,
        endTime: endTimeRFC3339,
        windowSizeMinutes: windowMinutes * 2 // Total window size
      },
      searchStats: {
        totalCandidates: 0,
        apiCallDurationMs: 0,
        hasMoreResults: false
      }
    };

    try {
      const startTime = Date.now();
      
      // Make Square API call with time window
      console.log(`🔍 Searching Square payments for registration ${registration.registration_id}`);
      console.log(`   Time window: ${beginTimeRFC3339} to ${endTimeRFC3339}`);
      
      const candidates: SquarePaymentCandidate[] = [];
      let cursor: string | undefined;
      let totalApiCalls = 0;
      
      // Handle pagination in case there are multiple payments in the window
      do {
        totalApiCalls++;
        
        const response = await this.squareClient.paymentsApi.listPayments(
          beginTimeRFC3339,      // begin_time
          endTimeRFC3339,        // end_time
          'ASC',                 // sort_order
          cursor,                // cursor for pagination
          undefined,             // location_id (we'll filter after if needed)
          undefined,             // total
          undefined,             // last_4
          undefined,             // card_brand
          50                     // limit (reasonable batch size)
        );

        if (response?.result?.payments) {
          for (const payment of response.result.payments) {
            // Filter by location if specified
            if (locationIds && locationIds.length > 0) {
              if (!payment.locationId || !locationIds.includes(payment.locationId)) {
                continue;
              }
            }
            
            // Convert Square payment to candidate format
            const candidate = this.convertSquarePaymentToCandidate(payment);
            if (candidate) {
              candidates.push(candidate);
            }
          }
          
          cursor = response.result.cursor;
        }
        
        // Safety limit for pagination
        if (totalApiCalls >= 10) {
          result.searchStats.hasMoreResults = !!cursor;
          break;
        }
        
      } while (cursor);
      
      result.candidates = candidates;
      result.searchStats.totalCandidates = candidates.length;
      result.searchStats.apiCallDurationMs = Date.now() - startTime;
      
      console.log(`   ✅ Found ${candidates.length} payment candidates in ${result.searchStats.apiCallDurationMs}ms`);
      
      // Rate limiting - wait before next API call
      if (this.rateLimitDelay > 0) {
        await this.sleep(this.rateLimitDelay);
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`   ❌ Error searching Square payments for ${registration.registration_id}:`, errorMessage);
      
      result.error = errorMessage;
      result.searchStats.apiCallDurationMs = Date.now() - (result.searchStats.apiCallDurationMs || Date.now());
      
      return result;
    }
  }

  /**
   * Batch search for multiple registrations with time window approach
   * 
   * @param registrations - Array of registrations to search for
   * @param windowMinutes - Time window size in minutes (default: 5)
   * @param locationIds - Optional array of Square location IDs to filter by
   * @param batchDelay - Delay between batches in ms (default: 1000)
   * @returns Promise<TimeWindowSearchResult[]>
   */
  async batchSearchRegistrations(
    registrations: RegistrationRecord[],
    windowMinutes: number = 5,
    locationIds?: string[],
    batchDelay: number = 1000
  ): Promise<TimeWindowSearchResult[]> {
    
    console.log(`🚀 Starting batch search for ${registrations.length} registrations`);
    console.log(`   Time window: ±${windowMinutes} minutes`);
    console.log(`   Location filter: ${locationIds ? locationIds.join(', ') : 'All locations'}`);
    console.log(`   Rate limit delay: ${this.rateLimitDelay}ms between calls`);
    console.log();
    
    const results: TimeWindowSearchResult[] = [];
    
    for (let i = 0; i < registrations.length; i++) {
      const registration = registrations[i];
      
      console.log(`Processing ${i + 1}/${registrations.length}: ${registration.registration_id}`);
      
      try {
        const result = await this.searchPaymentsInTimeWindow(
          registration, 
          windowMinutes, 
          locationIds
        );
        
        results.push(result);
        
        // Add delay between registrations to be respectful to Square API
        if (i < registrations.length - 1 && batchDelay > 0) {
          await this.sleep(batchDelay);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to process registration ${registration.registration_id}:`, error);
        
        // Add error result
        results.push({
          registration,
          candidates: [],
          searchWindow: {
            beginTime: '',
            endTime: '',
            windowSizeMinutes: windowMinutes * 2
          },
          searchStats: {
            totalCandidates: 0,
            apiCallDurationMs: 0,
            hasMoreResults: false
          },
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`\n✅ Batch search completed: ${results.length} results`);
    
    return results;
  }

  /**
   * Load registrations with null stripe_payment_intent_id from Supabase
   * This method would typically be called from the main matching script
   */
  async loadRegistrationsWithNullStripe(supabase: any): Promise<RegistrationRecord[]> {
    const registrations: RegistrationRecord[] = [];
    const pageSize = 20;
    let start = 0;
    let hasMore = true;

    console.log('📋 Loading registrations with null stripe_payment_intent_id...');

    while (hasMore) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select(`
            registration_id,
            confirmation_number,
            created_at,
            total_amount_paid,
            registration_data,
            stripe_payment_intent_id
          `)
          .is('stripe_payment_intent_id', null)
          .range(start, start + pageSize - 1)
          .order('created_at', { ascending: false });

        if (error) {
          throw new Error(`Supabase query error: ${error.message}`);
        }

        if (data && data.length > 0) {
          registrations.push(...data);
          start += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }

      } catch (error) {
        console.error('❌ Error loading registrations:', error);
        throw error;
      }
    }

    console.log(`✅ Loaded ${registrations.length} registrations with null stripe_payment_intent_id`);
    
    return registrations;
  }

  /**
   * Convert Square payment object to standardized candidate format
   */
  private convertSquarePaymentToCandidate(squarePayment: any): SquarePaymentCandidate | null {
    try {
      // Parse amount (Square uses smallest currency unit)
      let amount = 0;
      let currency = 'USD';
      
      if (squarePayment.amountMoney) {
        amount = parseInt(squarePayment.amountMoney.amount) || 0;
        currency = squarePayment.amountMoney.currency || 'USD';
        
        // Convert from smallest unit to dollars (except JPY)
        const divisor = currency === 'JPY' ? 1 : 100;
        amount = amount / divisor;
      }
      
      // Parse creation timestamp
      let createdAt: Date;
      try {
        createdAt = new Date(squarePayment.createdAt);
        if (isNaN(createdAt.getTime())) {
          throw new Error('Invalid date');
        }
      } catch {
        console.warn(`Invalid createdAt for payment ${squarePayment.id}, using current time`);
        createdAt = new Date();
      }
      
      // Extract customer information
      let customerEmail: string | null = null;
      let customerName: string | null = null;
      
      if (squarePayment.buyerEmailAddress) {
        customerEmail = squarePayment.buyerEmailAddress;
      }
      
      // Try to get customer name from various sources
      if (squarePayment.shippingAddress) {
        const firstName = squarePayment.shippingAddress.firstName || '';
        const lastName = squarePayment.shippingAddress.lastName || '';
        if (firstName || lastName) {
          customerName = `${firstName} ${lastName}`.trim();
        }
      }
      
      return {
        id: squarePayment.id,
        amount,
        currency: currency.toUpperCase(),
        createdAt,
        customerEmail,
        customerName,
        status: squarePayment.status || 'UNKNOWN',
        orderId: squarePayment.orderId || null,
        locationId: squarePayment.locationId || null,
        rawPayment: squarePayment
      };
      
    } catch (error) {
      console.warn(`Failed to convert Square payment ${squarePayment.id}:`, error);
      return null;
    }
  }

  /**
   * Calculate match score between registration and Square payment candidate
   */
  calculateMatchScore(
    registration: RegistrationRecord, 
    candidate: SquarePaymentCandidate
  ): {
    totalScore: number;
    breakdown: {
      timestampScore: number;
      amountScore: number;
      emailScore: number;
      nameScore: number;
    };
    reasons: string[];
  } {
    const reasons: string[] = [];
    let totalScore = 0;
    
    const registrationTime = new Date(registration.created_at);
    const timeDiffMs = Math.abs(candidate.createdAt.getTime() - registrationTime.getTime());
    const timeDiffMinutes = timeDiffMs / (1000 * 60);
    
    // 1. Timestamp score (40 points max) - should be very high since we're searching in window
    const timestampScore = Math.max(0, 40 - (timeDiffMinutes * 8));
    totalScore += timestampScore;
    reasons.push(`Timestamp: ${timeDiffMinutes.toFixed(1)} min apart (${timestampScore.toFixed(1)} pts)`);
    
    // 2. Amount score (30 points max)
    const regAmount = registration.total_amount_paid || 0;
    const amountDiff = Math.abs(candidate.amount - regAmount);
    let amountScore = 0;
    
    if (amountDiff === 0) {
      amountScore = 30;
      reasons.push(`Amount perfect match: $${candidate.amount} (30 pts)`);
    } else if (amountDiff <= 0.5) {
      amountScore = 25;
      reasons.push(`Amount close: ±$${amountDiff.toFixed(2)} (25 pts)`);
    } else if (amountDiff <= 2.0) {
      amountScore = 20 - ((amountDiff - 0.5) / 1.5) * 10;
      reasons.push(`Amount acceptable: ±$${amountDiff.toFixed(2)} (${amountScore.toFixed(1)} pts)`);
    } else {
      reasons.push(`Amount mismatch: ±$${amountDiff.toFixed(2)} (0 pts)`);
    }
    totalScore += amountScore;
    
    // 3. Email score (20 points max)
    let emailScore = 0;
    const regEmail = this.extractRegistrationEmail(registration);
    
    if (candidate.customerEmail && regEmail) {
      if (candidate.customerEmail.toLowerCase() === regEmail.toLowerCase()) {
        emailScore = 20;
        reasons.push(`Email exact match (20 pts)`);
      } else {
        reasons.push(`Email mismatch (0 pts)`);
      }
    } else {
      reasons.push('Email data missing (0 pts)');
    }
    totalScore += emailScore;
    
    // 4. Name score (10 points max)
    let nameScore = 0;
    if (candidate.customerName && registration.registration_data?.attendees?.[0]?.firstName) {
      const paymentName = candidate.customerName.toLowerCase();
      const regFirstName = registration.registration_data.attendees[0].firstName.toLowerCase();
      
      if (paymentName.includes(regFirstName) || regFirstName.includes(paymentName.split(' ')[0])) {
        nameScore = 10;
        reasons.push('Name match found (10 pts)');
      } else {
        reasons.push('Name mismatch (0 pts)');
      }
    } else {
      reasons.push('Name data missing (0 pts)');
    }
    totalScore += nameScore;
    
    return {
      totalScore: Math.round(totalScore * 100) / 100,
      breakdown: {
        timestampScore,
        amountScore,
        emailScore,
        nameScore
      },
      reasons
    };
  }

  /**
   * Extract email from registration data
   */
  private extractRegistrationEmail(registration: RegistrationRecord): string | null {
    const registrationData = registration.registration_data || {};
    
    // Try various paths where email might be stored
    const emailPaths = [
      ['email'],
      ['bookingContact', 'email'],
      ['attendees', '0', 'email'],
      ['contact', 'email']
    ];
    
    for (const path of emailPaths) {
      let current = registrationData;
      let valid = true;
      
      for (const key of path) {
        if (current && typeof current === 'object' && current[key] !== undefined) {
          current = current[key];
        } else {
          valid = false;
          break;
        }
      }
      
      if (valid && current && typeof current === 'string') {
        return current.trim();
      }
    }
    
    return null;
  }

  /**
   * Helper method for delays (rate limiting)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set rate limit delay between API calls
   */
  setRateLimitDelay(delayMs: number): void {
    this.rateLimitDelay = Math.max(0, delayMs);
  }

  /**
   * Get match statistics from search results
   */
  getMatchStatistics(results: TimeWindowSearchResult[]): {
    totalRegistrations: number;
    registrationsWithCandidates: number;
    totalCandidates: number;
    averageCandidatesPerRegistration: number;
    totalApiTime: number;
    averageApiTime: number;
    errorCount: number;
  } {
    const totalRegistrations = results.length;
    const registrationsWithCandidates = results.filter(r => r.candidates.length > 0).length;
    const totalCandidates = results.reduce((sum, r) => sum + r.candidates.length, 0);
    const totalApiTime = results.reduce((sum, r) => sum + r.searchStats.apiCallDurationMs, 0);
    const errorCount = results.filter(r => r.error).length;
    
    return {
      totalRegistrations,
      registrationsWithCandidates,
      totalCandidates,
      averageCandidatesPerRegistration: totalCandidates / totalRegistrations,
      totalApiTime,
      averageApiTime: totalApiTime / totalRegistrations,
      errorCount
    };
  }
}

/**
 * Utility function to create a time-window matcher instance
 */
export function createSquareTimeWindowMatcher(
  db: Db,
  squareAccessToken: string,
  environment: string = 'production'
): SquareTimeWindowMatcher {
  return new SquareTimeWindowMatcher(db, squareAccessToken, environment);
}

/**
 * Main function to perform time-window based matching for all registrations with null stripe_payment_intent_id
 */
export async function performTimeWindowMatching(
  db: Db,
  supabase: any,
  squareAccessToken: string,
  options: {
    windowMinutes?: number;
    locationIds?: string[];
    environment?: string;
    batchDelay?: number;
    rateLimitDelay?: number;
  } = {}
): Promise<{
  results: TimeWindowSearchResult[];
  statistics: ReturnType<SquareTimeWindowMatcher['getMatchStatistics']>;
}> {
  
  const matcher = new SquareTimeWindowMatcher(
    db, 
    squareAccessToken, 
    options.environment || 'production'
  );
  
  // Set rate limiting if specified
  if (options.rateLimitDelay !== undefined) {
    matcher.setRateLimitDelay(options.rateLimitDelay);
  }
  
  // Load registrations
  const registrations = await matcher.loadRegistrationsWithNullStripe(supabase);
  
  // Perform batch search
  const results = await matcher.batchSearchRegistrations(
    registrations,
    options.windowMinutes || 5,
    options.locationIds,
    options.batchDelay || 1000
  );
  
  // Get statistics
  const statistics = matcher.getMatchStatistics(results);
  
  console.log('\n📊 TIME-WINDOW MATCHING STATISTICS:');
  console.log(`Total registrations processed: ${statistics.totalRegistrations}`);
  console.log(`Registrations with candidates: ${statistics.registrationsWithCandidates}`);
  console.log(`Total payment candidates found: ${statistics.totalCandidates}`);
  console.log(`Average candidates per registration: ${statistics.averageCandidatesPerRegistration.toFixed(2)}`);
  console.log(`Total API time: ${(statistics.totalApiTime / 1000).toFixed(2)}s`);
  console.log(`Average API time per registration: ${statistics.averageApiTime.toFixed(0)}ms`);
  console.log(`Errors encountered: ${statistics.errorCount}`);
  
  return {
    results,
    statistics
  };
}