/**
 * MongoDB Repository for memberships collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Membership {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class MembershipsRepository {
  private collection: Collection<Membership>;

  constructor(database: Db) {
    this.collection = database.collection<Membership>('memberships');
  }

  find(filter: Filter<Membership> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Membership>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Membership): Promise<InsertOneResult<Membership>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Membership>, update: UpdateFilter<Membership>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Membership>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Membership> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}