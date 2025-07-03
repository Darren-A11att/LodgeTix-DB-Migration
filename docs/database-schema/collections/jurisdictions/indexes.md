# Jurisdictions Collection Indexes

## Primary Indexes

### Unique Jurisdiction ID
```javascript
db.jurisdictions.createIndex(
  { "jurisdictionId": 1 },
  { 
    unique: true,
    name: "jurisdictionId_unique"
  }
)
```

### Jurisdiction Type
```javascript
db.jurisdictions.createIndex(
  { "type": 1 },
  { 
    name: "jurisdiction_type"
  }
)
```

## Dynamic Field Indexes

Note: Since field names are dynamic based on jurisdiction type, these examples use craft jurisdiction field names. Actual implementations must create indexes based on the `definitions.parentName` and `definitions.childName` values.

### Parent Organisation (Craft Example: Grand Lodge)
```javascript
db.jurisdictions.createIndex(
  { "grandLodge.organisationId": 1 },
  { 
    sparse: true,
    name: "grandLodge_organisation"
  }
)
```

### Child Organisations (Craft Example: Lodges)
```javascript
db.jurisdictions.createIndex(
  { "grandLodge.lodges.organisationId": 1 },
  { 
    sparse: true,
    name: "lodge_organisations"
  }
)
```

### Legacy ID Lookups
```javascript
// Parent entity ID
db.jurisdictions.createIndex(
  { "grandLodge.id": 1 },
  { 
    sparse: true,
    name: "grandLodge_legacy_id"
  }
)

// Child entity IDs
db.jurisdictions.createIndex(
  { "grandLodge.lodges.id": 1 },
  { 
    sparse: true,
    name: "lodge_legacy_ids"
  }
)
```

## Geographic Indexes

### Country and State
```javascript
db.jurisdictions.createIndex(
  { 
    "grandLodge.country": 1,
    "grandLodge.stateRegion": 1
  },
  { 
    sparse: true,
    name: "geographic_location"
  }
)
```

### Country Code
```javascript
db.jurisdictions.createIndex(
  { "grandLodge.countryCode": 1 },
  { 
    sparse: true,
    name: "country_code"
  }
)
```

## Child Entity Indexes (Craft Example: Lodges)

### Lodge Number Lookup
```javascript
db.jurisdictions.createIndex(
  { 
    "type": 1,
    "grandLodge.lodges.number": 1
  },
  { 
    sparse: true,
    name: "lodge_number_by_type"
  }
)
```

### Lodge Name Search
```javascript
db.jurisdictions.createIndex(
  { "grandLodge.lodges.name": "text" },
  { 
    name: "lodge_name_text"
  }
)
```

### District Lookup
```javascript
db.jurisdictions.createIndex(
  { 
    "grandLodge.lodges.district": 1,
    "grandLodge.lodges.areaType": 1
  },
  { 
    sparse: true,
    name: "district_area"
  }
)
```

### Active Lodges
```javascript
db.jurisdictions.createIndex(
  { 
    "type": 1,
    "grandLodge.lodges.status": 1
  },
  { 
    sparse: true,
    partialFilterExpression: { "grandLodge.lodges.status": "active" },
    name: "active_lodges"
  }
)
```

## Compound Indexes

### Type and Parent Name
```javascript
db.jurisdictions.createIndex(
  { 
    "type": 1,
    "grandLodge.name": 1
  },
  { 
    name: "type_parent_name"
  }
)
```

### Meeting Place Search
```javascript
db.jurisdictions.createIndex(
  { 
    "grandLodge.lodges.meetingPlace": 1,
    "grandLodge.lodges.areaType": 1
  },
  { 
    sparse: true,
    name: "meeting_venues"
  }
)
```

## Metadata Indexes

### Recent Updates
```javascript
db.jurisdictions.createIndex(
  { "metadata.updatedAt": -1 },
  { 
    name: "recent_updates"
  }
)
```

### Source Tracking
```javascript
db.jurisdictions.createIndex(
  { 
    "metadata.source": 1,
    "metadata.createdAt": -1
  },
  { 
    name: "source_tracking"
  }
)
```

## Index Creation Strategy

Since field names are dynamic based on jurisdiction type, a script should be used to create appropriate indexes:

```javascript
// Example index creation function
async function createJurisdictionIndexes(jurisdictionType, parentName, childName) {
  // Create parent organisation index
  await db.jurisdictions.createIndex(
    { [`${parentName}.organisationId`]: 1 },
    { 
      sparse: true,
      name: `${parentName}_organisation`
    }
  );
  
  // Create child organisations index
  await db.jurisdictions.createIndex(
    { [`${parentName}.${childName}.organisationId`]: 1 },
    { 
      sparse: true,
      name: `${childName}_organisations`
    }
  );
  
  // Create other dynamic indexes...
}

// Call for each jurisdiction type
await createJurisdictionIndexes('craft', 'grandLodge', 'lodges');
await createJurisdictionIndexes('mark & royal arch', 'grandChapter', 'chapters');
// etc...
```

## Index Maintenance Notes

1. **Dynamic Fields**: Indexes must be created based on actual field names defined in each jurisdiction type
2. **Sparse Indexes**: Used extensively due to flexible schema
3. **Text Indexes**: Limited to one per collection, choose most important text search field
4. **Partial Indexes**: Used for status fields to optimize common queries
5. **Monitor Usage**: Regular monitoring with `$indexStats` to identify unused indexes