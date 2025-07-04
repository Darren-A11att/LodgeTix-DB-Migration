# Users Collection Schema

## Overview
The `users` collection stores authentication-only information. All profile data is stored in the `contacts` collection to maintain separation of concerns between authentication and personal information.

## Purpose
- User authentication and authorization
- Email-based login system
- Account status management
- Multi-factor authentication support
- Session tracking and security

## Schema Structure

### Core Fields

```javascript
{
  _id: ObjectId,
  email: String,              // Required, unique, valid email format
  password: String | null,    // Hashed password (bcrypt)
  contactId: ObjectId | null, // Reference to contact for profile data
  status: String,             // Required: active, inactive, suspended, pending
  emailVerified: Boolean,     // Email verification status
  authentication: {
    lastLogin: Date | null,
    lastLoginIp: String | null,
    failedAttempts: Number,   // Min: 0, for rate limiting
    lockedUntil: Date | null, // Account lockout timestamp
    mfa: {
      enabled: Boolean,
      type: String | null,    // totp, sms, email
      secret: String | null   // Encrypted MFA secret
    }
  },
  createdAt: Date,           // Required
  updatedAt: Date | null
}
```

### Field Details

#### email
- **Type**: String
- **Required**: Yes
- **Unique**: Yes
- **Pattern**: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$`
- **Description**: Primary authentication identifier

#### password
- **Type**: String | null
- **Required**: No
- **Description**: Bcrypt hashed password. Null for SSO or passwordless users

#### contactId
- **Type**: ObjectId | null
- **Required**: No
- **Unique**: Yes (when present)
- **Description**: Links to contact record containing all profile information

#### status
- **Type**: String (enum)
- **Required**: Yes
- **Values**: 
  - `active`: Can log in normally
  - `inactive`: Cannot log in, voluntary deactivation
  - `suspended`: Cannot log in, administrative action
  - `pending`: Awaiting email verification

#### emailVerified
- **Type**: Boolean
- **Default**: false
- **Description**: Whether email address has been verified

#### authentication
- **Type**: Object
- **Description**: Authentication metadata and security settings
- **Fields**:
  - `lastLogin`: Last successful login timestamp
  - `lastLoginIp`: IP address of last login
  - `failedAttempts`: Count for rate limiting (reset on successful login)
  - `lockedUntil`: Temporary lockout expiry
  - `mfa`: Multi-factor authentication configuration

## Relationships

### To Contacts (1:1)
- Each user can have one associated contact record
- Contact stores all personal/profile information
- Relationship via `contactId` field

## Validation Rules

1. **Email Format**: Must be valid email address
2. **Status Values**: Must be one of allowed enum values
3. **Failed Attempts**: Cannot be negative
4. **Contact Uniqueness**: One user per contact maximum

## Security Considerations

1. **Password Storage**: Always bcrypt hashed, never plain text
2. **MFA Secret**: Encrypted at rest
3. **Rate Limiting**: Track failed attempts and lock accounts
4. **Session Management**: Track last login for security auditing
5. **Minimal Data**: No PII stored, only authentication essentials

## Migration from Legacy Model

### Changes from Previous Version
- Removed all profile fields (moved to contacts)
- Removed name fields
- Removed direct organisation relationships
- Simplified to authentication-only focus
- Added comprehensive authentication tracking
- Added MFA support structure

### Data Migration Strategy
1. Create contact record for each user
2. Move profile data to contact
3. Update contactId reference
4. Remove deprecated fields

## Example Documents

### Basic User
```json
{
  "_id": ObjectId("..."),
  "email": "john.smith@example.com",
  "password": "$2b$10$...",
  "contactId": ObjectId("..."),
  "status": "active",
  "emailVerified": true,
  "authentication": {
    "lastLogin": ISODate("2024-01-15T10:30:00Z"),
    "lastLoginIp": "192.168.1.100",
    "failedAttempts": 0,
    "lockedUntil": null,
    "mfa": {
      "enabled": false,
      "type": null,
      "secret": null
    }
  },
  "createdAt": ISODate("2023-06-01T12:00:00Z"),
  "updatedAt": ISODate("2024-01-15T10:30:00Z")
}
```

### User with MFA
```json
{
  "_id": ObjectId("..."),
  "email": "admin@lodge.org",
  "password": "$2b$10$...",
  "contactId": ObjectId("..."),
  "status": "active",
  "emailVerified": true,
  "authentication": {
    "lastLogin": ISODate("2024-01-20T08:00:00Z"),
    "lastLoginIp": "10.0.0.50",
    "failedAttempts": 0,
    "lockedUntil": null,
    "mfa": {
      "enabled": true,
      "type": "totp",
      "secret": "encrypted_secret_here"
    }
  },
  "createdAt": ISODate("2022-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-20T08:00:00Z")
}
```

### Locked Account
```json
{
  "_id": ObjectId("..."),
  "email": "suspicious@example.com",
  "password": "$2b$10$...",
  "contactId": null,
  "status": "active",
  "emailVerified": true,
  "authentication": {
    "lastLogin": ISODate("2024-01-10T15:00:00Z"),
    "lastLoginIp": "suspicious.ip.address",
    "failedAttempts": 5,
    "lockedUntil": ISODate("2024-01-20T16:30:00Z"),
    "mfa": {
      "enabled": false,
      "type": null,
      "secret": null
    }
  },
  "createdAt": ISODate("2023-12-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-20T16:00:00Z")
}
```