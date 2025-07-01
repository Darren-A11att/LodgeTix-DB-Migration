/**
 * MongoDB Repository for events collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Event {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class EventsRepository {
  private collection: Collection<Event>;

  constructor(database: Db) {
    this.collection = database.collection<Event>('events');
  }

  find(filter: Filter<Event> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Event>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Event): Promise<InsertOneResult<Event>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Event>, update: UpdateFilter<Event>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Event>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Event> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}