# Contacts Collection Schema

## Overview
The contacts collection serves as the central identity hub for all people in the system. It consolidates person data that was previously duplicated across users, registrations, and attendees collections. Each contact represents a unique person who may have multiple roles and relationships within the system.

## Document Structure

```javascript
{
  _id: ObjectId,
  contactNumber: String,                  // Unique identifier (e.g., "CON-2024-00001")
  
  // Core profile information
  profile: {
    firstName: String,
    lastName: String,
    preferredName: String,                // Display name
    email: String,
    phone: String,
    dateOfBirth: Date,                    // For age verification
    dietaryRequirements: String,          // Free text for dietary needs
    specialNeeds: String                  // Free text for accessibility/medical needs
  },
  
  // Address information
  addresses: [{
    type: String,                         // "billing", etc. - flexible for UI needs
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postcode: String,
    country: String,
    isPrimary: Boolean                    // Default address for this type
  }],
  
  // Masonic profile (craft lodge details only)
  masonicProfile: {
    craft: {
      grandLodge: {
        name: String,                     // Grand Lodge name
        memberNumber: String              // Member number in Grand Lodge
      },
      lodge: {
        organisationId: ObjectId,         // Reference to organisations collection
        name: String,                     // Lodge name (denormalized)
        number: String                    // Lodge number
      },
      title: String,                      // Masonic title (e.g., "WBro", "VWBro")
      rank: String,                       // Current rank
      grandRank: String,                  // Grand rank if applicable
      isGrandOfficer: Boolean,
      grandOffice: String                 // Current or past grand office held
    }
  },
  
  // Relationships with other contacts
  relationships: [{
    contactId: ObjectId,                  // Reference to another contact
    relationshipType: String,             // "spouse", "partner", "child", "parent", "emergency", etc.
    isPrimary: Boolean,                   // Primary relationship of this type
    isEmergencyContact: Boolean,          // Can be contacted in emergencies
    notes: String,                        // Additional context
    
    // Reciprocal relationship tracking
    reciprocal: Boolean,                  // If true, maintains matching relationship on other contact
    reciprocalType: String                // Relationship type from their perspective
  }],
  
  // Optional authentication link
  userId: ObjectId,                       // Reference to users collection (optional)
  
  // References to related data
  references: {
    organisationIds: [ObjectId],          // Organisations this contact is associated with
    attendeeIds: [ObjectId],              // Attendee records for this contact
    paymentTransactionIds: [ObjectId],    // Payment transactions
    invoiceIds: [ObjectId]                // Invoices
  },
  
  // System metadata
  metadata: {
    source: String,                       // How contact was created (set by application)
    createdAt: Date,
    createdBy: ObjectId,                  // User who created
    updatedAt: Date,
    updatedBy: ObjectId,                  // User who last updated
    version: Number                       // For optimistic locking
  }
}
```

## Field Constraints

### Required Fields
- `contactNumber` - Must be unique, follows pattern
- `profile.firstName` - Minimum identification
- `profile.lastName` - Minimum identification
- `profile.email` OR `profile.phone` - At least one contact method

### Enumerations

**Address Types:**
Application-defined, common values include:
- `billing` - Billing address
- Additional types as needed by UI

**Relationship Types:**
Application-defined, common values include:
- `spouse` - Legal spouse
- `partner` - Life partner/significant other
- `child` - Child (reciprocal: `parent`)
- `parent` - Parent (reciprocal: `child`)
- `sibling` - Brother/sister
- `emergency` - Emergency contact
- `guardian` - Legal guardian
- Other types as defined by application

## Indexes
- `contactNumber` - Unique index
- `profile.email` - For contact lookup (sparse)
- `profile.phone` - For contact lookup (sparse)
- `userId` - For user association lookup (sparse)
- `profile.lastName, profile.firstName` - For name searches
- `references.organisationIds` - For organisation queries
- `masonicProfile.craft.lodge.organisationId` - For lodge member queries

## Relationships
- **Users** - Optional link via `userId` for authentication
- **Organisations** - Associated organisations via `references.organisationIds`
- **Attendees** - Event attendances via `references.attendeeIds`
- **Financial Transactions** - Payments via `references.paymentTransactionIds`
- **Invoices** - Invoices via `references.invoiceIds`

## Business Rules

### Contact Number Generation
- Format: `CON-YYYY-NNNNN` (e.g., CON-2024-00001)
- Sequential numbering per year
- Must be unique across the system

### Relationship Management
1. When `reciprocal: true`, system should create/update the inverse relationship
2. Deleting a reciprocal relationship should remove both sides
3. Contacts cannot have relationships with themselves
4. Only one primary relationship per type per contact

### Data Quality Rules
1. Email addresses should be validated format
2. Phone numbers should be stored in consistent format
3. At least one contact method (email or phone) required
4. Names should be trimmed of whitespace

### Deduplication Strategy
- Check for existing contacts by email/phone before creating new
- Provide merge functionality for duplicate contacts
- Maintain audit trail of merged contacts

## Migration Notes

### Source Data Mapping
Contacts will be created by extracting and deduplicating data from:
1. **Registrations** - Registrant contact information
2. **Attendees** - Attendee profile information
3. **Users** - User profile data
4. **Customers** - Legacy customer records

### Field Mappings
- Various email fields → `profile.email`
- Various phone fields → `profile.phone`
- Various name fields → `profile.firstName`, `profile.lastName`
- Dietary/special needs from attendees → respective profile fields
- Addresses from billing details → `addresses` array

## Security Considerations

### PII Protection
- This collection contains significant PII
- Access should be strictly controlled
- Consider field-level encryption for sensitive data
- Audit all access and modifications

### Data Retention
- Define retention policies for inactive contacts
- Archive rather than delete for audit trail
- Anonymize data when required by regulations