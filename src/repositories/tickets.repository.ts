/**
 * MongoDB Repository for tickets collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Ticket {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class TicketsRepository {
  private collection: Collection<Ticket>;

  constructor(database: Db) {
    this.collection = database.collection<Ticket>('tickets');
  }

  find(filter: Filter<Ticket> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Ticket>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Ticket): Promise<InsertOneResult<Ticket>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Ticket>, update: UpdateFilter<Ticket>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Ticket>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Ticket> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}