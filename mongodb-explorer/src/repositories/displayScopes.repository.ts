/**
 * MongoDB Repository for displayScopes collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface DisplayScope {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class DisplayScopesRepository {
  private collection: Collection<DisplayScope>;

  constructor(database: Db) {
    this.collection = database.collection<DisplayScope>('displayScopes');
  }

  find(filter: Filter<DisplayScope> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<DisplayScope>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: DisplayScope): Promise<InsertOneResult<DisplayScope>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<DisplayScope>, update: UpdateFilter<DisplayScope>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<DisplayScope>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<DisplayScope> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}