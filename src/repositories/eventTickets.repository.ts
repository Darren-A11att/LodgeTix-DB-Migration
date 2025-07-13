/**
 * MongoDB Repository for eventTickets collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface EventTicket {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class EventTicketsRepository {
  private collection: Collection<EventTicket>;

  constructor(database: Db) {
    this.collection = database.collection<EventTicket>('eventTickets');
  }

  find(filter: Filter<EventTicket> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<EventTicket>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: EventTicket): Promise<InsertOneResult<EventTicket>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<EventTicket>, update: UpdateFilter<EventTicket>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<EventTicket>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<EventTicket> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}