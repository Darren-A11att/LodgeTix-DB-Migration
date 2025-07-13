/**
 * MongoDB Repository for platformTransfers collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface PlatformTransfer {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class PlatformTransfersRepository {
  private collection: Collection<PlatformTransfer>;

  constructor(database: Db) {
    this.collection = database.collection<PlatformTransfer>('platformTransfers');
  }

  find(filter: Filter<PlatformTransfer> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<PlatformTransfer>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: PlatformTransfer): Promise<InsertOneResult<PlatformTransfer>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<PlatformTransfer>, update: UpdateFilter<PlatformTransfer>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<PlatformTransfer>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<PlatformTransfer> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}