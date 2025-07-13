/**
 * MongoDB Repository for grandLodges collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface GrandLodge {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class GrandLodgesRepository {
  private collection: Collection<GrandLodge>;

  constructor(database: Db) {
    this.collection = database.collection<GrandLodge>('grandLodges');
  }

  find(filter: Filter<GrandLodge> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<GrandLodge>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: GrandLodge): Promise<InsertOneResult<GrandLodge>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<GrandLodge>, update: UpdateFilter<GrandLodge>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<GrandLodge>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<GrandLodge> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}