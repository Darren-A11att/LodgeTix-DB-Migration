# Users Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "contactId", "status", "createdAt"],
      properties: {
        userId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "UUID v4 for user identification"
        },
        contactId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "UUID v4 reference to contact"
        },
        email: {
          bsonType: ["string", "null"],
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Email for authentication"
        },
        phone: {
          bsonType: ["string", "null"],
          pattern: "^\\+[1-9]\\d{1,14}$",
          description: "E.164 format phone number"
        },
        password: {
          bsonType: ["string", "null"],
          description: "Bcrypt hashed password"
        },
        authProviders: {
          bsonType: ["object", "null"],
          properties: {
            google: {
              bsonType: ["object", "null"],
              properties: {
                id: { bsonType: "string" },
                email: { bsonType: ["string", "null"] }
              }
            },
            facebook: {
              bsonType: ["object", "null"],
              properties: {
                id: { bsonType: "string" },
                email: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        roles: {
          bsonType: "array",
          items: {
            bsonType: "string",
            enum: ["user", "admin", "host"]
          }
        },
        permissions: {
          bsonType: ["array", "null"],
          items: { bsonType: "string" }
        },
        status: {
          bsonType: "string",
          enum: ["active", "suspended", "deleted"],
          description: "Account status"
        },
        emailVerified: {
          bsonType: "bool",
          description: "Email verification status"
        },
        phoneVerified: {
          bsonType: "bool",
          description: "Phone verification status"
        },
        lastLogin: { bsonType: ["date", "null"] },
        loginCount: { 
          bsonType: "int",
          minimum: 0
        },
        passwordResetToken: { bsonType: ["string", "null"] },
        passwordResetExpires: { bsonType: ["date", "null"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Field Validation Rules

### Core Identifiers
- **userId**: Must be valid UUID v4
- **contactId**: Must be valid UUID v4, required, links to contact

### Authentication Fields
- **email**: Valid email format, must be unique when present
- **phone**: E.164 format (+1234567890), must be unique when present
- **At least one required**: Must have email OR phone

### Password
- **Required**: No (allows for OAuth/passwordless)
- **Format**: Bcrypt hash (60 characters)
- **Strength Requirements** (pre-hash):
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### Status
- **Required**: Yes
- **Values**: Must be one of:
  - `active`: Can log in
  - `suspended`: Cannot log in (administrative)
  - `deleted`: Soft deleted, cannot log in

### Roles & Permissions
- **roles**: Array of strings, default ["user"]
- **permissions**: Array of specific permission strings

## Business Rules

### 1. Account Creation
```javascript
// Validation for new user creation
async function validateNewUser(userData) {
  // Must have email or phone
  if (!userData.email && !userData.phone) {
    throw new Error('Email or phone required');
  }
  
  // Contact must exist
  const contact = await db.contacts.findOne({ 
    contactId: userData.contactId 
  });
  if (!contact) {
    throw new Error('Contact must exist before creating user');
  }
  
  // Check email uniqueness
  if (userData.email) {
    const existingEmail = await db.users.findOne({ 
      email: userData.email.toLowerCase() 
    });
    if (existingEmail) {
      throw new Error('Email already registered');
    }
  }
  
  // Check phone uniqueness
  if (userData.phone) {
    const existingPhone = await db.users.findOne({ 
      phone: userData.phone 
    });
    if (existingPhone) {
      throw new Error('Phone already registered');
    }
  }
  
  // Set defaults
  userData.userId = generateUUID();
  userData.email = userData.email?.toLowerCase() || null;
  userData.status = userData.status || 'active';
  userData.emailVerified = false;
  userData.phoneVerified = false;
  userData.roles = userData.roles || ['user'];
  userData.permissions = userData.permissions || [];
  userData.loginCount = 0;
  userData.createdAt = new Date();
  userData.updatedAt = new Date();
  
  return userData;
}
```

### 2. Contact Synchronization
```javascript
// Sync email/phone from contact
async function syncContactInfo(userId) {
  const user = await db.users.findOne({ userId });
  const contact = await db.contacts.findOne({ contactId: user.contactId });
  
  if (!contact) {
    throw new Error('Contact not found');
  }
  
  const updates = {};
  
  // Update email if changed
  if (contact.email !== user.email) {
    // Check uniqueness before updating
    if (contact.email) {
      const existing = await db.users.findOne({ 
        email: contact.email,
        userId: { $ne: userId }
      });
      if (!existing) {
        updates.email = contact.email;
      }
    }
  }
  
  // Update phone if changed
  if (contact.phone !== user.phone) {
    // Check uniqueness before updating
    if (contact.phone) {
      const existing = await db.users.findOne({ 
        phone: contact.phone,
        userId: { $ne: userId }
      });
      if (!existing) {
        updates.phone = contact.phone;
      }
    }
  }
  
  if (Object.keys(updates).length > 0) {
    await db.users.updateOne(
      { userId },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );
  }
}
```

### 3. OAuth Provider Validation
```javascript
// Validate OAuth provider
async function validateOAuthProvider(provider, providerId, email) {
  const validProviders = ['google', 'facebook'];
  
  if (!validProviders.includes(provider)) {
    throw new Error('Invalid OAuth provider');
  }
  
  // Check if provider ID already exists
  const existing = await db.users.findOne({
    [`authProviders.${provider}.id`]: providerId
  });
  
  if (existing) {
    return existing; // User already exists with this provider
  }
  
  return null;
}
```

### 4. Password Policy
```javascript
// Validate password strength
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength) {
    throw new Error('Password must be at least 8 characters');
  }
  
  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    throw new Error('Password must contain uppercase, lowercase, number and special character');
  }
  
  return true;
}
```

### 5. Login Validation
```javascript
// Validate login attempt
async function validateLogin(identifier, password) {
  // Find user by email or phone
  const user = await db.users.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { phone: normalizePhone(identifier) }
    ]
  });
  
  if (!user || user.status !== 'active') {
    throw new Error('Invalid credentials');
  }
  
  // Verify password if using password auth
  if (password && user.password) {
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }
  }
  
  // Update login info
  await db.users.updateOne(
    { userId: user.userId },
    { 
      $set: {
        lastLogin: new Date(),
        updatedAt: new Date()
      },
      $inc: {
        loginCount: 1
      }
    }
  );
  
  return user;
}
```

### 6. Phone Number Normalization
```javascript
// Normalize phone to E.164 format
function normalizePhone(phone, defaultCountryCode = '+61') {
  if (!phone) return null;
  
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (!phone.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode.replace('+', '') + cleaned;
  }
  
  return '+' + cleaned;
}
```

## Data Integrity Rules

### 1. Contact Reference Integrity
- Contact must exist before creating user
- One user maximum per contact
- Cannot change `contactId` after creation

### 2. Authentication Method
- Must have at least one: email, phone, or OAuth provider
- Email and phone must be unique across users
- OAuth provider IDs must be unique

### 3. Role Hierarchy
- All users start with 'user' role
- Admin role includes all user permissions
- Host role includes event management permissions

### 4. Required User Accounts
- Booking contacts MUST have user accounts
- Billing contacts MUST have user accounts
- Organization key personnel should have users
- Event hosts MUST have user accounts

## Security Validations

### 1. Password Reset Security
```javascript
// Generate secure reset token
async function generatePasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  const expires = new Date(Date.now() + 3600000); // 1 hour
  
  await db.users.updateOne(
    { userId },
    { 
      $set: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
        updatedAt: new Date()
      }
    }
  );
  
  return token; // Return unhashed token to send to user
}

// Validate reset token
async function validateResetToken(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  const user = await db.users.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() }
  });
  
  if (!user) {
    throw new Error('Invalid or expired reset token');
  }
  
  return user;
}
```

### 2. Session Validation
```javascript
// Validate active session
function isSessionValid(user) {
  // Check if account is active
  if (user.status !== 'active') {
    return false;
  }
  
  // Check if authentication method is verified
  if (user.email && !user.emailVerified) {
    return false;
  }
  
  if (user.phone && !user.phoneVerified) {
    return false;
  }
  
  return true;
}
```