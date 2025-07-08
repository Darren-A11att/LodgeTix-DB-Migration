# Organizations Collection Indexes

## Primary Indexes

### Unique Organization ID
```javascript
db.organizations.createIndex(
  { "organizationId": 1 },
  { 
    unique: true,
    name: "organizationId_unique"
  }
)
```

### Organization Type and Status
```javascript
db.organizations.createIndex(
  { 
    "type": 1,
    "status": 1
  },
  { 
    name: "type_status"
  }
)
```

## Business Indexes

### ABN Lookup
```javascript
db.organizations.createIndex(
  { "abn": 1 },
  { 
    sparse: true,
    name: "abn_lookup"
  }
)
```

### Contact Email
```javascript
db.organizations.createIndex(
  { "contactEmail": 1 },
  { 
    name: "contact_email"
  }
)
```

## Relationship Indexes

### Jurisdiction Link
```javascript
db.organizations.createIndex(
  { "jurisdictionId": 1 },
  { 
    sparse: true,
    name: "jurisdiction_lookup"
  }
)
```

### Lodge Link
```javascript
db.organizations.createIndex(
  { "lodgeId": 1 },
  { 
    sparse: true,
    name: "lodge_lookup"
  }
)
```

## Payment Indexes

### Stripe Account
```javascript
db.organizations.createIndex(
  { 
    "stripeAccountId": 1,
    "stripeAccountStatus": 1
  },
  { 
    sparse: true,
    name: "stripe_account"
  }
)
```

### Active Event Hosts
```javascript
db.organizations.createIndex(
  { 
    "stripeAccountStatus": 1,
    "stripePayoutsEnabled": 1
  },
  { 
    partialFilterExpression: { 
      "stripeAccountStatus": "connected",
      "stripePayoutsEnabled": true
    },
    name: "active_event_hosts"
  }
)
```

## Analytics Indexes

### High Value Organizations
```javascript
db.organizations.createIndex(
  { "eventStats.totalSpent": -1 },
  { 
    name: "high_value_orgs"
  }
)
```

### Recent Purchasers
```javascript
db.organizations.createIndex(
  { "eventStats.lastPurchaseDate": -1 },
  { 
    sparse: true,
    name: "recent_purchasers"
  }
)
```

## Search Index

### Organization Name Search
```javascript
db.organizations.createIndex(
  { "name": "text" },
  { 
    name: "name_text_search"
  }
)
```

## Metadata Indexes

### Recent Updates
```javascript
db.organizations.createIndex(
  { "updatedAt": -1 },
  { 
    name: "recent_updates"
  }
)
```

## Index Usage Notes
1. Most queries will use type_status for filtering
2. Jurisdiction/lodge lookups are common for masonic orgs
3. Stripe indexes critical for payment processing
4. Text search helps with organization lookup
5. Sparse indexes save space on optional fields