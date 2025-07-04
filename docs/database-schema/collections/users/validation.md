# Users Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "status", "createdAt"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Valid email address for authentication"
        },
        password: {
          bsonType: ["string", "null"],
          description: "Hashed password"
        },
        contactId: {
          bsonType: ["objectId", "null"],
          description: "Reference to contact for profile data"
        },
        status: {
          bsonType: "string",
          enum: ["active", "inactive", "suspended", "pending"],
          description: "Account status"
        },
        emailVerified: {
          bsonType: "bool",
          description: "Email verification status"
        },
        authentication: {
          bsonType: ["object", "null"],
          properties: {
            lastLogin: { bsonType: ["date", "null"] },
            lastLoginIp: { bsonType: ["string", "null"] },
            failedAttempts: { 
              bsonType: "int", 
              minimum: 0,
              description: "Failed login attempts counter"
            },
            lockedUntil: { bsonType: ["date", "null"] },
            mfa: {
              bsonType: ["object", "null"],
              properties: {
                enabled: { bsonType: "bool" },
                type: { 
                  bsonType: ["string", "null"],
                  enum: ["totp", "sms", "email", null]
                },
                secret: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: ["date", "null"] }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Field Validation Rules

### Email
- **Required**: Yes
- **Format**: Valid email address pattern
- **Uniqueness**: Must be unique across collection
- **Case**: Store as lowercase for consistency
- **Max Length**: 255 characters

### Password
- **Required**: No (allows for SSO/passwordless)
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
  - `inactive`: Cannot log in (voluntary)
  - `suspended`: Cannot log in (administrative)
  - `pending`: Awaiting email verification

### Authentication Object
- **failedAttempts**: Must be >= 0
- **lockedUntil**: Must be future date when set
- **mfa.type**: Must be valid MFA method when enabled

## Business Rules

### 1. Account Creation
```javascript
// Validation for new user creation
async function validateNewUser(userData) {
  // Email must be unique
  const existingUser = await db.users.findOne({ 
    email: userData.email.toLowerCase() 
  });
  if (existingUser) {
    throw new Error('Email already registered');
  }
  
  // Set default values
  userData.email = userData.email.toLowerCase();
  userData.status = userData.status || 'pending';
  userData.emailVerified = false;
  userData.createdAt = new Date();
  
  return userData;
}
```

### 2. Password Policy
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

### 3. Account Lockout
```javascript
// Handle failed login attempts
async function handleFailedLogin(email) {
  const maxAttempts = 5;
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes
  
  const user = await db.users.findOne({ email: email.toLowerCase() });
  if (!user) return;
  
  const newFailedAttempts = (user.authentication?.failedAttempts || 0) + 1;
  
  const update = {
    'authentication.failedAttempts': newFailedAttempts
  };
  
  // Lock account after max attempts
  if (newFailedAttempts >= maxAttempts) {
    update['authentication.lockedUntil'] = new Date(Date.now() + lockoutDuration);
  }
  
  await db.users.updateOne(
    { _id: user._id },
    { $set: update }
  );
}

// Reset on successful login
async function handleSuccessfulLogin(userId) {
  await db.users.updateOne(
    { _id: userId },
    { 
      $set: {
        'authentication.lastLogin': new Date(),
        'authentication.failedAttempts': 0
      },
      $unset: {
        'authentication.lockedUntil': ''
      }
    }
  );
}
```

### 4. Email Verification
```javascript
// Check if account needs verification
function requiresEmailVerification(user) {
  return user.status === 'pending' && !user.emailVerified;
}

// Verify email
async function verifyEmail(userId) {
  await db.users.updateOne(
    { _id: userId },
    { 
      $set: {
        emailVerified: true,
        status: 'active'
      }
    }
  );
}
```

### 5. MFA Validation
```javascript
// Validate MFA setup
function validateMFASetup(mfaData) {
  const validTypes = ['totp', 'sms', 'email'];
  
  if (!validTypes.includes(mfaData.type)) {
    throw new Error('Invalid MFA type');
  }
  
  if (mfaData.type === 'totp' && !mfaData.secret) {
    throw new Error('TOTP secret required');
  }
  
  return true;
}
```

## Data Integrity Rules

### 1. Contact Reference Integrity
- If `contactId` is set, it must reference a valid contact
- One user maximum per contact
- Cannot change `contactId` once set

### 2. Status Transitions
- `pending` → `active`: After email verification
- `active` → `inactive`: User request
- `active` → `suspended`: Admin action only
- `suspended` → `active`: Admin action only
- `inactive` → `active`: User reactivation

### 3. Timestamp Consistency
- `createdAt` cannot be modified after creation
- `updatedAt` must be >= `createdAt`
- `authentication.lastLogin` must be >= `createdAt`

## Security Validations

### 1. Login Security
```javascript
// Validate login attempt
async function validateLogin(email, password, ipAddress) {
  const user = await db.users.findOne({ 
    email: email.toLowerCase() 
  });
  
  if (!user || user.status !== 'active') {
    throw new Error('Invalid credentials');
  }
  
  // Check lockout
  if (user.authentication?.lockedUntil > new Date()) {
    throw new Error('Account temporarily locked');
  }
  
  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    await handleFailedLogin(email);
    throw new Error('Invalid credentials');
  }
  
  // Update login info
  await handleSuccessfulLogin(user._id);
  
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
  
  // Check if email is verified
  if (!user.emailVerified) {
    return false;
  }
  
  return true;
}
```

## Audit Trail

### 1. Track Changes
```javascript
// Log authentication events
async function logAuthEvent(userId, eventType, metadata) {
  await db.authLogs.insertOne({
    userId,
    eventType, // 'login', 'logout', 'password_change', 'mfa_enable'
    timestamp: new Date(),
    metadata
  });
}
```

### 2. Monitor Suspicious Activity
```javascript
// Check for suspicious patterns
async function checkSuspiciousActivity(userId) {
  const recentFailures = await db.authLogs.countDocuments({
    userId,
    eventType: 'failed_login',
    timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
  });
  
  return recentFailures > 10;
}
```