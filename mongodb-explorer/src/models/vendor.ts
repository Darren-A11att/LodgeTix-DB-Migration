import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Vendor Schema Type Definitions (Simple Supplier Details)
export interface VendorContact {
  contactId: string; // UUID v4
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Vendor {
  vendorId: string; // UUID v4
  businessName: string;
  businessNumber: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  country: string;
  email: string;
  phone: string;
  website?: string;
  contacts: VendorContact[];
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateVendor(vendor: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!vendor.vendorId || typeof vendor.vendorId !== 'string') {
    errors.push('vendorId is required and must be a string');
  } else if (!isValidUUID(vendor.vendorId)) {
    errors.push('vendorId must be a valid UUID v4');
  }

  if (!vendor.businessName || typeof vendor.businessName !== 'string') {
    errors.push('businessName is required and must be a string');
  }

  if (!vendor.businessNumber || typeof vendor.businessNumber !== 'string') {
    errors.push('businessNumber is required and must be a string');
  }

  if (!vendor.addressLine1 || typeof vendor.addressLine1 !== 'string') {
    errors.push('addressLine1 is required and must be a string');
  }

  if (!vendor.suburb || typeof vendor.suburb !== 'string') {
    errors.push('suburb is required and must be a string');
  }

  if (!vendor.state || typeof vendor.state !== 'string') {
    errors.push('state is required and must be a string');
  }

  if (!vendor.country || typeof vendor.country !== 'string') {
    errors.push('country is required and must be a string');
  }

  if (!vendor.email || typeof vendor.email !== 'string') {
    errors.push('email is required and must be a string');
  } else if (!isValidEmail(vendor.email)) {
    errors.push('email must be a valid email address');
  }

  if (!vendor.phone || typeof vendor.phone !== 'string') {
    errors.push('phone is required and must be a string');
  }

  // Validate contacts array
  if (!Array.isArray(vendor.contacts)) {
    errors.push('contacts must be an array');
  } else {
    vendor.contacts.forEach((contact: any, i: number) => {
      if (!contact.contactId || typeof contact.contactId !== 'string') {
        errors.push(`contacts[${i}].contactId is required and must be a string`);
      } else if (!isValidUUID(contact.contactId)) {
        errors.push(`contacts[${i}].contactId must be a valid UUID v4`);
      }

      if (!contact.role || typeof contact.role !== 'string') {
        errors.push(`contacts[${i}].role is required and must be a string`);
      }

      if (!contact.firstName || typeof contact.firstName !== 'string') {
        errors.push(`contacts[${i}].firstName is required and must be a string`);
      }

      if (!contact.lastName || typeof contact.lastName !== 'string') {
        errors.push(`contacts[${i}].lastName is required and must be a string`);
      }

      if (!contact.email || typeof contact.email !== 'string') {
        errors.push(`contacts[${i}].email is required and must be a string`);
      } else if (!isValidEmail(contact.email)) {
        errors.push(`contacts[${i}].email must be a valid email address`);
      }

      if (!contact.phone || typeof contact.phone !== 'string') {
        errors.push(`contacts[${i}].phone is required and must be a string`);
      }
    });
  }

  // Validate timestamps
  if (!vendor.createdAt || !(vendor.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!vendor.lastModifiedAt || !(vendor.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper functions
export function createVendorContact(data: {
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): VendorContact {
  return {
    contactId: uuidv4(),
    role: data.role,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone
  };
}

export function createVendor(data: {
  businessName: string;
  businessNumber: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  country: string;
  email: string;
  phone: string;
  website?: string;
  contacts?: VendorContact[];
}): Vendor {
  const now = new Date();
  const vendor: Vendor = {
    vendorId: uuidv4(),
    businessName: data.businessName,
    businessNumber: data.businessNumber,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    suburb: data.suburb,
    state: data.state,
    country: data.country,
    email: data.email,
    phone: data.phone,
    website: data.website,
    contacts: data.contacts || [],
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateVendor(vendor);
  if (!validation.valid) {
    throw new Error(`Invalid vendor: ${validation.errors.join(', ')}`);
  }

  return vendor;
}

// Vendor Repository class for database operations
export class VendorRepository {
  private collection: Collection<Vendor>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Vendor>('vendor');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on vendorId
    await this.collection.createIndex(
      { vendorId: 1 },
      { unique: true }
    );
    
    // Create unique index on business number
    await this.collection.createIndex(
      { businessNumber: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ businessName: 1 });
    await this.collection.createIndex({ email: 1 });
    await this.collection.createIndex({ 'contacts.email': 1 });
    await this.collection.createIndex({ createdAt: -1 });
  }

  async create(vendorData: Parameters<typeof createVendor>[0]): Promise<Vendor> {
    const vendor = createVendor(vendorData);

    // Validate before inserting
    const validation = validateVendor(vendor);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid vendor: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(vendor as any);
    return vendor;
  }

  async findByVendorId(vendorId: string): Promise<Vendor | null> {
    return this.collection.findOne({ vendorId }) as Promise<Vendor | null>;
  }

  async findByBusinessNumber(businessNumber: string): Promise<Vendor | null> {
    return this.collection.findOne({ businessNumber }) as Promise<Vendor | null>;
  }

  async findByEmail(email: string): Promise<Vendor | null> {
    return this.collection.findOne({ email }) as Promise<Vendor | null>;
  }

  async findByBusinessName(businessName: string): Promise<Vendor | null> {
    return this.collection.findOne({ businessName }) as Promise<Vendor | null>;
  }

  async update(vendorId: string, updates: Partial<Vendor>): Promise<Vendor | null> {
    // Don't allow changing vendorId or createdAt
    delete (updates as any).vendorId;
    delete (updates as any).createdAt;
    
    // Always update lastModifiedAt
    const updatesWithTimestamp = {
      ...updates,
      lastModifiedAt: new Date()
    };

    const result = await this.collection.findOneAndUpdate(
      { vendorId },
      { $set: updatesWithTimestamp },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated vendor
      const validation = validateVendor(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid vendor: ${validation.errors.join(', ')}`);
      }
    }

    return result as Vendor | null;
  }

  async addContact(vendorId: string, contact: Omit<VendorContact, 'contactId'>): Promise<Vendor | null> {
    const newContact = createVendorContact(contact);
    
    const result = await this.collection.findOneAndUpdate(
      { vendorId },
      { 
        $push: { contacts: newContact },
        $set: { lastModifiedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result as Vendor | null;
  }

  async updateContact(vendorId: string, contactId: string, updates: Partial<VendorContact>): Promise<Vendor | null> {
    const vendor = await this.findByVendorId(vendorId);
    if (!vendor) return null;

    const contactIndex = vendor.contacts.findIndex(c => c.contactId === contactId);
    if (contactIndex === -1) return null;

    // Don't allow changing contactId
    delete (updates as any).contactId;

    const updatedContact = {
      ...vendor.contacts[contactIndex],
      ...updates
    };

    const result = await this.collection.findOneAndUpdate(
      { vendorId },
      { 
        $set: { 
          [`contacts.${contactIndex}`]: updatedContact,
          lastModifiedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result as Vendor | null;
  }

  async removeContact(vendorId: string, contactId: string): Promise<Vendor | null> {
    const result = await this.collection.findOneAndUpdate(
      { vendorId },
      { 
        $pull: { contacts: { contactId } },
        $set: { lastModifiedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result as Vendor | null;
  }

  async delete(vendorId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ vendorId });
    return result.deletedCount === 1;
  }

  async search(query: string): Promise<Vendor[]> {
    const searchRegex = new RegExp(query, 'i');
    return this.collection.find({
      $or: [
        { businessName: searchRegex },
        { businessNumber: searchRegex },
        { email: searchRegex }
      ]
    }).toArray() as Promise<Vendor[]>;
  }

  async findAll(filter: Partial<Vendor> = {}): Promise<Vendor[]> {
    return this.collection.find(filter)
      .sort({ businessName: 1 })
      .toArray() as Promise<Vendor[]>;
  }

  async findByContactEmail(contactEmail: string): Promise<Vendor[]> {
    return this.collection.find({
      'contacts.email': contactEmail
    }).toArray() as Promise<Vendor[]>;
  }

  async count(): Promise<number> {
    return this.collection.countDocuments();
  }
}

export default VendorRepository;