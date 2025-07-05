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
**Purpose**: Ensure userId uniqueness (UUID v4)

### 2. Unique Email
```javascript
db.users.createIndex(
  { "email": 1 },
  { 
    unique: true,
    sparse: true,
    name: "email_unique"
  }
)
```
**Purpose**: Ensure email uniqueness, authentication lookups

### 3. Unique Phone
```javascript
db.users.createIndex(
  { "phone": 1 },
  { 
    unique: true,
    sparse: true,
    name: "phone_unique"
  }
)
```
**Purpose**: Ensure phone uniqueness, phone-based authentication

### 4. Contact Reference
```javascript
db.users.createIndex(
  { "contactId": 1 },
  { 
    unique: true,
    name: "contactId_unique"
  }
)
```
**Purpose**: Ensure one user per contact, fast contact lookup

## Authentication Indexes

### 5. Account Status + Email
```javascript
db.users.createIndex(
  { "status": 1, "email": 1 },
  { 
    sparse: true,
    name: "status_email"
  }
)
```
**Purpose**: Filter by account status for email login checks

### 6. Account Status + Phone
```javascript
db.users.createIndex(
  { "status": 1, "phone": 1 },
  { 
    sparse: true,
    name: "status_phone"
  }
)
```
**Purpose**: Filter by account status for phone login checks

### 7. Email Verification
```javascript
db.users.createIndex(
  { "emailVerified": 1, "createdAt": 1 },
  {
    partialFilterExpression: { 
      "emailVerified": false,
      "email": { $ne: null }
    },
    name: "unverified_emails"
  }
)
```
**Purpose**: Track unverified email accounts for cleanup/reminders

### 8. Phone Verification
```javascript
db.users.createIndex(
  { "phoneVerified": 1, "createdAt": 1 },
  {
    partialFilterExpression: { 
      "phoneVerified": false,
      "phone": { $ne: null }
    },
    name: "unverified_phones"
  }
)
```
**Purpose**: Track unverified phone accounts for cleanup/reminders

## OAuth Provider Indexes

### 9. Google OAuth
```javascript
db.users.createIndex(
  { "authProviders.google.id": 1 },
  {
    sparse: true,
    unique: true,
    name: "google_oauth_id"
  }
)
```
**Purpose**: Fast lookup for Google OAuth login

### 10. Facebook OAuth
```javascript
db.users.createIndex(
  { "authProviders.facebook.id": 1 },
  {
    sparse: true,
    unique: true,
    name: "facebook_oauth_id"
  }
)
```
**Purpose**: Fast lookup for Facebook OAuth login

## Access Control Indexes

### 11. User Roles
```javascript
db.users.createIndex(
  { "roles": 1, "status": 1 },
  { 
    name: "roles_status"
  }
)
```
**Purpose**: Find users by role (admin, host, user)

### 12. User Permissions
```javascript
db.users.createIndex(
  { "permissions": 1 },
  {
    sparse: true,
    name: "permissions"
  }
)
```
**Purpose**: Find users with specific permissions

## Activity Indexes

### 13. Last Login
```javascript
db.users.createIndex(
  { "lastLogin": -1 },
  { 
    sparse: true,
    name: "last_login"
  }
)
```
**Purpose**: Track inactive accounts, recent activity

### 14. Creation Date
```javascript
db.users.createIndex(
  { "createdAt": -1 },
  { 
    name: "created_date"
  }
)
```
**Purpose**: Sort users by registration date

## Security Indexes

### 15. Password Reset Token
```javascript
db.users.createIndex(
  { "passwordResetToken": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "passwordResetToken": { $ne: null }
    },
    name: "password_reset_tokens"
  }
)
```
**Purpose**: Fast lookup for password reset validation

### 16. Password Reset Expiry
```javascript
db.users.createIndex(
  { "passwordResetExpires": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "passwordResetExpires": { $gt: new Date() }
    },
    name: "active_reset_tokens"
  }
)
```
**Purpose**: Clean up expired reset tokens

## Compound Indexes for Common Queries

### 17. Active Users by Role
```javascript
db.users.createIndex(
  { "status": 1, "roles": 1, "lastLogin": -1 },
  {
    partialFilterExpression: { 
      "status": "active"
    },
    name: "active_users_by_role"
  }
)
```
**Purpose**: Efficient queries for active users by role

### 18. Login Activity
```javascript
db.users.createIndex(
  { "loginCount": -1, "lastLogin": -1 },
  {
    name: "login_activity"
  }
)
```
**Purpose**: Track most active users

## Performance Considerations

1. **Minimal Indexes**: Only essential indexes for authentication performance
2. **Partial Indexes**: Reduce index size for boolean/optional fields
3. **Sparse Indexes**: Save space on optional fields like email, phone
4. **Compound Indexes**: Optimize common query patterns
5. **Unique Constraints**: Enforce data integrity at database level

## Index Usage Monitoring

```javascript
// Monitor authentication index usage
db.users.aggregate([
  { $indexStats: {} },
  { $match: { 
    name: { $in: ["email_unique", "phone_unique", "status_email", "status_phone", "last_login"] }
  }},
  { $sort: { "accesses.ops": -1 } }
])

// Check for unused indexes
db.users.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": 0 } }
])

// Validate index health
db.users.validate({ full: true })
```

## Index Maintenance

1. **Regular Reviews**: Monthly index usage analysis
2. **Remove Unused**: Drop indexes with zero operations
3. **Rebuild if Needed**: For fragmented indexes
4. **Monitor Size**: Track index memory usage

```javascript
// Get index sizes
db.users.stats().indexSizes

// Rebuild specific index
db.users.reIndex("email_unique")

// Drop unused index
db.users.dropIndex("unused_index_name")
```