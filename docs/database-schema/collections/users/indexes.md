# Users Collection - Indexes

## Primary Indexes

### 1. Unique User ID
```javascript
db.users.createIndex(
  { "userId": 1 },
  { 
    unique: true,
    name: "userId_unique"
  }
)
```
**Purpose**: Ensure user ID uniqueness, fast lookups

### 2. Unique Email
```javascript
db.users.createIndex(
  { "auth.email": 1 },
  { 
    unique: true,
    name: "email_unique"
  }
)
```
**Purpose**: Ensure email uniqueness, authentication lookups

### 3. OAuth Provider Lookup
```javascript
db.users.createIndex(
  { "auth.providers.provider": 1, "auth.providers.providerId": 1 },
  { 
    unique: true,
    sparse: true,
    name: "oauth_provider_unique"
  }
)
```
**Purpose**: Unique OAuth accounts, provider authentication

## Authentication Indexes

### 4. Session Management
```javascript
db.users.createIndex(
  { "auth.sessions.sessionId": 1 },
  { 
    sparse: true,
    name: "session_lookup"
  }
)
```
**Purpose**: Fast session validation

### 5. Password Reset
```javascript
db.users.createIndex(
  { "auth.passwordResetToken": 1, "auth.passwordResetExpires": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "auth.passwordResetToken": { $exists: true } 
    },
    name: "password_reset_token"
  }
)
```
**Purpose**: Password reset token validation

### 6. Active Sessions
```javascript
db.users.createIndex(
  { "auth.sessions.expiresAt": 1, "flags.isActive": 1 },
  {
    partialFilterExpression: { 
      "auth.sessions.revoked": false 
    },
    name: "active_sessions"
  }
)
```
**Purpose**: Clean up expired sessions

## Contact Information Indexes

### 7. Phone Number Lookup
```javascript
db.users.createIndex(
  { "profile.phones.number": 1 },
  { 
    sparse: true,
    name: "phone_lookup"
  }
)
```
**Purpose**: Find users by phone number

### 8. Name Search
```javascript
db.users.createIndex(
  { "profile.lastName": 1, "profile.firstName": 1 },
  { name: "name_search" }
)
```
**Purpose**: Search users by name

## Organisation and Access

### 9. Organisation Members
```javascript
db.users.createIndex(
  { "access.organisations.organisationId": 1, "access.organisations.status": 1 },
  { name: "organisation_members" }
)
```
**Purpose**: List organisation members

### 10. Role-based Access
```javascript
db.users.createIndex(
  { "access.roles": 1, "flags.isActive": 1 },
  { name: "role_access" }
)
```
**Purpose**: Find users by role

### 11. Permission Search
```javascript
db.users.createIndex(
  { "access.permissions": 1 },
  { 
    sparse: true,
    name: "permission_search"
  }
)
```
**Purpose**: Find users with specific permissions

## Activity and Engagement

### 12. Last Active Users
```javascript
db.users.createIndex(
  { "activity.engagement.lastActiveAt": -1, "flags.isActive": 1 },
  { name: "recently_active" }
)
```
**Purpose**: Track active users

### 13. High-Value Customers
```javascript
db.users.createIndex(
  { "activity.registrations.totalSpent": -1, "flags.isVip": 1 },
  { name: "high_value_customers" }
)
```
**Purpose**: Identify VIP customers

### 14. Loyalty Tier
```javascript
db.users.createIndex(
  { "financial.loyaltyPoints.tier": 1, "financial.loyaltyPoints.balance": -1 },
  { name: "loyalty_tier" }
)
```
**Purpose**: Loyalty program management

## Communication and Marketing

### 15. Marketing Consent
```javascript
db.users.createIndex(
  { "preferences.communications.marketing.email": 1, "flags.isActive": 1 },
  {
    partialFilterExpression: { 
      "preferences.communications.marketing.email": true 
    },
    name: "marketing_consent"
  }
)
```
**Purpose**: Email marketing lists

### 16. Event Preferences
```javascript
db.users.createIndex(
  { "preferences.events.categories": 1, "preferences.events.notifications.newEvents": 1 },
  { 
    sparse: true,
    name: "event_preferences"
  }
)
```
**Purpose**: Targeted event notifications

## Compliance and Security

### 17. Unverified Accounts
```javascript
db.users.createIndex(
  { "auth.emailVerified": 1, "metadata.createdAt": 1 },
  {
    partialFilterExpression: { 
      "auth.emailVerified": false 
    },
    name: "unverified_accounts"
  }
)
```
**Purpose**: Track unverified accounts for cleanup

### 18. Deletion Requests
```javascript
db.users.createIndex(
  { "compliance.dataRetention.deleteScheduledFor": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "compliance.dataRetention.deleteScheduledFor": { $exists: true } 
    },
    name: "deletion_queue"
  }
)
```
**Purpose**: Process data deletion requests

### 19. Banned Users
```javascript
db.users.createIndex(
  { "flags.isBanned": 1, "auth.email": 1 },
  {
    partialFilterExpression: { 
      "flags.isBanned": true 
    },
    name: "banned_users"
  }
)
```
**Purpose**: Enforce bans

## Analytics Indexes

### 20. User Cohorts
```javascript
db.users.createIndex(
  { "metadata.createdAt": 1, "metadata.source": 1, "metadata.campaign": 1 },
  { name: "user_cohorts" }
)
```
**Purpose**: Cohort analysis and attribution

### 21. Geographic Distribution
```javascript
db.users.createIndex(
  { "profile.addresses.country": 1, "profile.addresses.state": 1, "profile.addresses.city": 1 },
  { 
    sparse: true,
    name: "geographic_distribution"
  }
)
```
**Purpose**: Geographic analytics

## Compound Text Index

### 22. User Search
```javascript
db.users.createIndex(
  { 
    "auth.email": "text",
    "profile.firstName": "text",
    "profile.lastName": "text",
    "profile.displayName": "text",
    "userId": "text"
  },
  { name: "user_search" }
)
```
**Purpose**: Full-text search across user details

## Performance Considerations

1. **Authentication Performance**: Email and session indexes are critical for login speed
2. **Partial Indexes**: Reduce index size for boolean flags
3. **Sparse Indexes**: Save space on optional fields
4. **Compound Indexes**: Optimize common query patterns

## Index Maintenance

```javascript
// Monitor authentication index usage
db.users.aggregate([
  { $indexStats: {} },
  { $match: { 
    name: { $in: ["email_unique", "session_lookup", "oauth_provider_unique"] }
  }},
  { $sort: { "accesses.ops": -1 } }
])

// Check for unused indexes
db.users.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } }
])
```