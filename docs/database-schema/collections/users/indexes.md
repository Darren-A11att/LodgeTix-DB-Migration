# Users Collection - Indexes

## Primary Indexes

### 1. Unique Email
```javascript
db.users.createIndex(
  { "email": 1 },
  { 
    unique: true,
    name: "email_unique"
  }
)
```
**Purpose**: Ensure email uniqueness, authentication lookups

### 2. Contact Reference
```javascript
db.users.createIndex(
  { "contactId": 1 },
  { 
    sparse: true,
    unique: true,
    name: "contact_unique"
  }
)
```
**Purpose**: Ensure one user per contact, fast contact lookup

## Authentication Indexes

### 3. Account Status
```javascript
db.users.createIndex(
  { "status": 1, "email": 1 },
  { 
    name: "status_email"
  }
)
```
**Purpose**: Filter by account status for login checks

### 4. Email Verification
```javascript
db.users.createIndex(
  { "emailVerified": 1, "createdAt": 1 },
  {
    partialFilterExpression: { 
      "emailVerified": false 
    },
    name: "unverified_accounts"
  }
)
```
**Purpose**: Track unverified accounts for cleanup/reminders

### 5. Account Lockout
```javascript
db.users.createIndex(
  { "authentication.lockedUntil": 1 },
  {
    sparse: true,
    partialFilterExpression: { 
      "authentication.lockedUntil": { $exists: true } 
    },
    name: "locked_accounts"
  }
)
```
**Purpose**: Track and expire account lockouts

## Activity Indexes

### 6. Last Login
```javascript
db.users.createIndex(
  { "authentication.lastLogin": -1 },
  { 
    sparse: true,
    name: "last_login"
  }
)
```
**Purpose**: Track inactive accounts, recent activity

### 7. Creation Date
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

### 8. Failed Login Attempts
```javascript
db.users.createIndex(
  { "authentication.failedAttempts": -1 },
  {
    partialFilterExpression: { 
      "authentication.failedAttempts": { $gt: 0 } 
    },
    name: "failed_attempts"
  }
)
```
**Purpose**: Monitor suspicious activity, rate limiting

### 9. MFA Status
```javascript
db.users.createIndex(
  { "authentication.mfa.enabled": 1, "status": 1 },
  {
    sparse: true,
    name: "mfa_enabled"
  }
)
```
**Purpose**: Track MFA adoption, security audits

## Performance Considerations

1. **Minimal Indexes**: Only essential indexes for authentication performance
2. **Partial Indexes**: Reduce index size for boolean/optional fields
3. **Sparse Indexes**: Save space on optional fields like contactId
4. **Compound Indexes**: Optimize common query patterns

## Index Usage Monitoring

```javascript
// Monitor authentication index usage
db.users.aggregate([
  { $indexStats: {} },
  { $match: { 
    name: { $in: ["email_unique", "status_email", "last_login"] }
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
```