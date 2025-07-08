# Contacts Collection Indexes

## Primary Indexes

### Unique Contact ID
```javascript
db.contacts.createIndex(
  { "contactId": 1 },
  { 
    unique: true,
    name: "contactId_unique"
  }
)
```

## Contact Lookup Indexes

### Email Lookup
```javascript
db.contacts.createIndex(
  { "email": 1 },
  { 
    sparse: true,
    unique: true,
    name: "email_unique"
  }
)
```

### Phone Lookup
```javascript
db.contacts.createIndex(
  { "phone": 1 },
  { 
    sparse: true,
    name: "phone_lookup"
  }
)
```

### Name Search
```javascript
db.contacts.createIndex(
  { 
    "lastName": 1,
    "firstName": 1
  },
  { 
    name: "name_search"
  }
)
```

### User Association
```javascript
db.contacts.createIndex(
  { "hasUserAccount": 1 },
  { 
    name: "user_account_status"
  }
)
```

## Context-Based Indexes

### Registration Lookups
```javascript
db.contacts.createIndex(
  { "registrations.functionId": 1 },
  { 
    sparse: true,
    name: "registration_functions"
  }
)
```

### Registration Roles
```javascript
db.contacts.createIndex(
  { "registrations.role": 1 },
  { 
    sparse: true,
    name: "registration_roles"
  }
)
```

### Organization Members
```javascript
db.contacts.createIndex(
  { "organizations.organizationId": 1 },
  { 
    sparse: true,
    name: "organization_members"
  }
)
```

### Active Organization Members
```javascript
db.contacts.createIndex(
  { 
    "organizations.organizationId": 1,
    "organizations.isCurrent": 1
  },
  { 
    sparse: true,
    partialFilterExpression: { "organizations.isCurrent": true },
    name: "active_org_members"
  }
)
```

### Event Hosts
```javascript
db.contacts.createIndex(
  { "hosting.functionId": 1 },
  { 
    sparse: true,
    name: "event_hosts"
  }
)
```

## Masonic Profile Indexes

### Lodge Members
```javascript
db.contacts.createIndex(
  { "masonicProfile.lodgeId": 1 },
  { 
    sparse: true,
    name: "lodge_members"
  }
)
```

### Grand Lodge Members
```javascript
db.contacts.createIndex(
  { "masonicProfile.grandLodgeId": 1 },
  { 
    sparse: true,
    name: "grand_lodge_members"
  }
)
```

### Masonic Rank
```javascript
db.contacts.createIndex(
  { 
    "masonicProfile.lodgeId": 1,
    "masonicProfile.rank": 1
  },
  { 
    sparse: true,
    name: "lodge_rank_lookup"
  }
)
```

### Grand Officers
```javascript
db.contacts.createIndex(
  { 
    "masonicProfile.grandOfficer": 1,
    "masonicProfile.grandLodgeId": 1
  },
  { 
    sparse: true,
    partialFilterExpression: { "masonicProfile.grandOfficer": true },
    name: "grand_officers"
  }
)
```

## Relationship Indexes

### Partner Relationships
```javascript
db.contacts.createIndex(
  { "relationships.partners.contactId": 1 },
  { 
    sparse: true,
    name: "partner_relationships"
  }
)
```

### Emergency Contacts
```javascript
db.contacts.createIndex(
  { "relationships.emergencyContacts.contactId": 1 },
  { 
    sparse: true,
    name: "emergency_contacts"
  }
)
```

## Full Text Search

### Contact Search
```javascript
db.contacts.createIndex(
  { 
    "firstName": "text",
    "lastName": "text",
    "preferredName": "text",
    "email": "text"
  },
  { 
    name: "contact_text_search"
  }
)
```

## Metadata Indexes

### Recent Updates
```javascript
db.contacts.createIndex(
  { "updatedAt": -1 },
  { 
    name: "recent_updates"
  }
)
```

### Creation Date
```javascript
db.contacts.createIndex(
  { "createdAt": -1 },
  { 
    name: "creation_date"
  }
)
```

### Source Tracking
```javascript
db.contacts.createIndex(
  { 
    "source": 1,
    "createdAt": -1
  },
  { 
    name: "source_tracking"
  }
)
```

## Compound Indexes for Common Queries

### Function Attendees by Name
```javascript
db.contacts.createIndex(
  { 
    "registrations.functionId": 1,
    "lastName": 1,
    "firstName": 1
  },
  { 
    sparse: true,
    name: "function_attendees_by_name"
  }
)
```

### Organization Contacts by Role
```javascript
db.contacts.createIndex(
  { 
    "organizations.organizationId": 1,
    "organizations.role": 1,
    "organizations.isCurrent": 1
  },
  { 
    sparse: true,
    name: "org_contacts_by_role"
  }
)
```

### Active Tags
```javascript
db.contacts.createIndex(
  { 
    "tags": 1,
    "isActive": 1
  },
  { 
    sparse: true,
    partialFilterExpression: { "isActive": true },
    name: "active_tags"
  }
)
```

## Performance Considerations

1. **Sparse Indexes**: Used extensively for optional fields to save space
2. **Partial Indexes**: Used for specific query patterns (active members, grand officers)
3. **Compound Indexes**: Ordered by selectivity (most selective field first)
4. **Unique Constraints**: contactId and email must be unique

## Index Maintenance

### Monitor Usage
```javascript
db.contacts.aggregate([
  { $indexStats: {} },
  { $sort: { "accesses.ops": -1 } }
])
```

### Find Unused Indexes
```javascript
db.contacts.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } }
])
```

### Validate Index Health
```javascript
db.contacts.validate({ full: true })
```

## Index Strategy

1. **Core Lookups**: Email and phone for finding/deduplicating contacts
2. **Context Queries**: Efficient filtering by registrations, organizations, hosting
3. **Masonic Queries**: Lodge and grand lodge member lookups
4. **Relationships**: Support for partner and emergency contact networks
5. **Analytics**: Metadata indexes for reporting and tracking