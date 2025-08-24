/**
 * Supabase to MongoDB Field Mapping Service
 * 
 * Maps UUID fields from Supabase to MongoDB document fields
 * IMPORTANT: Supabase uses UUIDs, MongoDB uses either UUIDs or ObjectIds
 * This service ensures UUIDs are kept as strings, never converted to ObjectIds
 */

import { ObjectId } from 'mongodb';

/**
 * Field mapping configuration for Supabase to MongoDB
 */
export interface FieldMapping {
  supabaseField: string;
  mongoField: string;
  type: 'uuid' | 'objectid' | 'string' | 'number' | 'date' | 'boolean';
  transform?: (value: any) => any;
  required?: boolean;
}

/**
 * Collection-specific mapping configurations
 */
export const SUPABASE_TO_MONGO_MAPPINGS: Record<string, FieldMapping[]> = {
  // Registration mappings
  registrations: [
    { supabaseField: 'registration_id', mongoField: 'registrationId', type: 'uuid', required: true },
    { supabaseField: 'function_id', mongoField: 'functionId', type: 'uuid' },
    { supabaseField: 'event_id', mongoField: 'eventId', type: 'uuid' },
    { supabaseField: 'organisation_id', mongoField: 'organisationId', type: 'uuid' },
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid' },
    { supabaseField: 'booking_contact_id', mongoField: 'bookingContactId', type: 'uuid' },
    { supabaseField: 'package_id', mongoField: 'packageId', type: 'uuid' },
    { supabaseField: 'lodge_id', mongoField: 'lodgeId', type: 'uuid' },
    { supabaseField: 'customer_id', mongoField: 'customerId', type: 'uuid' },
    // Payment gateway IDs (these are external system IDs, not UUIDs)
    { supabaseField: 'stripe_payment_intent_id', mongoField: 'stripePaymentIntentId', type: 'string' },
    { supabaseField: 'stripe_charge_id', mongoField: 'stripeChargeId', type: 'string' },
    { supabaseField: 'square_payment_id', mongoField: 'squarePaymentId', type: 'string' },
    { supabaseField: 'square_order_id', mongoField: 'squareOrderId', type: 'string' },
    // Standard fields
    { supabaseField: 'payment_status', mongoField: 'paymentStatus', type: 'string' },
    { supabaseField: 'total_amount', mongoField: 'totalAmount', type: 'number' },
    { supabaseField: 'created_at', mongoField: 'createdAt', type: 'date' },
    { supabaseField: 'updated_at', mongoField: 'updatedAt', type: 'date' },
  ],

  // Order mappings
  orders: [
    { supabaseField: 'order_id', mongoField: 'orderId', type: 'uuid', required: true },
    { supabaseField: 'customer_id', mongoField: 'customerId', type: 'uuid', required: true },
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid' },
    { supabaseField: 'function_id', mongoField: 'functionId', type: 'uuid' },
    { supabaseField: 'registration_id', mongoField: 'registrationId', type: 'uuid' },
    // Payment references
    { supabaseField: 'stripe_payment_intent_id', mongoField: 'stripePaymentIntentId', type: 'string' },
    { supabaseField: 'square_order_id', mongoField: 'squareOrderId', type: 'string' },
    // Financial fields
    { supabaseField: 'subtotal', mongoField: 'subtotal', type: 'number' },
    { supabaseField: 'total_amount', mongoField: 'totalAmount', type: 'number' },
    { supabaseField: 'payment_status', mongoField: 'paymentStatus', type: 'string' },
    { supabaseField: 'order_date', mongoField: 'orderDate', type: 'date' },
  ],

  // Ticket mappings
  tickets: [
    { supabaseField: 'ticket_id', mongoField: 'ticketId', type: 'uuid', required: true },
    { supabaseField: 'event_ticket_id', mongoField: 'eventTicketId', type: 'uuid' },
    { supabaseField: 'registration_id', mongoField: 'registrationId', type: 'uuid' },
    { supabaseField: 'attendee_id', mongoField: 'attendeeId', type: 'uuid' },
    { supabaseField: 'function_id', mongoField: 'functionId', type: 'uuid' },
    { supabaseField: 'event_id', mongoField: 'eventId', type: 'uuid' },
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid' },
  ],

  // Attendee mappings
  attendees: [
    { supabaseField: 'attendee_id', mongoField: 'attendeeId', type: 'uuid', required: true },
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid' },
    { supabaseField: 'registration_id', mongoField: 'registrationId', type: 'uuid' },
    { supabaseField: 'ticket_id', mongoField: 'ticketId', type: 'uuid' },
    { supabaseField: 'lodge_id', mongoField: 'lodgeId', type: 'uuid' },
    { supabaseField: 'organisation_id', mongoField: 'organisationId', type: 'uuid' },
  ],

  // Contact mappings
  contacts: [
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid', required: true },
    { supabaseField: 'organisation_id', mongoField: 'organisationId', type: 'uuid' },
    { supabaseField: 'partner_id', mongoField: 'partnerId', type: 'uuid' },
    { supabaseField: 'linked_partner_id', mongoField: 'linkedPartnerId', type: 'uuid' },
    { supabaseField: 'created_by', mongoField: 'createdBy', type: 'uuid' },
    { supabaseField: 'updated_by', mongoField: 'updatedBy', type: 'uuid' },
  ],

  // Customer mappings
  customers: [
    { supabaseField: 'customer_id', mongoField: 'customerId', type: 'uuid', required: true },
    { supabaseField: 'contact_id', mongoField: 'contactId', type: 'uuid' },
    { supabaseField: 'organisation_id', mongoField: 'organisationId', type: 'uuid' },
    // External customer IDs
    { supabaseField: 'stripe_customer_id', mongoField: 'stripeCustomerId', type: 'string' },
    { supabaseField: 'square_customer_id', mongoField: 'squareCustomerId', type: 'string' },
  ],

  // Payment mappings
  payments: [
    { supabaseField: 'payment_id', mongoField: 'paymentId', type: 'uuid', required: true },
    { supabaseField: 'registration_id', mongoField: 'registrationId', type: 'uuid' },
    { supabaseField: 'order_id', mongoField: 'orderId', type: 'uuid' },
    { supabaseField: 'customer_id', mongoField: 'customerId', type: 'uuid' },
    { supabaseField: 'invoice_id', mongoField: 'invoiceId', type: 'uuid' },
    // Payment gateway references
    { supabaseField: 'stripe_payment_intent_id', mongoField: 'stripePaymentIntentId', type: 'string' },
    { supabaseField: 'stripe_charge_id', mongoField: 'stripeChargeId', type: 'string' },
    { supabaseField: 'square_payment_id', mongoField: 'squarePaymentId', type: 'string' },
  ],

  // Function (Event) mappings
  functions: [
    { supabaseField: 'function_id', mongoField: 'functionId', type: 'uuid', required: true },
    { supabaseField: 'event_id', mongoField: 'eventId', type: 'uuid' },
    { supabaseField: 'venue_id', mongoField: 'venueId', type: 'uuid' },
    { supabaseField: 'organisation_id', mongoField: 'organisationId', type: 'uuid' },
    { supabaseField: 'created_by', mongoField: 'createdBy', type: 'uuid' },
  ],
};

/**
 * Map a Supabase document to MongoDB format
 * CRITICAL: UUIDs are kept as strings, never converted to ObjectIds
 */
export function mapSupabaseToMongo(
  supabaseDoc: any,
  collectionName: string,
  options: {
    preserveOriginal?: boolean;
    includeMetadata?: boolean;
    strict?: boolean;
  } = {}
): any {
  const mappings = SUPABASE_TO_MONGO_MAPPINGS[collectionName];
  if (!mappings) {
    console.warn(`No mapping configuration found for collection: ${collectionName}`);
    return supabaseDoc;
  }

  const mongoDoc: any = {};
  
  // If preserving original, start with a copy
  if (options.preserveOriginal) {
    Object.assign(mongoDoc, supabaseDoc);
  }

  // Apply field mappings
  for (const mapping of mappings) {
    const sourceValue = getNestedValue(supabaseDoc, mapping.supabaseField);
    
    if (sourceValue === undefined || sourceValue === null) {
      if (mapping.required && options.strict) {
        throw new Error(`Required field ${mapping.supabaseField} is missing in Supabase document`);
      }
      continue;
    }

    // Transform the value based on type
    let transformedValue = sourceValue;
    
    switch (mapping.type) {
      case 'uuid':
        // CRITICAL: Keep UUIDs as strings, never convert to ObjectId
        transformedValue = String(sourceValue);
        break;
        
      case 'objectid':
        // Only create ObjectId for actual MongoDB _id fields
        if (ObjectId.isValid(sourceValue)) {
          transformedValue = new ObjectId(sourceValue);
        } else {
          console.warn(`Invalid ObjectId value for ${mapping.supabaseField}: ${sourceValue}`);
          transformedValue = sourceValue;
        }
        break;
        
      case 'string':
        transformedValue = String(sourceValue);
        break;
        
      case 'number':
        transformedValue = Number(sourceValue);
        if (isNaN(transformedValue)) {
          console.warn(`Invalid number value for ${mapping.supabaseField}: ${sourceValue}`);
          transformedValue = 0;
        }
        break;
        
      case 'date':
        transformedValue = sourceValue instanceof Date ? sourceValue : new Date(sourceValue);
        break;
        
      case 'boolean':
        transformedValue = Boolean(sourceValue);
        break;
    }

    // Apply custom transform if provided
    if (mapping.transform) {
      transformedValue = mapping.transform(transformedValue);
    }

    // Set the value in the MongoDB document
    setNestedValue(mongoDoc, mapping.mongoField, transformedValue);
  }

  // Add metadata if requested
  if (options.includeMetadata) {
    mongoDoc._metadata = {
      source: 'supabase',
      importedAt: new Date(),
      originalId: supabaseDoc.id || supabaseDoc[`${collectionName.slice(0, -1)}_id`],
      mappingVersion: '1.0.0'
    };
  }

  return mongoDoc;
}

/**
 * Map MongoDB document fields back to Supabase format
 */
export function mapMongoToSupabase(
  mongoDoc: any,
  collectionName: string
): any {
  const mappings = SUPABASE_TO_MONGO_MAPPINGS[collectionName];
  if (!mappings) {
    console.warn(`No mapping configuration found for collection: ${collectionName}`);
    return mongoDoc;
  }

  const supabaseDoc: any = {};

  // Reverse the mappings
  for (const mapping of mappings) {
    const sourceValue = getNestedValue(mongoDoc, mapping.mongoField);
    
    if (sourceValue === undefined || sourceValue === null) {
      continue;
    }

    // Handle ObjectId to string conversion
    let transformedValue = sourceValue;
    if (sourceValue instanceof ObjectId) {
      transformedValue = sourceValue.toString();
    }

    setNestedValue(supabaseDoc, mapping.supabaseField, transformedValue);
  }

  return supabaseDoc;
}

/**
 * Get mapping information for a specific field
 */
export function getFieldMapping(
  collectionName: string,
  fieldName: string,
  direction: 'supabase-to-mongo' | 'mongo-to-supabase' = 'supabase-to-mongo'
): FieldMapping | undefined {
  const mappings = SUPABASE_TO_MONGO_MAPPINGS[collectionName];
  if (!mappings) return undefined;

  if (direction === 'supabase-to-mongo') {
    return mappings.find(m => m.supabaseField === fieldName);
  } else {
    return mappings.find(m => m.mongoField === fieldName);
  }
}

/**
 * Validate that all required fields are present
 */
export function validateRequiredFields(
  doc: any,
  collectionName: string,
  source: 'supabase' | 'mongo' = 'supabase'
): { valid: boolean; missingFields: string[] } {
  const mappings = SUPABASE_TO_MONGO_MAPPINGS[collectionName];
  if (!mappings) {
    return { valid: true, missingFields: [] };
  }

  const missingFields: string[] = [];
  
  for (const mapping of mappings) {
    if (!mapping.required) continue;
    
    const fieldName = source === 'supabase' ? mapping.supabaseField : mapping.mongoField;
    const value = getNestedValue(doc, fieldName);
    
    if (value === undefined || value === null) {
      missingFields.push(fieldName);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Generate a field mapping report
 */
export function generateMappingReport(collectionName?: string): string {
  const collections = collectionName 
    ? [collectionName] 
    : Object.keys(SUPABASE_TO_MONGO_MAPPINGS);

  let report = '# Supabase to MongoDB Field Mapping Report\n\n';
  report += 'Generated: ' + new Date().toISOString() + '\n\n';

  for (const collection of collections) {
    const mappings = SUPABASE_TO_MONGO_MAPPINGS[collection];
    if (!mappings) continue;

    report += `## ${collection.toUpperCase()} Collection\n\n`;
    report += '| Supabase Field | MongoDB Field | Type | Required |\n';
    report += '|----------------|---------------|------|----------|\n';

    for (const mapping of mappings) {
      report += `| ${mapping.supabaseField} | ${mapping.mongoField} | ${mapping.type} | ${mapping.required ? 'Yes' : 'No'} |\n`;
    }

    report += '\n';
  }

  return report;
}

// Helper functions

function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Example usage:
 * 
 * // Import a registration from Supabase
 * const supabaseReg = { 
 *   registration_id: '123e4567-e89b-12d3-a456-426614174000',
 *   function_id: '456e7890-e89b-12d3-a456-426614174001'
 * };
 * 
 * const mongoReg = mapSupabaseToMongo(supabaseReg, 'registrations');
 * // Result: { registrationId: '123e4567-e89b-12d3-a456-426614174000', functionId: '456e7890-e89b-12d3-a456-426614174001' }
 * 
 * // Note: UUIDs are kept as strings, not converted to ObjectIds
 */