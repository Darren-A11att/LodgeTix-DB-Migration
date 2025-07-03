# Organisations Collection - Indexes

## Primary Indexes

### 1. Unique Organisation ID
```javascript
db.organisations.createIndex(
  { "organisationId": 1 },
  { 
    unique: true,
    name: "organisationId_unique"
  }
)
```
**Purpose**: Ensure organisation ID uniqueness, fast lookups

### 2. ABN Lookup
```javascript
db.organisations.createIndex(
  { "profile.registration.abn": 1 },
  { 
    unique: true,
    sparse: true,
    name: "abn_unique"
  }
)
```
**Purpose**: Unique ABN constraint, business verification

### 3. Registration Number
```javascript
db.organisations.createIndex(
  { "profile.registration.number": 1, "profile.type": 1 },
  { 
    sparse: true,
    name: "registration_number"
  }
)
```
**Purpose**: Lodge/organisation number lookups

## Type and Status Indexes

### 4. Organisation Type
```javascript
db.organisations.createIndex(
  { "profile.type": 1, "status": 1 },
  { name: "type_status" }
)
```
**Purpose**: Filter organisations by type and status

### 5. Active Organisations
```javascript
db.organisations.createIndex(
  { "status": 1, "verification.verified": 1 },
  {
    partialFilterExpression: { 
      status: "active" 
    },
    name: "active_verified"
  }
)
```
**Purpose**: List active, verified organisations

### 6. Geographic Location
```javascript
db.organisations.createIndex(
  { "profile.addresses.physical.state": 1, "profile.addresses.physical.city": 1 },
  { name: "location_index" }
)
```
**Purpose**: Geographic searches and filtering

## Membership Indexes

### 7. Member Lookup
```javascript
db.organisations.createIndex(
  { "membership.members.userId": 1, "membership.members.status": 1 },
  { name: "member_lookup" }
)
```
**Purpose**: Find organisations for a user

### 8. Officer Positions
```javascript
db.organisations.createIndex(
  { "membership.officers.userId": 1, "membership.officers.current": 1 },
  { 
    sparse: true,
    name: "current_officers"
  }
)
```
**Purpose**: Find current officer positions

### 9. Member Count Range
```javascript
db.organisations.createIndex(
  { "profile.details.size.category": 1, "profile.details.size.activeMembers": -1 },
  { name: "size_category" }
)
```
**Purpose**: Segment organisations by size

## Financial Indexes

### 10. Credit Management
```javascript
db.organisations.createIndex(
  { "financial.credit.available": 1, "financial.credit.rating": 1 },
  { name: "credit_status" }
)
```
**Purpose**: Monitor credit limits and ratings

### 11. Payment Performance
```javascript
db.organisations.createIndex(
  { "financial.credit.averageDaysToPayment": 1, "financial.credit.latePayments": 1 },
  { name: "payment_performance" }
)
```
**Purpose**: Identify payment risks

### 12. Tax Exemption
```javascript
db.organisations.createIndex(
  { "financial.tax.exemptStatus": 1, "financial.tax.exemptionCertificate.expiryDate": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "financial.tax.exemptStatus": true 
    },
    name: "tax_exempt_orgs"
  }
)
```
**Purpose**: Track tax exemption status

## Event Participation

### 13. Event History
```javascript
db.organisations.createIndex(
  { "events.history.lastEventDate": -1, "events.history.totalSpent": -1 },
  { name: "event_participation" }
)
```
**Purpose**: Identify active event participants

### 14. High-Value Organisations
```javascript
db.organisations.createIndex(
  { "events.history.totalSpent": -1, "status": 1 },
  { name: "high_value_orgs" }
)
```
**Purpose**: VIP organisation identification

## Relationships

### 15. Parent-Child Hierarchy
```javascript
db.organisations.createIndex(
  { "relationships.parent.organisationId": 1 },
  { 
    sparse: true,
    name: "parent_org"
  }
)
```
**Purpose**: Navigate organisation hierarchy

### 16. Affiliations
```javascript
db.organisations.createIndex(
  { "relationships.affiliations.organisationId": 1, "relationships.affiliations.current": 1 },
  { 
    sparse: true,
    name: "current_affiliations"
  }
)
```
**Purpose**: Track organisation relationships

### 16a. Jurisdiction Reference
```javascript
db.organisations.createIndex(
  { "jurisdictionId": 1, "profile.type": 1 },
  { 
    sparse: true,
    name: "jurisdiction_lookup"
  }
)
```
**Purpose**: Find organisations by jurisdiction (for Masonic lodges)

## Compliance and Documents

### 17. Insurance Expiry
```javascript
db.organisations.createIndex(
  { 
    "documents.insurance.publicLiability.expiryDate": 1,
    "documents.insurance.professionalIndemnity.expiryDate": 1
  },
  { 
    sparse: true,
    name: "insurance_expiry"
  }
)
```
**Purpose**: Insurance renewal tracking

### 18. Document Compliance
```javascript
db.organisations.createIndex(
  { "documents.compliance.year": -1, "documents.compliance.type": 1 },
  { 
    sparse: true,
    name: "compliance_docs"
  }
)
```
**Purpose**: Compliance document tracking

## Search and Analytics

### 19. Created Date
```javascript
db.organisations.createIndex(
  { "metadata.createdAt": -1 },
  { name: "created_date" }
)
```
**Purpose**: New organisation tracking

### 20. Tags
```javascript
db.organisations.createIndex(
  { "metadata.tags": 1 },
  { 
    sparse: true,
    name: "org_tags"
  }
)
```
**Purpose**: Tag-based categorization

## Compound Text Index

### 21. Organisation Search
```javascript
db.organisations.createIndex(
  { 
    "profile.name": "text",
    "profile.displayName": "text",
    "profile.registration.registeredName": "text",
    "profile.description": "text",
    "organisationId": "text"
  },
  { name: "organisation_search" }
)
```
**Purpose**: Full-text search across organisation details

## Performance Considerations

1. **Member Lookups**: Critical for user organisation access
2. **Financial Indexes**: Important for credit and payment processing
3. **Partial Indexes**: Used for active/verified organisation queries
4. **Sparse Indexes**: Save space on optional fields like ABN

## Index Maintenance

```javascript
// Monitor high-traffic indexes
db.organisations.aggregate([
  { $indexStats: {} },
  { $match: { 
    name: { $in: ["member_lookup", "type_status", "organisation_search"] }
  }},
  { $sort: { "accesses.ops": -1 } }
])

// Check index sizes
db.organisations.aggregate([
  { $indexStats: {} },
  { $project: {
    name: 1,
    sizeInMB: { $divide: ["$size", 1048576] },
    opsPerMB: { 
      $divide: ["$accesses.ops", { $divide: ["$size", 1048576] }] 
    }
  }},
  { $sort: { sizeInMB: -1 } }
])
```