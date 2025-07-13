import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RegistrationSearchCriteria } from '../types/payment-import';

/**
 * Supabase Registration Search Service
 * 
 * Searches for registrations in Supabase to match with imported payments
 */
export class SupabaseRegistrationSearchService {
  private supabase: SupabaseClient;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * Search for registrations based on various criteria
   */
  async searchRegistrations(criteria: RegistrationSearchCriteria): Promise<{
    registrations: any[];
    totalCount: number;
    searchCriteria: RegistrationSearchCriteria;
    executionTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Start with base query
      let query = this.supabase
        .from('registrations')
        .select('*', { count: 'exact' });
      
      // Apply search filters
      if (criteria.email) {
        query = query.ilike('email', `%${criteria.email}%`);
      }
      
      if (criteria.confirmationNumber) {
        query = query.eq('confirmation_number', criteria.confirmationNumber);
      }
      
      if (criteria.registrationType) {
        query = query.eq('registration_type', criteria.registrationType);
      }
      
      // Amount search with tolerance
      if (criteria.amount) {
        const minAmount = criteria.amount.value * (1 - criteria.amount.tolerance / 100);
        const maxAmount = criteria.amount.value * (1 + criteria.amount.tolerance / 100);
        
        query = query
          .gte('total_amount', minAmount)
          .lte('total_amount', maxAmount);
      }
      
      // Date range search
      if (criteria.dateRange) {
        query = query
          .gte('created_at', criteria.dateRange.start.toISOString())
          .lte('created_at', criteria.dateRange.end.toISOString());
      }
      
      // Customer name search (fuzzy)
      if (criteria.customerName) {
        // Search in multiple name fields
        query = query.or(`full_name.ilike.%${criteria.customerName}%,first_name.ilike.%${criteria.customerName}%,last_name.ilike.%${criteria.customerName}%`);
      }
      
      // Custom fields search
      if (criteria.customFields) {
        for (const [key, value] of Object.entries(criteria.customFields)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }
      
      // Execute query
      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        registrations: data || [],
        totalCount: count || 0,
        searchCriteria: criteria,
        executionTime
      };
      
    } catch (error) {
      console.error('Supabase search error:', error);
      throw error;
    }
  }
  
  /**
   * Get a single registration by ID
   */
  async getRegistrationById(id: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching registration:', error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Search registrations by email with exact match
   */
  async searchByEmail(email: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select('*')
      .eq('email', email);
    
    if (error) {
      console.error('Error searching by email:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Search registrations by confirmation number
   */
  async searchByConfirmationNumber(confirmationNumber: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('registrations')
      .select('*')
      .eq('confirmation_number', confirmationNumber)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.error('Error searching by confirmation number:', error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Advanced search with multiple criteria and scoring
   */
  async advancedSearch(payment: {
    email?: string;
    amount?: number;
    customerName?: string;
    createdAt?: Date;
  }): Promise<Array<{
    registration: any;
    matchScore: number;
    matchedFields: string[];
  }>> {
    const results: Array<{
      registration: any;
      matchScore: number;
      matchedFields: string[];
    }> = [];
    
    // Build search queries for different field combinations
    const searches: Promise<any>[] = [];
    
    // Search by email
    if (payment.email) {
      searches.push(this.searchByEmail(payment.email));
    }
    
    // Search by amount range (within 1%)
    if (payment.amount) {
      const amountSearch = this.supabase
        .from('registrations')
        .select('*')
        .gte('total_amount', payment.amount * 0.99)
        .lte('total_amount', payment.amount * 1.01);
      searches.push(amountSearch);
    }
    
    // Execute all searches in parallel
    const searchResults = await Promise.all(searches);
    
    // Process and score results
    const registrationMap = new Map<string, {
      registration: any;
      matchedFields: Set<string>;
    }>();
    
    // Process email matches
    if (payment.email && searchResults[0]) {
      const emailMatches = searchResults[0].data || searchResults[0];
      for (const reg of emailMatches) {
        if (!registrationMap.has(reg.id)) {
          registrationMap.set(reg.id, {
            registration: reg,
            matchedFields: new Set(['email'])
          });
        } else {
          registrationMap.get(reg.id)!.matchedFields.add('email');
        }
      }
    }
    
    // Process amount matches
    if (payment.amount && searchResults[payment.email ? 1 : 0]) {
      const amountMatches = searchResults[payment.email ? 1 : 0].data || [];
      for (const reg of amountMatches) {
        if (!registrationMap.has(reg.id)) {
          registrationMap.set(reg.id, {
            registration: reg,
            matchedFields: new Set(['amount'])
          });
        } else {
          registrationMap.get(reg.id)!.matchedFields.add('amount');
        }
      }
    }
    
    // Calculate match scores
    for (const [id, data] of registrationMap) {
      const matchedFields = Array.from(data.matchedFields);
      let score = 0;
      
      // Email match is highest confidence
      if (matchedFields.includes('email')) score += 40;
      
      // Amount match
      if (matchedFields.includes('amount')) score += 30;
      
      // Additional scoring based on name similarity
      if (payment.customerName && data.registration.full_name) {
        const similarity = this.calculateNameSimilarity(
          payment.customerName,
          data.registration.full_name
        );
        if (similarity > 0.8) {
          score += 20;
          matchedFields.push('name');
        }
      }
      
      // Date proximity
      if (payment.createdAt && data.registration.created_at) {
        const daysDiff = Math.abs(
          (new Date(data.registration.created_at).getTime() - payment.createdAt.getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= 7) {
          score += 10;
          matchedFields.push('date');
        }
      }
      
      results.push({
        registration: data.registration,
        matchScore: score,
        matchedFields
      });
    }
    
    // Sort by match score descending
    results.sort((a, b) => b.matchScore - a.matchScore);
    
    return results;
  }
  
  /**
   * Calculate similarity between two names (simple implementation)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1;
    
    // Simple character overlap ratio
    const chars1 = new Set(n1.split(''));
    const chars2 = new Set(n2.split(''));
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }
}