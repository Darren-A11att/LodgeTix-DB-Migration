/**
 * MongoDB Repository for contacts collection
 * Converted from MongoDB Relational Migrator output
 */
import { Db, Collection, Filter, UpdateFilter, InsertOneResult, UpdateResult, DeleteResult } from 'mongodb';

interface RegistrationRef {
  functionId: string;
  functionName: string;
  registrationId: string;
  confirmationNumber: string;
  attendeeId?: string;
}

interface OrderRef {
  functionId: string;
  functionName: string;
  registrationId: string;
  confirmationNumber: string;
  attendeeId?: string;
}

// Loose type for flexibility during migration/cleanup
export interface Contact {
  _id?: any;
  title?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  address?: string;
  state?: string;
  postcode?: string;
  country?: string;
  relationships?: any;
  memberships?: any;
  uniqueKey?: string;
  roles?: Array<'customer' | 'attendee'>;
  sources?: Array<'registration' | 'attendee'>;
  linkedPartnerId?: any;
  // Structured reference arrays (new approach)
  registrations?: RegistrationRef[];
  orders?: OrderRef[];
  // Legacy reference tracking (kept for backward compatibility)
  customerRef?: any;
  attendeeRefs?: any[];
  registrationRefs?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  lastSeenAs?: 'customer' | 'attendee';
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