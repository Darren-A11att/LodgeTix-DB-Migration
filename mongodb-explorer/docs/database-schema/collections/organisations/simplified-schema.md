# Simplified Organisations Schema

## Current Issues
- Over 100+ fields with 95% being empty/defaults
- Deeply nested structure making queries complex
- Many fields that are never captured or used
- Unnecessary complexity for simple use cases

## Proposed Simplified Schema

```javascript
{
  "_id": ObjectId,
  "organisationId": "uuid",
  
  // Core Information
  "name": "Lodge Horace Thompson Ryde No. 134",
  "displayName": "Lodge Horace Thompson Ryde No. 134",
  "type": "lodge", // lodge, grandlodge, venue, supplier, other
  "status": "active", // active, inactive, suspended
  
  // Business Registration (only what we actually have)
  "identifiers": {
    "abn": "1234567890",
    "lodgeNumber": "134", // for lodges
    "registrationNumber": "" // for other orgs
  },
  
  // Contact Information (flattened)
  "contact": {
    "email": "secretary@lodge134.org.au",
    "phone": "+61 2 9999 9999",
    "website": "https://lodge134.org.au"
  },
  
  // Address (single, simple)
  "address": {
    "line1": "123 Main Street",
    "line2": "",
    "city": "Ryde",
    "state": "NSW",
    "postcode": "2112",
    "country": "Australia"
  },
  
  // Billing Settings
  "billing": {
    "email": "treasurer@lodge134.org.au", // defaults to contact.email
    "paymentTerms": "net30",
    "invoiceRequired": true
  },
  
  // Relationships (simplified)
  "relationships": {
    "jurisdictionId": "grand-lodge-id", // for lodges
    "parentId": null, // for hierarchical orgs
    "groupId": null // for org groups/districts
  },
  
  // Event Preferences (only what's used)
  "eventDefaults": {
    "registrationType": "organisation", // or "individual"
    "defaultAllocation": 10 // default tickets for bulk bookings
  },
  
  // System Metadata
  "metadata": {
    "createdAt": ISODate,
    "createdBy": "userId",
    "updatedAt": ISODate,
    "updatedBy": "userId",
    "source": "migration", // migration, manual, import
    "legacyId": "old-system-id"
  }
}
```

## Benefits of Simplification

1. **Reduces from ~150 fields to ~25 fields**
2. **Flattened structure** - easier to query and index
3. **Only captures data we actually have**
4. **Clearer field purposes**
5. **Better performance** - smaller documents
6. **Easier to maintain**

## Migration Impact

The simplified schema would:
- Keep all existing data (nothing is lost)
- Make queries much simpler
- Reduce document size by ~80%
- Make the API responses cleaner
- Simplify form creation in the UI

## Fields Removed (but can be added later if needed)
- Complex membership management
- Financial/credit tracking
- Document management
- Communication preferences
- Feature flags
- Branding settings
- Detailed contact roles
- Multiple addresses
- Social media links
- Compliance tracking

## Example Queries Become Simpler

**Before:**
```javascript
db.organisations.find({
  "profile.contact.primary.email": "email@example.com"
})
```

**After:**
```javascript
db.organisations.find({
  "contact.email": "email@example.com"
})
```

## Recommended Approach

1. Keep the current complex schema for now
2. Create migration to simplified schema
3. Update APIs to use simplified structure
4. Add fields back only when actually needed
5. Use composition over deep nesting