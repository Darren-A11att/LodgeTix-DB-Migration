/**
 * MongoDB Repository for attendees collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Attendee {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class AttendeesRepository {
  private collection: Collection<Attendee>;

  constructor(database: Db) {
    this.collection = database.collection<Attendee>('attendees');
  }

  find(filter: Filter<Attendee> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Attendee>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Attendee): Promise<InsertOneResult<Attendee>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Attendee>, update: UpdateFilter<Attendee>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Attendee>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Attendee> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}