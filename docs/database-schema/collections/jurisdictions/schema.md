# Jurisdictions Collection Schema

## Overview
The jurisdictions collection represents the hierarchical structure of different Masonic orders (craft, mark & royal arch, scottish rite, etc.). Each jurisdiction type can define its own organizational hierarchy, terminology, ranks, and offices. This flexible design allows the system to accommodate various Masonic traditions and their unique structures.

## Document Structure

```javascript
{
  _id: ObjectId,
  jurisdictionId: String,                 // Unique identifier (e.g., "JUR-CRAFT-NSW-2024-00001")
  type: String,                           // "craft", "mark & royal arch", "scottish rite", etc.
  
  // Definitions for this jurisdiction type
  definitions: {
    parentName: String,                   // e.g., "grandLodge" (field name)
    parentLabel: String,                  // e.g., "Grand Lodge" (display name)
    childName: String,                    // e.g., "lodges" (field name)
    childLabel: String,                   // e.g., "Lodges" (display name)
    
    // Ranks and titles available in this jurisdiction
    ranks: [{
      code: String,                       // e.g., "EA", "FC", "MM"
      name: String,                       // e.g., "Entered Apprentice"
      order: Number,                      // Hierarchical order
      abbreviation: String                // Short form
    }],
    
    // Titles used in this jurisdiction
    titles: [{
      code: String,                       // e.g., "WBro", "VWBro"
      name: String,                       // e.g., "Worshipful Brother"
      abbreviation: String
    }],
    
    // Offices available at parent level
    parentOffices: [{
      code: String,                       // e.g., "GM", "DGM"
      name: String,                       // e.g., "Grand Master"
      order: Number,                      // Order of precedence
      type: String                        // "elected", "appointed"
    }],
    
    // Offices available at child level
    childOffices: [{
      code: String,                       // e.g., "WM", "SW", "JW"
      name: String,                       // e.g., "Worshipful Master"
      order: Number,                      // Order of precedence
      type: String                        // "elected", "appointed"
    }]
  },
  
  // The parent entity (dynamically named based on definitions.parentName)
  // For craft jurisdictions, this would be "grandLodge"
  [definitions.parentName]: {
    id: String,                           // Legacy UUID from grand_lodges table
    name: String,                         // e.g., "United Grand Lodge of NSW & ACT"
    abbreviation: String,                 // e.g., "UGLNSW&ACT"
    
    // Geographic information
    country: String,                      // Country name
    countryCode: String,                  // ISO3 country code
    stateRegion: String,                  // State/region if applicable
    stateRegionCode: String,              // State/region code
    
    // Organisation link
    organisationId: ObjectId,             // Reference to organisations collection
    
    // Contact information
    address: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postcode: String,
      country: String
    },
    
    contact: {
      phone: String,
      email: String,
      website: String
    },
    
    // The child entities array (dynamically named based on definitions.childName)
    // For craft jurisdictions, this would be "lodges"
    [definitions.childName]: [{
      id: String,                         // Legacy UUID from lodges table
      number: String,                     // e.g., "414"
      name: String,                       // e.g., "Lodge Woronora"
      displayName: String,                // e.g., "Lodge Woronora No. 414"
      
      // Location information
      district: String,                   // District number/name
      meetingPlace: String,               // Where they meet
      areaType: String,                   // "METRO", "COUNTRY", etc.
      stateRegion: String,                // State if different from parent
      
      // Organisation link
      organisationId: ObjectId,           // Reference to organisations collection
      
      // Meeting information
      meetingSchedule: {
        frequency: String,                // "monthly", "bi-monthly", etc.
        dayOfWeek: String,                // "Monday", "Tuesday", etc.
        weekOfMonth: String,              // "first", "second", "third", "fourth", "last"
        time: String,                     // "19:30"
        notes: String                     // Additional meeting notes
      },
      
      // Status
      status: String,                     // "active", "dormant", "consecrating"
      consecrationDate: Date,             // When lodge was consecrated
      warrantsNumber: String,             // Warrant/charter number
      
      // Additional metadata
      customFields: Map                   // Flexible fields for jurisdiction-specific data
    }]
  },
  
  // System metadata
  metadata: {
    source: String,                       // Import source
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    version: Number
  }
}
```

## Field Constraints

### Required Fields
- `type` - Jurisdiction type
- `definitions` - Must include parent/child naming
- The dynamic parent field (e.g., `grandLodge` for craft)

### Enumerations

**Jurisdiction Types:**
Common values (but not limited to):
- `craft` - Craft Freemasonry
- `mark & royal arch` - Mark Master and Royal Arch
- `scottish rite` - Scottish Rite
- `york rite` - York Rite
- `shrine` - Shriners
- Other types as defined by application

**Area Types:**
- `METRO` - Metropolitan area
- `COUNTRY` - Country/rural area
- `REGIONAL` - Regional center

**Status:**
- `active` - Currently active
- `dormant` - Temporarily inactive
- `consecrating` - Being formed
- `amalgamated` - Merged with another
- `closed` - Permanently closed

## Indexes
- `jurisdictionId` - Unique identifier
- `type` - Jurisdiction type queries
- `{parentName}.organisationId` - Organisation lookups
- `{parentName}.{childName}.organisationId` - Child organisation lookups
- `{parentName}.country, {parentName}.stateRegion` - Geographic queries
- `{parentName}.{childName}.number` - Lodge number lookups

## Business Rules

### Jurisdiction ID Generation
- Format depends on type and geography
- Must be unique within collection
- Include type identifier for clarity

### Dynamic Field Naming
- Parent and child field names are defined in `definitions`
- Allows different terminology per jurisdiction type
- Application must handle dynamic field access

### Hierarchy Rules
1. Each jurisdiction has one parent entity
2. Parent can have multiple child entities
3. Child entities belong to only one parent
4. Jurisdiction types are independent hierarchies

## Migration Notes

### Source Data
- Craft jurisdictions from `grand_lodges` and `lodges` tables
- Other jurisdiction types to be defined

### Field Mappings
**From grand_lodges:**
- `grand_lodge_id` → `grandLodge.id`
- `name` → `grandLodge.name`
- `abbreviation` → `grandLodge.abbreviation`
- `country` → `grandLodge.country`
- `organisation_id` → `grandLodge.organisationId`

**From lodges:**
- `lodge_id` → `grandLodge.lodges[].id`
- `number` → `grandLodge.lodges[].number`
- `name` → `grandLodge.lodges[].name`
- `display_name` → `grandLodge.lodges[].displayName`
- `organisation_id` → `grandLodge.lodges[].organisationId`

## Examples

### Craft Jurisdiction
```javascript
{
  type: "craft",
  definitions: {
    parentName: "grandLodge",
    parentLabel: "Grand Lodge",
    childName: "lodges",
    childLabel: "Lodges"
  },
  grandLodge: {
    name: "United Grand Lodge of NSW & ACT",
    lodges: [
      {
        number: "414",
        name: "Lodge Woronora"
      }
    ]
  }
}
```

### Mark & Royal Arch Jurisdiction
```javascript
{
  type: "mark & royal arch",
  definitions: {
    parentName: "grandChapter",
    parentLabel: "Grand Chapter",
    childName: "chapters",
    childLabel: "Chapters"
  },
  grandChapter: {
    name: "Supreme Grand Chapter of NSW & ACT",
    chapters: [
      {
        number: "1",
        name: "Chapter Excellence"
      }
    ]
  }
}
```