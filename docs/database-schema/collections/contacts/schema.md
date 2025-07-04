# Contacts Collection Schema

## Overview
The contacts collection serves as the central identity hub for all people in the system. It consolidates person data that was previously duplicated across users, registrations, and attendees collections. Each contact represents a unique person who may have multiple roles and relationships within the system. With the e-commerce transformation, contacts now support multiple roles per context and track their order history.

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
    type: String,                         // "billing", "shipping", etc.
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
      rank: String                        // Current rank
    }
  },
  
  // Roles for different functions and contexts
  roles: [{
    role: String,                         // "attendee", "organizer", "sponsor", "vendor", "host", "staff"
    context: String,                      // "function", "organisation", "system"
    contextId: ObjectId | String,         // ID of function/org where role applies
    startDate: Date,                      // When role became active
    endDate: Date,                        // When role ends (null for ongoing)
    permissions: [String]                 // Specific permissions for this role
  }],
  
  // Track all orders/registrations this contact is part of
  orderReferences: [{
    orderId: ObjectId,                    // Reference to orders collection
    orderNumber: String,                  // Denormalized for quick access
    role: String,                         // "purchaser", "attendee"
    items: [ObjectId]                     // Line items in the order for this contact
  }],
  
  // Relationships with other contacts
  relationships: [{
    contactId: ObjectId,                  // Reference to another contact
    relationshipType: String,             // "spouse", "partner", "child", "parent", "emergency", etc.
    isPrimary: Boolean,                   // Primary relationship of this type
    isEmergencyContact: Boolean           // Can be contacted in emergencies
  }],
  
  // Optional authentication link
  userId: ObjectId,                       // Reference to users collection (optional)
  
  // System metadata
  metadata: {
    source: String,                       // How contact was created
    createdAt: Date,
    createdBy: ObjectId,                  // User who created
    updatedAt: Date,
    updatedBy: ObjectId                   // User who last updated
  }
}
```

## Field Constraints

### Required Fields
- `contactNumber` - Must be unique, follows pattern
- `profile.firstName` - Minimum identification
- `profile.lastName` - Minimum identification
- `metadata.createdAt` - Creation timestamp

### Enumerations

**Role Types:**
- `attendee` - Event attendee
- `organizer` - Event organizer
- `sponsor` - Event sponsor
- `vendor` - Vendor/supplier
- `host` - Event host
- `staff` - Staff member

**Role Contexts:**
- `function` - Role within a specific function/event
- `organisation` - Role within an organisation
- `system` - System-wide role

**Order Roles:**
- `purchaser` - Person who made the purchase
- `attendee` - Person attending/using the purchased item

**Address Types:**
- `billing` - Billing address
- `shipping` - Shipping address
- Other types as needed by application

**Relationship Types:**
- `spouse` - Legal spouse
- `partner` - Life partner/significant other
- `child` - Child
- `parent` - Parent
- `sibling` - Brother/sister
- `emergency` - Emergency contact
- `guardian` - Legal guardian

## Indexes
- `contactNumber` - Unique index
- `profile.email` - For contact lookup (sparse)
- `profile.phone` - For contact lookup (sparse) 
- `userId` - For user association lookup (sparse, unique)
- `profile.lastName, profile.firstName` - For name searches
- `roles.contextId, roles.role` - For role queries
- `orderReferences.orderId` - For order history lookup
- `masonicProfile.craft.lodge.organisationId` - For lodge member queries

## Relationships
- **Users** - Optional 1:1 link via `userId` for authentication
- **Orders** - Orders involving this contact via `orderReferences`
- **Catalog Objects** - Functions/events via `roles` with context
- **Organisations** - Associated organisations via roles
- **Tickets** - Event tickets owned by this contact

## Business Rules

### Contact Number Generation
- Format: `CON-YYYY-NNNNN` (e.g., CON-2024-00001)
- Sequential numbering per year
- Must be unique across the system

### Role Management
1. Roles are time-bound with start/end dates
2. Multiple roles allowed per contact
3. Roles can be scoped to specific contexts
4. Active roles = where endDate is null or future

### Order Reference Management
1. Added when contact is part of an order (as purchaser or attendee)
2. Maintains denormalized order number for quick reference
3. Tracks specific line items associated with contact

### Data Quality Rules
1. Email addresses should be validated format
2. Phone numbers should be stored in consistent format
3. Names should be trimmed of whitespace
4. At least email OR phone should be present

### Deduplication Strategy
- Check for existing contacts by email/phone before creating new
- Provide merge functionality for duplicate contacts
- Update all references when merging contacts

## Migration Notes

### From Attendees Collection
- All attendee records will be migrated to contacts
- Attendee-specific data preserved in roles array
- Registration references converted to orderReferences

### From Users Collection
- Profile data moved to contacts
- User record simplified to auth-only
- Bidirectional link maintained via userId/contactId

### New E-commerce Features
- Roles array replaces static role fields
- Order references track purchase history
- Support for multiple contexts (events, orgs, system)

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

## Computed Fields (via aggregation)

### fullName
```javascript
{ $concat: ["$profile.firstName", " ", "$profile.lastName"] }
```

### displayName
```javascript
{
  $cond: [
    { $ne: ["$profile.preferredName", null] },
    { $concat: ["$profile.preferredName", " ", "$profile.lastName"] },
    { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
  ]
}
```

### activeRoles
```javascript
{
  $filter: {
    input: "$roles",
    cond: {
      $or: [
        { $eq: ["$$this.endDate", null] },
        { $gte: ["$$this.endDate", new Date()] }
      ]
    }
  }
}
```

### orderCount
```javascript
{ $size: { $ifNull: ["$orderReferences", []] } }
```