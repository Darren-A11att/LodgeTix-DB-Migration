/**
 * MongoDB Repository for userRoles collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface UserRole {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class UserRolesRepository {
  private collection: Collection<UserRole>;

  constructor(database: Db) {
    this.collection = database.collection<UserRole>('userRoles');
  }

  find(filter: Filter<UserRole> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<UserRole>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: UserRole): Promise<InsertOneResult<UserRole>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<UserRole>, update: UpdateFilter<UserRole>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<UserRole>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<UserRole> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}