/**
 * MongoDB Repository for packages collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Package {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class PackagesRepository {
  private collection: Collection<Package>;

  constructor(database: Db) {
    this.collection = database.collection<Package>('packages');
  }

  find(filter: Filter<Package> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Package>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Package): Promise<InsertOneResult<Package>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Package>, update: UpdateFilter<Package>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Package>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Package> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}