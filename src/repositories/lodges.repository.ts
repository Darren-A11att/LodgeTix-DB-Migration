/**
 * MongoDB Repository for lodges collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Lodge {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class LodgesRepository {
  private collection: Collection<Lodge>;

  constructor(database: Db) {
    this.collection = database.collection<Lodge>('lodges');
  }

  find(filter: Filter<Lodge> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Lodge>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Lodge): Promise<InsertOneResult<Lodge>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Lodge>, update: UpdateFilter<Lodge>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Lodge>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Lodge> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}