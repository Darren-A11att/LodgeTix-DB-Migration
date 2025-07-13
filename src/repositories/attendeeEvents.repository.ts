/**
 * MongoDB Repository for attendeeEvents collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface AttendeeEvent {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class AttendeeEventsRepository {
  private collection: Collection<AttendeeEvent>;

  constructor(database: Db) {
    this.collection = database.collection<AttendeeEvent>('attendeeEvents');
  }

  find(filter: Filter<AttendeeEvent> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<AttendeeEvent>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: AttendeeEvent): Promise<InsertOneResult<AttendeeEvent>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<AttendeeEvent>, update: UpdateFilter<AttendeeEvent>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<AttendeeEvent>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<AttendeeEvent> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}