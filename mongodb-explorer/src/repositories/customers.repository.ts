/**
 * MongoDB Repository for customers collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Customer {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class CustomersRepository {
  private collection: Collection<Customer>;

  constructor(database: Db) {
    this.collection = database.collection<Customer>('customers');
  }

  find(filter: Filter<Customer> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Customer>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Customer): Promise<InsertOneResult<Customer>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Customer>, update: UpdateFilter<Customer>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Customer>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Customer> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}