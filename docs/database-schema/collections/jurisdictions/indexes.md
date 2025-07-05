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

### Organization Link
```javascript
db.jurisdictions.createIndex(
  { "organizationId": 1 },
  { 
    sparse: true,
    name: "organization_lookup"
  }
)
```

## Query Optimization Indexes

### Type and Name
```javascript
db.jurisdictions.createIndex(
  { 
    "type": 1,
    "name": 1
  },
  { 
    name: "type_name"
  }
)
```

### Country and State
```javascript
db.jurisdictions.createIndex(
  { 
    "country": 1,
    "stateRegion": 1
  },
  { 
    name: "geographic_location"
  }
)
```

### Abbreviation Lookup
```javascript
db.jurisdictions.createIndex(
  { "abbreviation": 1 },
  { 
    name: "abbreviation_lookup"
  }
)
```

# Lodges Collection Indexes

## Primary Indexes

### Unique Lodge ID
```javascript
db.lodges.createIndex(
  { "lodgeId": 1 },
  { 
    unique: true,
    name: "lodgeId_unique"
  }
)
```

### Jurisdiction Link
```javascript
db.lodges.createIndex(
  { "jurisdictionId": 1 },
  { 
    name: "jurisdiction_lookup"
  }
)
```

### Organization Link
```javascript
db.lodges.createIndex(
  { "organizationId": 1 },
  { 
    sparse: true,
    name: "organization_lookup"
  }
)
```

## Query Optimization Indexes

### Lodge Number by Jurisdiction
```javascript
db.lodges.createIndex(
  { 
    "jurisdictionId": 1,
    "number": 1
  },
  { 
    name: "jurisdiction_lodge_number"
  }
)
```

### District and Area
```javascript
db.lodges.createIndex(
  { 
    "district": 1,
    "areaType": 1
  },
  { 
    name: "district_area"
  }
)
```

### State Region
```javascript
db.lodges.createIndex(
  { "stateRegion": 1 },
  { 
    name: "state_region"
  }
)
```

### Display Name Text Search
```javascript
db.lodges.createIndex(
  { "displayName": "text" },
  { 
    name: "display_name_text"
  }
)
```

## Usage Notes
1. These indexes support event registration form dropdowns
2. Jurisdiction lookup is the most common query pattern
3. Lodge number searches are always within a jurisdiction context
4. Text search on displayName helps with lodge autocomplete