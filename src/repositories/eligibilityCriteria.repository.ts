/**
 * MongoDB Repository for eligibilityCriteria collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface EligibilityCriteria {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class EligibilityCriteriaRepository {
  private collection: Collection<EligibilityCriteria>;

  constructor(database: Db) {
    this.collection = database.collection<EligibilityCriteria>('eligibilityCriteria');
  }

  find(filter: Filter<EligibilityCriteria> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<EligibilityCriteria>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: EligibilityCriteria): Promise<InsertOneResult<EligibilityCriteria>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<EligibilityCriteria>, update: UpdateFilter<EligibilityCriteria>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<EligibilityCriteria>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<EligibilityCriteria> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}