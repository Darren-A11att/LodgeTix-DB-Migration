/**
 * MongoDB Repository for organisationPayouts collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface OrganisationPayout {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class OrganisationPayoutsRepository {
  private collection: Collection<OrganisationPayout>;

  constructor(database: Db) {
    this.collection = database.collection<OrganisationPayout>('organisationPayouts');
  }

  find(filter: Filter<OrganisationPayout> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<OrganisationPayout>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: OrganisationPayout): Promise<InsertOneResult<OrganisationPayout>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<OrganisationPayout>, update: UpdateFilter<OrganisationPayout>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<OrganisationPayout>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<OrganisationPayout> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}