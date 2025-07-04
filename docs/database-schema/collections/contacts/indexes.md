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
    name: "email_lookup"
  }
)
```

### Phone Lookup
```javascript
db.contacts.createIndex(
  { "profile.phone": 1 },
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
    "profile.lastName": 1,
    "profile.firstName": 1
  },
  { 
    name: "name_search"
  }
)
```

### User Association
```javascript
db.contacts.createIndex(
  { "userId": 1 },
  { 
    sparse: true,
    unique: true,
    name: "user_lookup"
  }
)
```

## Role and Context Indexes

### Role Lookup
```javascript
db.contacts.createIndex(
  { 
    "roles.contextId": 1,
    "roles.role": 1
  },
  { 
    name: "role_lookup"
  }
)
```

### Active Roles
```javascript
db.contacts.createIndex(
  { 
    "roles.role": 1,
    "roles.endDate": 1
  },
  { 
    name: "active_roles",
    partialFilterExpression: {
      $or: [
        { "roles.endDate": null },
        { "roles.endDate": { $gte: new Date() } }
      ]
    }
  }
)
```

### Function Attendees
```javascript
db.contacts.createIndex(
  { 
    "roles.contextId": 1,
    "roles.context": 1
  },
  { 
    partialFilterExpression: { 
      "roles.context": "function",
      "roles.role": "attendee"
    },
    name: "function_attendees"
  }
)
```

## Order Reference Indexes

### Order History
```javascript
db.contacts.createIndex(
  { "orderReferences.orderId": 1 },
  { 
    sparse: true,
    name: "order_history"
  }
)
```

### Purchaser Lookup
```javascript
db.contacts.createIndex(
  { 
    "orderReferences.orderNumber": 1,
    "orderReferences.role": 1
  },
  { 
    sparse: true,
    name: "purchaser_lookup"
  }
)
```

## Lodge Member Indexes

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
    sparse: true,
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
    sparse: true,
    name: "recent_updates"
  }
)
```

### Creation Date
```javascript
db.contacts.createIndex(
  { "metadata.createdAt": -1 },
  { 
    name: "creation_date"
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

### Email and Roles
```javascript
db.contacts.createIndex(
  { 
    "profile.email": 1,
    "roles.role": 1
  },
  { 
    sparse: true,
    name: "email_role_lookup"
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

### Active Organisation Members
```javascript
db.contacts.createIndex(
  { 
    "roles.contextId": 1,
    "roles.context": 1,
    "roles.endDate": 1
  },
  { 
    partialFilterExpression: { 
      "roles.context": "organisation"
    },
    name: "org_members"
  }
)
```

## Performance Considerations

1. **Sparse Indexes**: Used extensively for optional fields to save space
2. **Partial Indexes**: Used for specific query patterns (active roles, emergency contacts)
3. **Compound Indexes**: Ordered by selectivity (most selective field first)
4. **Unique Constraints**: Contact number and user association must be unique

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

1. **Core Lookups**: Email, phone, and contact number for finding contacts
2. **Role Queries**: Efficient filtering by role and context
3. **Order History**: Quick access to purchase history
4. **Relationships**: Support for contact networks
5. **Analytics**: Metadata indexes for reporting