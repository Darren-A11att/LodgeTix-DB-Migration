/**
 * Utility functions for field transformation and comparison
 * Supports snake_case to camelCase conversion and field-level comparison
 */

import * as crypto from 'crypto';

/**
 * Converts snake_case strings to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Recursively transforms object keys from snake_case to camelCase
 */
export function transformObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectKeys(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      transformed[camelKey] = transformObjectKeys(value);
    }
    
    return transformed;
  }

  return obj;
}

/**
 * Production metadata interface for tracking import relationships
 */
export interface ProductionMeta {
  productionObjectId?: string;
  lastImportedAt: Date;
  lastSourceModified: Date;
  source: 'stripe' | 'square' | 'supabase';
  importSource: string; // provider name or 'supabase'
}

/**
 * Compares two objects field by field based on timestamps
 * Returns true if update is needed
 */
export function shouldUpdateField(
  importValue: any,
  productionValue: any,
  importTimestamp: Date,
  productionTimestamp: Date
): boolean {
  // If import is newer and values are different, update
  if (importTimestamp > productionTimestamp) {
    return JSON.stringify(importValue) !== JSON.stringify(productionValue);
  }
  
  // If same timestamp but different values, prefer import
  if (importTimestamp.getTime() === productionTimestamp.getTime()) {
    return JSON.stringify(importValue) !== JSON.stringify(productionValue);
  }
  
  return false;
}

/**
 * Performs field-by-field comparison and creates an update object
 */
export function createSelectiveUpdate(
  importDoc: any,
  productionDoc: any,
  importMeta: ProductionMeta
): { updateFields: any; hasChanges: boolean } {
  const updateFields: any = {};
  let hasChanges = false;

  // Always update metadata
  updateFields._productionMeta = importMeta;

  // Compare each field in import document
  for (const [key, importValue] of Object.entries(importDoc)) {
    // Skip metadata fields
    if (key.startsWith('_')) continue;

    const productionValue = productionDoc?.[key];
    const productionMeta = productionDoc?._productionMeta as ProductionMeta;
    const productionTimestamp = productionMeta?.lastImportedAt || new Date(0);

    if (shouldUpdateField(importValue, productionValue, importMeta.lastImportedAt, productionTimestamp)) {
      updateFields[key] = importValue;
      hasChanges = true;
    }
  }

  return { updateFields, hasChanges };
}

/**
 * Collection name mapping from old format to new format
 */
export const COLLECTION_MAPPING = {
  // Old format -> New format
  'payments_import': 'import_payments',
  'registrations_import': 'import_registrations',
  'attendees_import': 'import_attendees',
  'tickets_import': 'import_tickets',
  'contacts_import': 'import_contacts',
  'customers_import': 'import_customers',
  
  // Production collections remain the same
  'payments': 'payments',
  'registrations': 'registrations',
  'attendees': 'attendees',
  'tickets': 'tickets',
  'contacts': 'contacts',
  'customers': 'customers'
};

/**
 * Gets the correct collection name based on mapping
 */
export function getCollectionName(oldName: string): string {
  return COLLECTION_MAPPING[oldName] || oldName;
}

/**
 * Creates import document with proper metadata and transformations
 */
export function createImportDocument(
  sourceDoc: any,
  source: 'stripe' | 'square' | 'supabase',
  importSource: string,
  additionalFields: any = {}
): any {
  // Transform snake_case to camelCase for all fields
  const transformedDoc = transformObjectKeys(sourceDoc);
  
  // Add production metadata
  const productionMeta: ProductionMeta = {
    lastImportedAt: new Date(),
    lastSourceModified: new Date(sourceDoc.updated_at || sourceDoc.updatedAt || sourceDoc.created_at || sourceDoc.createdAt || Date.now()),
    source,
    importSource
  };

  return {
    ...transformedDoc,
    ...additionalFields,
    _importedAt: new Date(),
    _productionMeta: productionMeta
  };
}

/**
 * Generates SHA256 hash for customer deduplication
 * Based on firstName + lastName + email (all lowercase, trimmed)
 */
export function generateCustomerHash(firstName: string, lastName: string, email: string): string {
  const normalizedData = [
    (firstName || '').toLowerCase().trim(),
    (lastName || '').toLowerCase().trim(),
    (email || '').toLowerCase().trim()
  ].join('|');
  
  return crypto.createHash('sha256').update(normalizedData).digest('hex');
}

/**
 * Determines customer type based on business name
 */
export function determineCustomerType(businessName?: string): 'person' | 'business' {
  return businessName && businessName.trim() ? 'business' : 'person';
}

/**
 * Transforms booking contact to customer format
 */
export function createCustomerFromBookingContact(bookingContact: any, registration: any): any {
  const firstName = bookingContact.firstName || bookingContact.first_name || '';
  const lastName = bookingContact.lastName || bookingContact.last_name || '';
  const email = bookingContact.email || '';
  const businessName = bookingContact.businessName || bookingContact.business_name;

  const hash = generateCustomerHash(firstName, lastName, email);
  const customerType = determineCustomerType(businessName);

  return {
    hash,
    customerType,
    firstName,
    lastName,
    email,
    businessName: businessName || null,
    phone: bookingContact.phone || null,
    address: {
      street: bookingContact.address || bookingContact.street || null,
      city: bookingContact.city || null,
      state: bookingContact.state || bookingContact.province || null,
      postalCode: bookingContact.postalCode || bookingContact.postal_code || bookingContact.zipCode || bookingContact.zip_code || null,
      country: bookingContact.country || null
    },
    registrations: [], // Will be populated during sync
    createdAt: new Date(),
    updatedAt: new Date()
  };
}