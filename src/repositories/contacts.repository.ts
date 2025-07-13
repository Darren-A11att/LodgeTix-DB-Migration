/**
 * MongoDB Repository for contacts collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Contact {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class ContactsRepository {
  private collection: Collection<Contact>;

  constructor(database: Db) {
    this.collection = database.collection<Contact>('contacts');
  }

  find(filter: Filter<Contact> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Contact>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Contact): Promise<InsertOneResult<Contact>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Contact>, update: UpdateFilter<Contact>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Contact>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Contact> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}