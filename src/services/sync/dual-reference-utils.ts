/**
 * Dual Reference Architecture Utilities
 * 
 * CRITICAL ARCHITECTURE DECISION:
 * All references between documents MUST store BOTH:
 * 1. Business ID (e.g., ticketId, attendeeId, customerId) - for stable cross-environment references
 * 2. MongoDB ObjectId (_id) - for efficient database operations and joins
 * 
 * This ensures both portability and performance.
 */

import { Db, ObjectId } from 'mongodb';

/**
 * Reference pair containing both business ID and ObjectId
 */
export interface DualReference {
  businessId: string;      // Stable ID that works across environments
  objectId: ObjectId;       // MongoDB ObjectId for efficient operations
}

/**
 * Standard metadata structure for extracted documents
 */
export interface ExtractionMetadata {
  // Source registration
  registrationId: string;           // Business ID of source registration
  registrationRef: ObjectId;        // ObjectId of source registration
  
  // Customer who made the booking
  customerId?: string;              // Business ID of customer
  customerRef?: ObjectId;           // ObjectId of customer
  
  // Extraction tracking
  extractedFrom: 'registration' | 'payment' | 'order';
  extractionDate: Date;
  extractionVersion: string;
}

/**
 * Standard structure for registration extraction references
 */
export interface RegistrationExtractionRefs {
  // Tickets
  extractedTicketIds: string[];        // Business IDs of extracted tickets
  extractedTicketRefs: ObjectId[];     // ObjectIds of extracted tickets
  
  // Attendees
  extractedAttendeeIds: string[];      // Business IDs of extracted attendees
  extractedAttendeeRefs: ObjectId[];   // ObjectIds of extracted attendees
  
  // Customer
  extractedCustomerId?: string;        // Business ID of extracted customer
  extractedCustomerRef?: ObjectId;     // ObjectId of extracted customer
  
  // Metadata
  ticketCount: number;
  attendeeCount: number;
  extractionCompleted: boolean;
  extractionDate: Date;
}

/**
 * Gets both the business ID and ObjectId for a document
 * @param collection Collection name
 * @param businessIdField Name of the business ID field (e.g., 'ticketId', 'attendeeId')
 * @param businessId The business ID value
 * @param db Database connection
 * @returns DualReference with both IDs, or null if not found
 */
export async function getDualReference(
  collection: string,
  businessIdField: string,
  businessId: string,
  db: Db
): Promise<DualReference | null> {
  const doc = await db.collection(collection).findOne({ [businessIdField]: businessId });
  
  if (!doc) {
    return null;
  }
  
  return {
    businessId,
    objectId: doc._id
  };
}

/**
 * Stores dual references when extracting a document
 * @param sourceDoc The document being extracted from (e.g., registration)
 * @param extractedDoc The newly extracted document
 * @param extractedBusinessId The business ID of the extracted document
 * @param db Database connection
 */
export async function storeDualReference(
  sourceCollection: string,
  sourceBusinessIdField: string,
  sourceBusinessId: string,
  extractedCollection: string,
  extractedBusinessIdField: string,
  extractedBusinessId: string,
  db: Db
): Promise<void> {
  // Get the ObjectId of the extracted document
  const extractedDoc = await db.collection(extractedCollection).findOne({ 
    [extractedBusinessIdField]: extractedBusinessId 
  });
  
  if (!extractedDoc) {
    throw new Error(`Extracted document not found: ${extractedBusinessId}`);
  }
  
  // Build the update based on the type of extraction
  const updateField = getUpdateFieldName(extractedCollection);
  
  // Update the source document with both references
  await db.collection(sourceCollection).updateOne(
    { [sourceBusinessIdField]: sourceBusinessId },
    {
      $addToSet: {
        [`metadata.${updateField}Ids`]: extractedBusinessId,
        [`metadata.${updateField}Refs`]: extractedDoc._id
      },
      $set: {
        'metadata.extractionDate': new Date(),
        'metadata.extractionCompleted': true
      }
    }
  );
}

/**
 * Adds backward references from extracted document to source
 * @param extractedCollection Collection of the extracted document
 * @param extractedBusinessIdField Field name for business ID
 * @param extractedBusinessId Business ID of extracted document
 * @param sourceRefs References back to the source document
 * @param db Database connection
 */
export async function addBackwardReferences(
  extractedCollection: string,
  extractedBusinessIdField: string,
  extractedBusinessId: string,
  sourceRefs: {
    registrationId?: string;
    registrationRef?: ObjectId;
    customerId?: string;
    customerRef?: ObjectId;
    attendeeId?: string;
    attendeeRef?: ObjectId;
  },
  db: Db
): Promise<void> {
  const updateFields: any = {
    'metadata.extractedFrom': 'registration',
    'metadata.extractionDate': new Date()
  };
  
  // Add all provided references
  if (sourceRefs.registrationId) {
    updateFields['metadata.registrationId'] = sourceRefs.registrationId;
  }
  if (sourceRefs.registrationRef) {
    updateFields['metadata.registrationRef'] = sourceRefs.registrationRef;
  }
  if (sourceRefs.customerId) {
    updateFields['metadata.customerId'] = sourceRefs.customerId;
  }
  if (sourceRefs.customerRef) {
    updateFields['metadata.customerRef'] = sourceRefs.customerRef;
  }
  if (sourceRefs.attendeeId) {
    updateFields['metadata.attendeeId'] = sourceRefs.attendeeId;
  }
  if (sourceRefs.attendeeRef) {
    updateFields['metadata.attendeeRef'] = sourceRefs.attendeeRef;
  }
  
  await db.collection(extractedCollection).updateOne(
    { [extractedBusinessIdField]: extractedBusinessId },
    { $set: updateFields }
  );
}

/**
 * Replaces an embedded object with dual references
 * @param sourceCollection Source collection (e.g., 'import_registrations')
 * @param sourceBusinessIdField Source business ID field (e.g., 'id')
 * @param sourceBusinessId Source business ID value
 * @param embeddedPath Path to embedded object (e.g., 'registrationData.bookingContact')
 * @param referenceBusinessId Business ID to replace with
 * @param referenceObjectId ObjectId to store alongside
 * @param db Database connection
 */
export async function replaceEmbeddedWithReferences(
  sourceCollection: string,
  sourceBusinessIdField: string,
  sourceBusinessId: string,
  embeddedPath: string,
  referenceBusinessId: string,
  referenceObjectId: ObjectId,
  db: Db
): Promise<void> {
  // Create the reference path (e.g., 'registrationData.bookingContactRef')
  const refPath = `${embeddedPath}Ref`;
  const idPath = `${embeddedPath}Id`;
  
  await db.collection(sourceCollection).updateOne(
    { [sourceBusinessIdField]: sourceBusinessId },
    {
      $set: {
        [refPath]: referenceObjectId,    // ObjectId reference
        [idPath]: referenceBusinessId    // Business ID reference
      },
      $unset: {
        [embeddedPath]: ''  // Remove the embedded object
      }
    }
  );
}

/**
 * Helper to get the correct field name prefix based on collection
 */
function getUpdateFieldName(collection: string): string {
  if (collection.includes('ticket')) return 'extractedTicket';
  if (collection.includes('attendee')) return 'extractedAttendee';
  if (collection.includes('customer')) return 'extractedCustomer';
  if (collection.includes('contact')) return 'extractedContact';
  return 'extracted';
}

/**
 * Validates that dual references are properly set
 * @param doc Document to validate
 * @param requiredRefs Array of required reference field names
 * @returns Validation result with any issues found
 */
export function validateDualReferences(
  doc: any,
  requiredRefs: Array<{
    businessIdField: string;
    objectIdField: string;
    fieldName: string;
  }>
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (const ref of requiredRefs) {
    const businessId = doc.metadata?.[ref.businessIdField];
    const objectId = doc.metadata?.[ref.objectIdField];
    
    if (!businessId) {
      issues.push(`Missing business ID for ${ref.fieldName} (${ref.businessIdField})`);
    }
    
    if (!objectId) {
      issues.push(`Missing ObjectId for ${ref.fieldName} (${ref.objectIdField})`);
    }
    
    if (objectId && !(objectId instanceof ObjectId)) {
      issues.push(`Invalid ObjectId type for ${ref.fieldName} (${ref.objectIdField})`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Batch process to add missing ObjectId references to existing data
 * Use this for migration of existing data to dual reference system
 */
export async function addMissingObjectIdReferences(
  collection: string,
  businessIdField: string,
  db: Db,
  options: {
    sourceCollection?: string;
    sourceBusinessIdField?: string;
    updatePath?: string;
  } = {}
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;
  
  // Find documents that have business IDs but missing ObjectIds
  const cursor = db.collection(collection).find({
    [`metadata.${businessIdField}`]: { $exists: true },
    [`metadata.${businessIdField}Ref`]: { $exists: false }
  });
  
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;
    
    try {
      const businessId = doc.metadata[businessIdField];
      
      // Look up the referenced document
      const referencedDoc = await db.collection(options.sourceCollection || collection)
        .findOne({ [options.sourceBusinessIdField || businessIdField]: businessId });
      
      if (referencedDoc) {
        // Add the ObjectId reference
        await db.collection(collection).updateOne(
          { _id: doc._id },
          {
            $set: {
              [`metadata.${businessIdField}Ref`]: referencedDoc._id
            }
          }
        );
        updated++;
      } else {
        console.log(`Referenced document not found for ${businessIdField}: ${businessId}`);
        failed++;
      }
    } catch (error) {
      console.error(`Error processing document ${doc._id}:`, error);
      failed++;
    }
  }
  
  return { updated, failed };
}

/**
 * Standard pattern for extracting and referencing documents
 * This should be used as the template for all extraction operations
 */
export async function extractWithDualReferences(
  source: {
    collection: string;
    businessIdField: string;
    businessId: string;
    document: any;
  },
  extraction: {
    collection: string;
    businessIdField: string;
    businessId: string;
    data: any;
  },
  db: Db
): Promise<DualReference> {
  // Step 1: Create/update the extracted document
  const result = await db.collection(extraction.collection).replaceOne(
    { [extraction.businessIdField]: extraction.businessId },
    extraction.data,
    { upsert: true }
  );
  
  // Step 2: Get the ObjectId
  const extractedDoc = await db.collection(extraction.collection).findOne({
    [extraction.businessIdField]: extraction.businessId
  });
  
  if (!extractedDoc) {
    throw new Error('Failed to create/find extracted document');
  }
  
  // Step 3: Update source with dual references
  const sourceDoc = await db.collection(source.collection).findOne({
    [source.businessIdField]: source.businessId
  });
  
  if (sourceDoc) {
    const fieldPrefix = getUpdateFieldName(extraction.collection);
    
    await db.collection(source.collection).updateOne(
      { [source.businessIdField]: source.businessId },
      {
        $addToSet: {
          [`metadata.${fieldPrefix}Ids`]: extraction.businessId,
          [`metadata.${fieldPrefix}Refs`]: extractedDoc._id
        },
        $set: {
          'metadata.lastExtraction': new Date()
        }
      }
    );
  }
  
  // Step 4: Add backward references
  await db.collection(extraction.collection).updateOne(
    { _id: extractedDoc._id },
    {
      $set: {
        [`metadata.source${source.collection}Id`]: source.businessId,
        [`metadata.source${source.collection}Ref`]: sourceDoc?._id,
        'metadata.extractionDate': new Date()
      }
    }
  );
  
  return {
    businessId: extraction.businessId,
    objectId: extractedDoc._id
  };
}