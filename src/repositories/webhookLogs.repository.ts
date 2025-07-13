/**
 * MongoDB Repository for webhookLogs collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

// Loose type for flexibility during migration/cleanup
export interface WebhookLog {
  _id?: any;
  [key: string]: any; // Allow any field with any value
}

export class WebhookLogsRepository {
  private collection: Collection<WebhookLog>;

  constructor(database: Db) {
    this.collection = database.collection<WebhookLog>('webhookLogs');
  }

  find(filter: Filter<WebhookLog> = {}) {
    return this.collection.find(filter);
  }

  async findOne(filter: Filter<WebhookLog>) {
    return this.collection.findOne(filter);
  }

  async findById(id: string) {
    return this.collection.findOne({ _id: id as any });
  }

  async insertOne(document: WebhookLog): Promise<InsertOneResult<WebhookLog>> {
    return this.collection.insertOne(document);
  }

  async updateOne(filter: Filter<WebhookLog>, update: UpdateFilter<WebhookLog>): Promise<UpdateResult> {
    return this.collection.updateOne(filter, update);
  }

  async deleteOne(filter: Filter<WebhookLog>): Promise<DeleteResult> {
    return this.collection.deleteOne(filter);
  }

  async count(filter: Filter<WebhookLog> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}