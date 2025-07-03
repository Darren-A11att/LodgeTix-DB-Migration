# Contacts Collection Indexes

## Primary Indexes

### Unique Contact Number
```javascript
db.contacts.createIndex(
  { "contactNumber": 1 },
  { 
    unique: true,
    name: "contactNumber_unique"
  }
)
```

## Query Optimization Indexes

### Email Lookup
```javascript
db.contacts.createIndex(
  { "profile.email": 1 },
  { 
    sparse: true,
    name: "profile_email"
  }
)
```

### Phone Lookup
```javascript
db.contacts.createIndex(
  { "profile.phone": 1 },
  { 
    sparse: true,
    name: "profile_phone"
  }
)
```

### Name Search
```javascript
db.contacts.createIndex(
  { 
    "profile.lastName": 1,
    "profile.firstName": 1
  },
  { 
    name: "profile_name_search"
  }
)
```

### User Association
```javascript
db.contacts.createIndex(
  { "userId": 1 },
  { 
    sparse: true,
    name: "userId_lookup"
  }
)
```

## Reference Indexes

### Organisation Association
```javascript
db.contacts.createIndex(
  { "references.organisationIds": 1 },
  { 
    name: "organisation_refs"
  }
)
```

### Lodge Members
```javascript
db.contacts.createIndex(
  { "masonicProfile.craft.lodge.organisationId": 1 },
  { 
    sparse: true,
    name: "lodge_members"
  }
)
```

### Grand Lodge Members
```javascript
db.contacts.createIndex(
  { "masonicProfile.craft.grandLodge.name": 1 },
  { 
    sparse: true,
    name: "grand_lodge_members"
  }
)
```

## Relationship Indexes

### Contact Relationships
```javascript
db.contacts.createIndex(
  { "relationships.contactId": 1 },
  { 
    name: "relationship_contacts"
  }
)
```

### Emergency Contacts
```javascript
db.contacts.createIndex(
  { "relationships.isEmergencyContact": 1 },
  { 
    sparse: true,
    partialFilterExpression: { "relationships.isEmergencyContact": true },
    name: "emergency_contacts"
  }
)
```

## Metadata Indexes

### Recent Updates
```javascript
db.contacts.createIndex(
  { "metadata.updatedAt": -1 },
  { 
    name: "recent_updates"
  }
)
```

### Source Tracking
```javascript
db.contacts.createIndex(
  { 
    "metadata.source": 1,
    "metadata.createdAt": -1
  },
  { 
    name: "source_tracking"
  }
)
```

## Compound Indexes for Common Queries

### Email and Organisation
```javascript
db.contacts.createIndex(
  { 
    "profile.email": 1,
    "references.organisationIds": 1
  },
  { 
    sparse: true,
    name: "email_org_lookup"
  }
)
```

### Lodge and Rank
```javascript
db.contacts.createIndex(
  { 
    "masonicProfile.craft.lodge.organisationId": 1,
    "masonicProfile.craft.rank": 1
  },
  { 
    sparse: true,
    name: "lodge_rank_lookup"
  }
)
```

## Index Maintenance Notes

1. **Sparse Indexes**: Used for optional fields to save space
2. **Partial Indexes**: Emergency contacts index only includes documents where `isEmergencyContact` is true
3. **Compound Indexes**: Ordered by selectivity (most selective field first)
4. **Monitoring**: Regular monitoring of index usage with `$indexStats` aggregation
5. **Optimization**: Remove unused indexes identified through monitoring