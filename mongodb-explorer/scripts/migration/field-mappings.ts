/**
 * Field Mapping Definitions for MongoDB Migration
 * 
 * This file defines how fields from old schema map to new schema
 * Each mapping includes:
 * - Source field(s)
 * - Target field
 * - Transformation function
 * - Validation rules
 */

export interface FieldMapping {
  sourceFields: string[];  // Can map multiple source fields to one target
  targetField: string;
  transform?: (value: any, doc?: any) => any;
  validate?: (value: any) => boolean;
  required?: boolean;
  defaultValue?: any;
}

export interface CollectionMapping {
  collectionName: string;
  mappings: FieldMapping[];
  postTransform?: (doc: any) => any;  // Run after all field mappings
  validate?: (doc: any) => { valid: boolean; errors: string[] };
}

// ============================================================================
// ATTENDEES COLLECTION MAPPING
// ============================================================================

export const attendeesMapping: CollectionMapping = {
  collectionName: 'attendees',
  mappings: [
    // Core identification
    {
      sourceFields: ['id', 'attendeeId', '_id'],
      targetField: 'attendeeId',
      required: true,
      validate: (value) => typeof value === 'string' && value.length > 0
    },
    
    // Name fields
    {
      sourceFields: ['firstName', 'first_name', 'fname'],
      targetField: 'firstName',
      required: true,
      transform: (value) => value?.trim(),
      validate: (value) => typeof value === 'string' && value.length > 0
    },
    {
      sourceFields: ['lastName', 'last_name', 'lname', 'surname'],
      targetField: 'lastName',
      required: true,
      transform: (value) => value?.trim(),
      validate: (value) => typeof value === 'string' && value.length > 0
    },
    
    // Type determination
    {
      sourceFields: ['attendeeType', 'isPrimary', 'isPartner'],
      targetField: 'type',
      required: true,
      transform: (value, doc) => {
        // Complex logic to determine type
        if (doc?.isPrimary || doc?.attendeeType === 'primary' || 
            doc?.lodgeNumber || doc?.rank) {
          return 'mason';
        }
        if (doc?.isPartner || doc?.attendeeType === 'partner' || 
            doc?.relationship === 'partner' || doc?.relationship === 'spouse') {
          return 'partner';
        }
        return 'guest';
      },
      validate: (value) => ['mason', 'partner', 'guest'].includes(value)
    },
    
    // Contact info (nested object)
    {
      sourceFields: ['email', 'emailAddress', 'primaryEmail'],
      targetField: 'contactInfo.email',
      transform: (value) => {
        if (!value) return undefined;
        const email = value.trim().toLowerCase();
        // Basic email validation
        return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? email : undefined;
      }
    },
    {
      sourceFields: ['phone', 'mobile', 'mobileNumber', 'primaryPhone'],
      targetField: 'contactInfo.phone',
      transform: (value) => {
        if (!value) return undefined;
        // Normalize phone number
        const phone = value.toString().replace(/\D/g, '');
        if (phone.length === 10 && phone.startsWith('04')) {
          return phone; // Australian mobile
        }
        return value; // Keep original if can't normalize
      }
    },
    {
      sourceFields: ['address', 'streetAddress'],
      targetField: 'contactInfo.address',
      transform: (value) => value?.trim()
    },
    
    // Mason-specific data
    {
      sourceFields: ['lodgeNumber', 'lodge_number'],
      targetField: 'masonData.lodgeNumber',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['rank', 'masonic_rank'],
      targetField: 'masonData.rank',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['yearInitiated', 'year_initiated'],
      targetField: 'masonData.yearInitiated',
      transform: (value, doc) => {
        if (doc?.type !== 'mason') return undefined;
        const year = parseInt(value);
        return !isNaN(year) && year > 1900 && year <= new Date().getFullYear() ? year : undefined;
      }
    },
    {
      sourceFields: ['membershipStatus', 'membership_status'],
      targetField: 'masonData.membershipStatus',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['lodgeId', 'lodge_id'],
      targetField: 'masonData.lodgeId',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['lodge', 'lodgeNameNumber'],
      targetField: 'masonData.lodgeName',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['grandLodge', 'grand_lodge'],
      targetField: 'masonData.grandLodge',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['title'],
      targetField: 'masonData.title',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    {
      sourceFields: ['postNominals', 'post_nominals'],
      targetField: 'masonData.postNominals',
      transform: (value, doc) => doc?.type === 'mason' ? value : undefined
    },
    
    // Partner-specific data
    {
      sourceFields: ['relationship'],
      targetField: 'partnerData.relationship',
      transform: (value, doc) => doc?.type === 'partner' ? value : undefined
    },
    {
      sourceFields: ['linkedMasonId', 'primaryAttendeeId', 'partnerOf'],
      targetField: 'partnerData.linkedMasonId',
      transform: (value, doc) => doc?.type === 'partner' ? value : undefined
    },
    
    // Guest-specific data
    {
      sourceFields: ['invitedBy', 'invited_by', 'guestOfId'],
      targetField: 'guestData.invitedBy',
      transform: (value, doc) => doc?.type === 'guest' ? value : undefined
    },
    {
      sourceFields: ['relationship'],
      targetField: 'guestData.relationship',
      transform: (value, doc) => doc?.type === 'guest' && value !== 'partner' ? value : undefined
    },
    
    // Preferences
    {
      sourceFields: ['dietaryRequirements', 'dietary_requirements'],
      targetField: 'preferences.dietaryRequirements'
    },
    {
      sourceFields: ['specialNeeds', 'special_needs'],
      targetField: 'preferences.specialNeeds'
    },
    {
      sourceFields: ['tableAssignment', 'table_assignment'],
      targetField: 'preferences.tableAssignment'
    },
    {
      sourceFields: ['contactPreference', 'contact_preference'],
      targetField: 'preferences.contactPreference',
      validate: (value) => !value || ['email', 'phone', 'both'].includes(value)
    },
    
    // Status fields
    {
      sourceFields: ['isCheckedIn', 'is_checked_in'],
      targetField: 'status.isCheckedIn',
      transform: (value) => Boolean(value)
    },
    {
      sourceFields: ['paymentStatus', 'payment_status'],
      targetField: 'status.paymentStatus'
    },
    {
      sourceFields: ['contactConfirmed', 'contact_confirmed'],
      targetField: 'status.contactConfirmed',
      transform: (value) => Boolean(value)
    },
    
    // Ticket linkage
    {
      sourceFields: ['ticketId', 'ticket_id', 'ticket'],
      targetField: 'ticketId'
    },
    
    // Timestamps
    {
      sourceFields: ['createdAt', 'created_at'],
      targetField: 'createdAt',
      transform: (value) => value ? new Date(value) : new Date()
    },
    {
      sourceFields: ['updatedAt', 'updated_at'],
      targetField: 'updatedAt',
      transform: (value) => value ? new Date(value) : new Date()
    }
  ],
  
  postTransform: (doc) => {
    // Clean up empty nested objects
    if (doc.contactInfo && Object.keys(doc.contactInfo).length === 0) {
      delete doc.contactInfo;
    }
    if (doc.masonData && Object.keys(doc.masonData).length === 0) {
      delete doc.masonData;
    }
    if (doc.partnerData && Object.keys(doc.partnerData).length === 0) {
      delete doc.partnerData;
    }
    if (doc.guestData && Object.keys(doc.guestData).length === 0) {
      delete doc.guestData;
    }
    if (doc.preferences && Object.keys(doc.preferences).length === 0) {
      delete doc.preferences;
    }
    if (doc.status && Object.keys(doc.status).length === 0) {
      delete doc.status;
    }
    
    return doc;
  },
  
  validate: (doc) => {
    const errors: string[] = [];
    
    // Required fields
    if (!doc.attendeeId) errors.push('attendeeId is required');
    if (!doc.firstName) errors.push('firstName is required');
    if (!doc.lastName) errors.push('lastName is required');
    if (!doc.type) errors.push('type is required');
    
    // Type-specific validation
    if (doc.type === 'mason' && !doc.masonData) {
      errors.push('masonData is required for mason type');
    }
    if (doc.type === 'partner' && !doc.partnerData) {
      errors.push('partnerData is required for partner type');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// ============================================================================
// REGISTRATIONS COLLECTION MAPPING
// ============================================================================

export const registrationsMapping: CollectionMapping = {
  collectionName: 'registrations',
  mappings: [
    // Core fields
    {
      sourceFields: ['id', 'registrationId', '_id'],
      targetField: 'registrationId',
      required: true
    },
    {
      sourceFields: ['eventId', 'event_id'],
      targetField: 'eventId',
      required: true
    },
    {
      sourceFields: ['registrationType', 'registration_type', 'type'],
      targetField: 'registrationType',
      required: true,
      transform: (value) => value || 'individual'
    },
    
    // Registration data - this is complex and needs special handling
    {
      sourceFields: ['registrationData'],
      targetField: 'registrationData',
      transform: (value) => {
        if (!value) return {};
        
        // Transform nested attendees array if present
        if (value.attendees && Array.isArray(value.attendees)) {
          value.attendees = value.attendees.map((attendee: any) => {
            // Apply attendee transformation
            const transformed: any = {};
            
            // Apply mappings from attendeesMapping
            for (const mapping of attendeesMapping.mappings) {
              let sourceValue;
              for (const sourceField of mapping.sourceFields) {
                if (attendee[sourceField] !== undefined) {
                  sourceValue = attendee[sourceField];
                  break;
                }
              }
              
              if (sourceValue !== undefined) {
                const targetValue = mapping.transform ? 
                  mapping.transform(sourceValue, attendee) : sourceValue;
                
                if (targetValue !== undefined) {
                  // Handle nested field assignment
                  const fieldParts = mapping.targetField.split('.');
                  let current = transformed;
                  
                  for (let i = 0; i < fieldParts.length - 1; i++) {
                    if (!current[fieldParts[i]]) {
                      current[fieldParts[i]] = {};
                    }
                    current = current[fieldParts[i]];
                  }
                  
                  current[fieldParts[fieldParts.length - 1]] = targetValue;
                }
              }
            }
            
            // Run post-transform
            return attendeesMapping.postTransform ? 
              attendeesMapping.postTransform(transformed) : transformed;
          });
        }
        
        return value;
      }
    },
    
    // Payment fields
    {
      sourceFields: ['totalAmount', 'total_amount', 'amount'],
      targetField: 'totalAmount',
      transform: (value) => parseFloat(value) || 0
    },
    {
      sourceFields: ['paymentCompleted', 'payment_completed', 'isPaid'],
      targetField: 'paymentCompleted',
      transform: (value) => Boolean(value)
    },
    {
      sourceFields: ['paymentStatus', 'payment_status'],
      targetField: 'paymentStatus'
    },
    {
      sourceFields: ['squarePaymentId', 'square_payment_id'],
      targetField: 'squarePaymentId'
    },
    
    // Organization fields
    {
      sourceFields: ['organisationId', 'organisation_id', 'organizationId'],
      targetField: 'organisationId'
    },
    {
      sourceFields: ['organisationName', 'organisation_name', 'organizationName'],
      targetField: 'organisationName'
    },
    
    // Timestamps
    {
      sourceFields: ['createdAt', 'created_at', 'registrationCreatedAt'],
      targetField: 'createdAt',
      transform: (value) => value ? new Date(value) : new Date()
    },
    {
      sourceFields: ['updatedAt', 'updated_at'],
      targetField: 'updatedAt',
      transform: (value) => value ? new Date(value) : new Date()
    },
    {
      sourceFields: ['paymentDate', 'payment_date'],
      targetField: 'paymentDate',
      transform: (value) => value ? new Date(value) : undefined
    }
  ],
  
  validate: (doc) => {
    const errors: string[] = [];
    
    if (!doc.registrationId) errors.push('registrationId is required');
    if (!doc.eventId) errors.push('eventId is required');
    if (!doc.registrationType) errors.push('registrationType is required');
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// ============================================================================
// EXPORT ALL MAPPINGS
// ============================================================================

export const allMappings: CollectionMapping[] = [
  attendeesMapping,
  registrationsMapping
];

// Helper function to apply a field mapping
export function applyFieldMapping(
  sourceDoc: any,
  mapping: FieldMapping
): any {
  // Find the first source field that has a value
  let sourceValue;
  for (const sourceField of mapping.sourceFields) {
    const value = getNestedValue(sourceDoc, sourceField);
    if (value !== undefined) {
      sourceValue = value;
      break;
    }
  }
  
  // Apply default if no value found and field is required
  if (sourceValue === undefined && mapping.required && mapping.defaultValue !== undefined) {
    sourceValue = mapping.defaultValue;
  }
  
  // Skip if no value
  if (sourceValue === undefined) {
    return undefined;
  }
  
  // Transform the value
  const transformedValue = mapping.transform ? 
    mapping.transform(sourceValue, sourceDoc) : sourceValue;
  
  // Validate the value
  if (mapping.validate && transformedValue !== undefined) {
    if (!mapping.validate(transformedValue)) {
      console.warn(`Validation failed for ${mapping.targetField}: ${transformedValue}`);
      return undefined;
    }
  }
  
  return transformedValue;
}

// Helper to get nested object value
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

// Helper to set nested object value
export function setNestedValue(obj: any, path: string, value: any): void {
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