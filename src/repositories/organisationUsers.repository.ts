/**
 * MongoDB Repository for organisationUsers collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface OrganisationUser {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class OrganisationUsersRepository {
  private collection: Collection<OrganisationUser>;

  constructor(database: Db) {
    this.collection = database.collection<OrganisationUser>('organisationUsers');
  }

  find(filter: Filter<OrganisationUser> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<OrganisationUser>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: OrganisationUser): Promise<InsertOneResult<OrganisationUser>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<OrganisationUser>, update: UpdateFilter<OrganisationUser>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<OrganisationUser>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<OrganisationUser> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}