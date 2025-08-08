import { Db } from 'mongodb';
import { SquareTimeWindowMatcher, TimeWindowSearchResult, RegistrationRecord } from './square-time-window-matcher';

/**
 * Utility functions for Square API time-window matching
 * 
 * These utilities provide easy integration points for existing workflows
 * that need to match registrations to Square payments using time windows.
 */

export interface SquareTimeWindowConfig {
  /** Time window in minutes around registration creation (default: 5) */
  windowMinutes?: number;
  /** Square location IDs to filter by (optional) */
  locationIds?: string[];
  /** Square environment: 'production' or 'sandbox' (default: 'production') */
  environment?: 'production' | 'sandbox';
  /** Delay between API calls in ms for rate limiting (default: 100) */
  rateLimitDelay?: number;
  /** Delay between processing registrations in ms (default: 1000) */
  batchDelay?: number;
  /** Minimum match score to consider as valid match (default: 50) */
  minMatchScore?: number;
}

export interface MatchingResult {
  registrationId: string;
  squarePaymentId: string | null;
  matchScore: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  candidatesFound: number;
  processingTime: number;
  error?: string;
}

export interface BatchMatchingResults {
  results: MatchingResult[];
  statistics: {
    totalProcessed: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
    noMatches: number;
    errors: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    totalApiCalls: number;
    totalCandidatesFound: number;
  };
}

/**
 * Main utility class for Square time-window matching operations
 */
export class SquareTimeWindowUtilities {
  private matcher: SquareTimeWindowMatcher;
  private config: Required<SquareTimeWindowConfig>;

  constructor(
    db: Db,
    squareAccessToken: string,
    config: SquareTimeWindowConfig = {}
  ) {
    this.config = {
      windowMinutes: config.windowMinutes ?? 5,
      locationIds: config.locationIds ?? [],
      environment: config.environment ?? 'production',
      rateLimitDelay: config.rateLimitDelay ?? 100,
      batchDelay: config.batchDelay ?? 1000,
      minMatchScore: config.minMatchScore ?? 50
    };

    this.matcher = new SquareTimeWindowMatcher(
      db,
      squareAccessToken,
      this.config.environment
    );

    this.matcher.setRateLimitDelay(this.config.rateLimitDelay);
  }

  /**
   * Find Square payment matches for a single registration
   * 
   * @param registration - The registration to find matches for
   * @returns Promise<MatchingResult>
   */
  async findMatchForRegistration(registration: RegistrationRecord): Promise<MatchingResult> {
    const startTime = Date.now();

    try {
      // Search for payment candidates in time window
      const searchResult = await this.matcher.searchPaymentsInTimeWindow(
        registration,
        this.config.windowMinutes,
        this.config.locationIds.length > 0 ? this.config.locationIds : undefined
      );

      if (searchResult.error) {
        return {
          registrationId: registration.registration_id,
          squarePaymentId: null,
          matchScore: 0,
          confidence: 'none',
          reasons: [`Search error: ${searchResult.error}`],
          candidatesFound: 0,
          processingTime: Date.now() - startTime,
          error: searchResult.error
        };
      }

      // If no candidates found
      if (searchResult.candidates.length === 0) {
        return {
          registrationId: registration.registration_id,
          squarePaymentId: null,
          matchScore: 0,
          confidence: 'none',
          reasons: ['No payment candidates found in time window'],
          candidatesFound: 0,
          processingTime: Date.now() - startTime
        };
      }

      // Calculate match scores for all candidates
      const scoredCandidates = searchResult.candidates.map(candidate => {
        const scoreResult = this.matcher.calculateMatchScore(registration, candidate);
        return {
          candidate,
          ...scoreResult
        };
      });

      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

      const bestMatch = scoredCandidates[0];

      // Determine confidence level
      let confidence: 'high' | 'medium' | 'low' | 'none';
      if (bestMatch.totalScore >= 70) {
        confidence = 'high';
      } else if (bestMatch.totalScore >= this.config.minMatchScore) {
        confidence = 'medium';
      } else if (bestMatch.totalScore >= 30) {
        confidence = 'low';
      } else {
        confidence = 'none';
      }

      return {
        registrationId: registration.registration_id,
        squarePaymentId: confidence !== 'none' ? bestMatch.candidate.id : null,
        matchScore: bestMatch.totalScore,
        confidence,
        reasons: bestMatch.reasons,
        candidatesFound: searchResult.candidates.length,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        registrationId: registration.registration_id,
        squarePaymentId: null,
        matchScore: 0,
        confidence: 'none',
        reasons: [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        candidatesFound: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find Square payment matches for multiple registrations
   * 
   * @param registrations - Array of registrations to process
   * @returns Promise<BatchMatchingResults>
   */
  async findMatchesForRegistrations(registrations: RegistrationRecord[]): Promise<BatchMatchingResults> {
    console.log(`🚀 Starting batch matching for ${registrations.length} registrations`);
    console.log(`   Configuration: ±${this.config.windowMinutes}min window, ${this.config.rateLimitDelay}ms rate limit`);

    const results: MatchingResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < registrations.length; i++) {
      const registration = registrations[i];
      
      console.log(`Processing ${i + 1}/${registrations.length}: ${registration.registration_id}`);

      const result = await this.findMatchForRegistration(registration);
      results.push(result);

      // Show progress
      if (result.confidence !== 'none') {
        console.log(`   ✅ ${result.confidence.toUpperCase()} confidence match: ${result.squarePaymentId} (score: ${result.matchScore.toFixed(1)})`);
      } else {
        console.log(`   ❌ No match found (${result.candidatesFound} candidates)`);
      }

      // Batch delay between registrations
      if (i < registrations.length - 1 && this.config.batchDelay > 0) {
        await this.sleep(this.config.batchDelay);
      }
    }

    // Calculate statistics
    const statistics = this.calculateBatchStatistics(results, Date.now() - startTime);

    console.log(`✅ Batch matching completed in ${(statistics.totalProcessingTime / 1000).toFixed(2)}s`);

    return {
      results,
      statistics
    };
  }

  /**
   * Find high confidence matches only (score >= 70)
   * 
   * @param registrations - Array of registrations to process
   * @returns Promise<MatchingResult[]> - Only high confidence matches
   */
  async findHighConfidenceMatches(registrations: RegistrationRecord[]): Promise<MatchingResult[]> {
    const batchResults = await this.findMatchesForRegistrations(registrations);
    return batchResults.results.filter(result => result.confidence === 'high');
  }

  /**
   * Get processing recommendations based on match results
   * 
   * @param results - Matching results from batch processing
   * @returns Object with recommendations
   */
  getProcessingRecommendations(results: MatchingResult[]): {
    autoProcessable: MatchingResult[];
    requiresReview: MatchingResult[];
    needsInvestigation: MatchingResult[];
    recommendations: string[];
  } {
    const autoProcessable = results.filter(r => r.confidence === 'high');
    const requiresReview = results.filter(r => r.confidence === 'medium');
    const needsInvestigation = results.filter(r => r.confidence === 'low' || r.error);

    const recommendations: string[] = [];

    if (autoProcessable.length > 0) {
      recommendations.push(`${autoProcessable.length} high-confidence matches can be automatically processed`);
    }

    if (requiresReview.length > 0) {
      recommendations.push(`${requiresReview.length} medium-confidence matches require manual review`);
    }

    if (needsInvestigation.length > 0) {
      recommendations.push(`${needsInvestigation.length} registrations need investigation or have errors`);
    }

    const noMatchCount = results.filter(r => r.confidence === 'none' && !r.error).length;
    if (noMatchCount > 0) {
      recommendations.push(`${noMatchCount} registrations have no Square payment matches in the time window`);
    }

    const avgCandidates = results.reduce((sum, r) => sum + r.candidatesFound, 0) / results.length;
    if (avgCandidates > 3) {
      recommendations.push('Consider narrowing the time window to reduce false positives');
    } else if (avgCandidates < 0.5) {
      recommendations.push('Consider widening the time window to find more potential matches');
    }

    return {
      autoProcessable,
      requiresReview,
      needsInvestigation,
      recommendations
    };
  }

  /**
   * Update registration records with Square payment IDs for high confidence matches
   * 
   * @param supabase - Supabase client
   * @param matches - High confidence matches to update
   * @param dryRun - If true, only log what would be updated (default: true)
   * @returns Promise<{ updated: number; errors: string[] }>
   */
  async updateRegistrationsWithMatches(
    supabase: any,
    matches: MatchingResult[],
    dryRun: boolean = true
  ): Promise<{ updated: number; errors: string[] }> {
    console.log(`${dryRun ? '🧪 DRY RUN:' : '💾 UPDATING:'} Processing ${matches.length} matches`);

    let updated = 0;
    const errors: string[] = [];

    for (const match of matches) {
      if (!match.squarePaymentId) {
        errors.push(`${match.registrationId}: No Square payment ID to update`);
        continue;
      }

      console.log(`${dryRun ? 'Would update' : 'Updating'} ${match.registrationId} -> ${match.squarePaymentId} (score: ${match.matchScore})`);

      if (!dryRun) {
        try {
          const { error } = await supabase
            .from('registrations')
            .update({ 
              square_payment_id: match.squarePaymentId,
              updated_at: new Date().toISOString()
            })
            .eq('registration_id', match.registrationId);

          if (error) {
            errors.push(`${match.registrationId}: ${error.message}`);
          } else {
            updated++;
          }

        } catch (error) {
          errors.push(`${match.registrationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        updated++; // Count as updated for dry run
      }
    }

    console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} registrations`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
      errors.slice(0, 5).forEach(error => console.log(`   ${error}`));
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more errors`);
      }
    }

    return { updated, errors };
  }

  /**
   * Export matching results to JSON file
   * 
   * @param results - Matching results to export
   * @param filename - Output filename (optional)
   * @returns Promise<string> - Path to exported file
   */
  async exportResults(results: BatchMatchingResults, filename?: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');

    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `square-time-window-matches-${timestamp}.json`;
    }

    const filepath = path.resolve(filename);

    const exportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        tool: 'Square Time-Window Matcher',
        version: '1.0.0',
        configuration: this.config
      },
      statistics: results.statistics,
      matches: results.results,
      highConfidenceMatches: results.results.filter(r => r.confidence === 'high'),
      mediumConfidenceMatches: results.results.filter(r => r.confidence === 'medium'),
      summary: this.getProcessingRecommendations(results.results)
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log(`📁 Results exported to: ${filepath}`);
    console.log(`📊 File size: ${(fs.statSync(filepath).size / 1024).toFixed(1)} KB`);

    return filepath;
  }

  /**
   * Calculate statistics for batch processing results
   */
  private calculateBatchStatistics(results: MatchingResult[], totalTime: number) {
    const totalProcessed = results.length;
    const highConfidenceMatches = results.filter(r => r.confidence === 'high').length;
    const mediumConfidenceMatches = results.filter(r => r.confidence === 'medium').length;
    const lowConfidenceMatches = results.filter(r => r.confidence === 'low').length;
    const noMatches = results.filter(r => r.confidence === 'none').length;
    const errors = results.filter(r => r.error).length;
    const totalCandidatesFound = results.reduce((sum, r) => sum + r.candidatesFound, 0);

    return {
      totalProcessed,
      highConfidenceMatches,
      mediumConfidenceMatches,
      lowConfidenceMatches,
      noMatches,
      errors,
      totalProcessingTime: totalTime,
      averageProcessingTime: totalTime / totalProcessed,
      totalApiCalls: totalProcessed, // One API call per registration in time-window approach
      totalCandidatesFound
    };
  }

  /**
   * Helper method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Quick utility function to match registrations with null stripe_payment_intent_id
 * 
 * @param db - MongoDB database instance
 * @param supabase - Supabase client
 * @param squareAccessToken - Square API access token
 * @param config - Configuration options
 * @returns Promise<BatchMatchingResults>
 */
export async function matchRegistrationsWithNullStripe(
  db: Db,
  supabase: any,
  squareAccessToken: string,
  config: SquareTimeWindowConfig = {}
): Promise<BatchMatchingResults> {
  
  console.log('🔍 Loading registrations with null stripe_payment_intent_id...');
  
  // Load registrations with null stripe_payment_intent_id
  const { data: registrations, error } = await supabase
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
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load registrations: ${error.message}`);
  }

  if (!registrations || registrations.length === 0) {
    throw new Error('No registrations with null stripe_payment_intent_id found');
  }

  console.log(`✅ Found ${registrations.length} registrations to process`);

  // Create utilities instance and process matches
  const utilities = new SquareTimeWindowUtilities(db, squareAccessToken, config);
  
  return await utilities.findMatchesForRegistrations(registrations);
}

/**
 * Quick utility to get only high confidence matches for auto-processing
 * 
 * @param db - MongoDB database instance
 * @param supabase - Supabase client
 * @param squareAccessToken - Square API access token
 * @param config - Configuration options
 * @returns Promise<MatchingResult[]> - High confidence matches only
 */
export async function getHighConfidenceMatches(
  db: Db,
  supabase: any,
  squareAccessToken: string,
  config: SquareTimeWindowConfig = {}
): Promise<MatchingResult[]> {
  
  const results = await matchRegistrationsWithNullStripe(db, supabase, squareAccessToken, config);
  return results.results.filter(result => result.confidence === 'high');
}

export { SquareTimeWindowMatcher, TimeWindowSearchResult, RegistrationRecord };