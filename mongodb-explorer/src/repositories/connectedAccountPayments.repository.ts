/**
 * MongoDB Repository for connectedAccountPayments collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface ConnectedAccountPayment {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class ConnectedAccountPaymentsRepository {
  private collection: Collection<ConnectedAccountPayment>;

  constructor(database: Db) {
    this.collection = database.collection<ConnectedAccountPayment>('connectedAccountPayments');
  }

  find(filter: Filter<ConnectedAccountPayment> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<ConnectedAccountPayment>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: ConnectedAccountPayment): Promise<InsertOneResult<ConnectedAccountPayment>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<ConnectedAccountPayment>, update: UpdateFilter<ConnectedAccountPayment>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<ConnectedAccountPayment>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<ConnectedAccountPayment> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}