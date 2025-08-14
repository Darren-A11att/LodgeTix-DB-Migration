import { MongoClient, Db } from 'mongodb';

// Types for reference data
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface FunctionDetails {
  functionId: string;
  functionName: string;
  name?: string;
  description?: string;
  type?: string;
  eventId?: string;
  [key: string]: any;
}

interface EventTicketDetails {
  eventTicketId: string;
  eventId: string;
  eventName?: string;
  price: number;
  ticketType?: string;
  [key: string]: any;
}

interface EventDetails {
  eventId: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  locationId?: string;
  [key: string]: any;
}

interface LocationDetails {
  locationId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  [key: string]: any;
}

interface LodgeDetails {
  lodgeId: string;
  name: string;
  lodgeNumber?: string;
  locationId?: string;
  organisationId?: string;
  grandLodgeId?: string;
  [key: string]: any;
}

interface OrganisationDetails {
  organisationId: string;
  name: string;
  type?: string;
  description?: string;
  [key: string]: any;
}

export class ReferenceDataService {
  private db: Db;
  private cache: Map<string, CacheItem<any>>;
  private defaultTTL: number;

  constructor(db: Db, defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default TTL
    this.db = db;
    this.cache = new Map();
    this.defaultTTL = defaultTTL;

    // Clean up expired cache entries every minute
    setInterval(() => this.cleanupExpiredCache(), 60 * 1000);
  }

  /**
   * Get function details by function ID
   */
  async getFunctionDetails(functionId: string): Promise<FunctionDetails | null> {
    const cacheKey = `function:${functionId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<FunctionDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database using functionId field
      const collection = this.db.collection('functions');
      const result = await collection.findOne({ functionId: functionId });

      if (result) {
        this.setCache(cacheKey, result);
        return result as FunctionDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching function details for ${functionId}:`, error);
      return null;
    }
  }

  /**
   * Get event ticket details by event ticket ID
   */
  async getEventTicketDetails(eventTicketId: string): Promise<EventTicketDetails | null> {
    const cacheKey = `eventTicket:${eventTicketId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<EventTicketDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database with aggregation to include event name
      const collection = this.db.collection('eventTickets');
      
      const pipeline = [
        { $match: { eventTicketId: eventTicketId } },
        {
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: 'eventId',
            as: 'event'
          }
        },
        {
          $addFields: {
            eventName: { $arrayElemAt: ['$event.name', 0] }
          }
        },
        {
          $project: {
            event: 0 // Remove the joined event array to keep result clean
          }
        }
      ];

      const results = await collection.aggregate(pipeline).toArray();
      const result = results[0];

      if (result) {
        this.setCache(cacheKey, result);
        return result as EventTicketDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching event ticket details for ${eventTicketId}:`, error);
      return null;
    }
  }

  /**
   * Get event details by event ID
   */
  async getEventDetails(eventId: string): Promise<EventDetails | null> {
    const cacheKey = `event:${eventId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<EventDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database using eventId field
      const collection = this.db.collection('events');
      const result = await collection.findOne({ eventId: eventId });

      if (result) {
        this.setCache(cacheKey, result);
        return result as EventDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching event details for ${eventId}:`, error);
      return null;
    }
  }

  /**
   * Get location details by location ID
   */
  async getLocationDetails(locationId: string): Promise<LocationDetails | null> {
    const cacheKey = `location:${locationId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<LocationDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database using locationId field
      const collection = this.db.collection('locations');
      const result = await collection.findOne({ locationId: locationId });

      if (result) {
        this.setCache(cacheKey, result);
        return result as LocationDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching location details for ${locationId}:`, error);
      return null;
    }
  }

  /**
   * Get lodge details by lodge ID
   */
  async getLodgeDetails(lodgeId: string): Promise<LodgeDetails | null> {
    const cacheKey = `lodge:${lodgeId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<LodgeDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database using lodgeId field
      const collection = this.db.collection('lodges');
      const result = await collection.findOne({ lodgeId: lodgeId });

      if (result) {
        this.setCache(cacheKey, result);
        return result as LodgeDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching lodge details for ${lodgeId}:`, error);
      return null;
    }
  }

  /**
   * Get organisation details by organisation ID
   */
  async getOrganisationDetails(organisationId: string): Promise<OrganisationDetails | null> {
    const cacheKey = `organisation:${organisationId}`;
    
    try {
      // Check cache first
      const cached = this.getFromCache<OrganisationDetails>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database using organisationId field
      const collection = this.db.collection('organisations');
      const result = await collection.findOne({ organisationId: organisationId });

      if (result) {
        this.setCache(cacheKey, result);
        return result as OrganisationDetails;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching organisation details for ${organisationId}:`, error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    const now = Date.now();
    if (now > item.timestamp + item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };
    this.cache.set(key, item);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}

/**
 * Factory function to create a ReferenceDataService instance
 */
export function createReferenceDataService(mongoClient: MongoClient, ttl?: number): ReferenceDataService {
  const dbName = process.env.MONGODB_DB || 'lodgetix';
  const db = mongoClient.db(dbName);
  return new ReferenceDataService(db, ttl);
}

// Export types for use in other modules
export type {
  FunctionDetails,
  EventTicketDetails,
  EventDetails,
  LocationDetails,
  LodgeDetails,
  OrganisationDetails
};