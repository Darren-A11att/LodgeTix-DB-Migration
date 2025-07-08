# Users Collection Schema

## Overview
The `users` collection stores authentication and access control information. All profile data is stored in the `contacts` collection to maintain separation of concerns between authentication and personal information.

## Purpose
- User authentication and authorization
- Email or phone-based login system
- OAuth provider integration
- Account status management
- Multi-factor authentication support
- Session tracking and security
- Role-based access control

## Schema Structure

### Core Fields

```javascript
{
  _id: ObjectId,
  userId: String,               // UUID v4
  contactId: String,            // Required, UUID v4, links to contact
  
  // Authentication identifiers (at least one required)
  email: String | null,         // From linked contact
  phone: String | null,         // From linked contact, E.164 format
  
  // Password authentication
  password: String | null,      // Hashed password (bcrypt)
  
  // OAuth providers
  authProviders: {
    google: {
      id: String,
      email: String | null
    },
    facebook: {
      id: String,
      email: String | null  
    }
  },
  
  // Access control
  roles: [String],              // ["user", "admin", "host"]
  permissions: [String],        // Specific permissions
  
  // Account status
  status: String,               // active, suspended, deleted
  emailVerified: Boolean,
  phoneVerified: Boolean,
  
  // Security
  lastLogin: Date | null,
  loginCount: Number,
  passwordResetToken: String | null,
  passwordResetExpires: Date | null,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

### Field Details

#### userId
- **Type**: String
- **Required**: Yes
- **Unique**: Yes
- **Pattern**: UUID v4
- **Description**: Unique identifier for the user

#### contactId
- **Type**: String
- **Required**: Yes
- **Unique**: Yes
- **Pattern**: UUID v4
- **Description**: Links to contact record containing all profile information

#### email
- **Type**: String | null
- **Required**: No (but email OR phone required)
- **Pattern**: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$`
- **Description**: Primary email for authentication (synced from contact)

#### phone
- **Type**: String | null
- **Required**: No (but email OR phone required)
- **Pattern**: `^\\+[1-9]\\d{1,14}$` (E.164 format)
- **Description**: Phone number for authentication (synced from contact)

#### password
- **Type**: String | null
- **Required**: No
- **Description**: Bcrypt hashed password. Null for OAuth or passwordless users

#### authProviders
- **Type**: Object
- **Description**: OAuth provider information
- **Providers**:
  - `google`: Google OAuth details
  - `facebook`: Facebook OAuth details
  - Additional providers can be added

#### roles
- **Type**: Array of Strings
- **Default**: ["user"]
- **Values**: 
  - `user`: Basic user access
  - `admin`: Administrative access
  - `host`: Event hosting capabilities

#### permissions
- **Type**: Array of Strings
- **Description**: Specific granular permissions
- **Examples**: "manage_events", "view_reports", "manage_users"

#### status
- **Type**: String (enum)
- **Required**: Yes
- **Values**: 
  - `active`: Can log in normally
  - `suspended`: Cannot log in, administrative action
  - `deleted`: Soft deleted, cannot log in

#### Security Fields
- **lastLogin**: Last successful login timestamp
- **loginCount**: Total number of successful logins
- **passwordResetToken**: Token for password reset (hashed)
- **passwordResetExpires**: Expiry time for reset token

## Relationships

### To Contacts (1:1)
- Each user MUST have one associated contact record
- Contact stores all personal/profile information
- Relationship via `contactId` field (UUID v4)
- Email and phone are synced from contact record

## Business Rules

### User Creation
1. **Contact First**: Contact must exist before creating user
2. **Authentication Method**: Must have either email or phone
3. **Booking/Billing Contacts**: Automatically get user accounts
4. **Default Role**: All users start with "user" role

### Authentication Rules
1. **Login Identifier**: Can use email OR phone to log in
2. **Password Optional**: Not required if using OAuth or magic links
3. **Verification**: Email/phone should be verified for security
4. **Multi-factor**: Can be enforced for admin/host roles

### Access Control
1. **Role Hierarchy**: admin > host > user
2. **Permission Based**: Check specific permissions for features
3. **Context Aware**: Access to organizations/events via contact record

## Security Considerations

1. **Password Storage**: Always bcrypt hashed, never plain text
2. **Token Security**: Reset tokens are hashed and time-limited
3. **OAuth Tokens**: Store only provider IDs, not access tokens
4. **Session Management**: Track login history for security auditing
5. **Minimal Data**: No PII stored, only authentication essentials

## Example Documents

### Basic User (Email Auth)
```json
{
  "_id": ObjectId("..."),
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "contactId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.smith@example.com",
  "phone": null,
  "password": "$2b$10$...",
  "authProviders": {},
  "roles": ["user"],
  "permissions": [],
  "status": "active",
  "emailVerified": true,
  "phoneVerified": false,
  "lastLogin": ISODate("2024-01-15T10:30:00Z"),
  "loginCount": 45,
  "passwordResetToken": null,
  "passwordResetExpires": null,
  "createdAt": ISODate("2023-06-01T12:00:00Z"),
  "updatedAt": ISODate("2024-01-15T10:30:00Z")
}
```

### OAuth User (Google)
```json
{
  "_id": ObjectId("..."),
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "contactId": "550e8400-e29b-41d4-a716-446655440003",
  "email": "jane.doe@gmail.com",
  "phone": "+61 400 123 456",
  "password": null,
  "authProviders": {
    "google": {
      "id": "115894251626389074321",
      "email": "jane.doe@gmail.com"
    }
  },
  "roles": ["user", "host"],
  "permissions": ["create_events", "manage_registrations"],
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "lastLogin": ISODate("2024-01-20T08:00:00Z"),
  "loginCount": 123,
  "passwordResetToken": null,
  "passwordResetExpires": null,
  "createdAt": ISODate("2022-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-20T08:00:00Z")
}
```

### Admin User (Phone Auth)
```json
{
  "_id": ObjectId("..."),
  "userId": "550e8400-e29b-41d4-a716-446655440004",
  "contactId": "550e8400-e29b-41d4-a716-446655440005",
  "email": null,
  "phone": "+61 400 999 888",
  "password": "$2b$10$...",
  "authProviders": {},
  "roles": ["user", "admin"],
  "permissions": ["manage_users", "view_reports", "manage_system"],
  "status": "active",
  "emailVerified": false,
  "phoneVerified": true,
  "lastLogin": ISODate("2024-01-21T14:00:00Z"),
  "loginCount": 89,
  "passwordResetToken": null,
  "passwordResetExpires": null,
  "createdAt": ISODate("2021-06-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-21T14:00:00Z")
}
```

## Migration Notes

### From Current Users Collection
1. Generate UUID v4 for userId
2. Create contact records for existing users
3. Move profile data to contacts
4. Update contactId with UUID v4 reference
5. Sync email/phone from contact
6. Map existing roles/permissions

### Required for Go-Live
1. All booking contacts must have users
2. All billing contacts must have users
3. Organization key personnel should have users
4. Event hosts must have users