/**
 * MongoDB Repository for registrations collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Registration {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class RegistrationsRepository {
  private collection: Collection<Registration>;

  constructor(database: Db) {
    this.collection = database.collection<Registration>('registrations');
  }

  find(filter: Filter<Registration> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Registration>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Registration): Promise<InsertOneResult<Registration>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Registration>, update: UpdateFilter<Registration>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Registration>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Registration> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}