/**
 * MongoDB Repository for organisations collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Organisation {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class OrganisationsRepository {
  private collection: Collection<Organisation>;

  constructor(database: Db) {
    this.collection = database.collection<Organisation>('organisations');
  }

  find(filter: Filter<Organisation> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Organisation>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Organisation): Promise<InsertOneResult<Organisation>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Organisation>, update: UpdateFilter<Organisation>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Organisation>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Organisation> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}