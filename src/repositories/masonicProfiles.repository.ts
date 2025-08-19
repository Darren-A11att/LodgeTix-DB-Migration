/**
 * MongoDB Repository for masonicProfiles collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface MasonicProfile {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class MasonicProfilesRepository {
  private collection: Collection<MasonicProfile>;

  constructor(database: Db) {
    this.collection = database.collection<MasonicProfile>('masonicProfiles');
  }

  find(filter: Filter<MasonicProfile> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<MasonicProfile>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: MasonicProfile): Promise<InsertOneResult<MasonicProfile>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<MasonicProfile>, update: UpdateFilter<MasonicProfile>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<MasonicProfile>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<MasonicProfile> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}