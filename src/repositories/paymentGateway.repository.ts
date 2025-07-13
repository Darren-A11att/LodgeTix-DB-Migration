/**
 * MongoDB Repository for paymentGateway collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface PaymentGateway {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class PaymentGatewayRepository {
  private collection: Collection<PaymentGateway>;

  constructor(database: Db) {
    this.collection = database.collection<PaymentGateway>('paymentGateway');
  }

  find(filter: Filter<PaymentGateway> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<PaymentGateway>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: PaymentGateway): Promise<InsertOneResult<PaymentGateway>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<PaymentGateway>, update: UpdateFilter<PaymentGateway>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<PaymentGateway>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<PaymentGateway> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}