/**
 * MongoDB Repository for lodgeCreationRateLimit collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface LodgeCreationRateLimit {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class LodgeCreationRateLimitRepository {
  private collection: Collection<LodgeCreationRateLimit>;

  constructor(database: Db) {
    this.collection = database.collection<LodgeCreationRateLimit>('lodgeCreationRateLimit');
  }

  find(filter: Filter<LodgeCreationRateLimit> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<LodgeCreationRateLimit>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: LodgeCreationRateLimit): Promise<InsertOneResult<LodgeCreationRateLimit>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<LodgeCreationRateLimit>, update: UpdateFilter<LodgeCreationRateLimit>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<LodgeCreationRateLimit>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<LodgeCreationRateLimit> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}