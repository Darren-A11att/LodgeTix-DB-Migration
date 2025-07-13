/**
 * MongoDB Repository for locations collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface Location {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class LocationsRepository {
  private collection: Collection<Location>;

  constructor(database: Db) {
    this.collection = database.collection<Location>('locations');
  }

  find(filter: Filter<Location> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<Location>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: Location): Promise<InsertOneResult<Location>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<Location>, update: UpdateFilter<Location>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<Location>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<Location> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}