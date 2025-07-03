# Users Collection Schema

## Overview
The users collection represents authentication and authorization for system accounts. It focuses on login credentials, security, and access control. Personal information is now stored in the contacts collection, with users referencing their contact record via contactId.

## Document Structure

```javascript
{
  _id: ObjectId,
  userId: String,                 // Unique identifier (e.g., "USR-123456")
  
  // Authentication
  auth: {
    email: String,                // Primary email (unique)
    emailVerified: Boolean,
    emailVerifiedAt: Date,
    
    passwordHash: String,         // Bcrypt hash
    passwordChangedAt: Date,
    passwordResetToken: String,   // Temporary reset token
    passwordResetExpires: Date,
    
    // Multi-factor authentication
    mfa: {
      enabled: Boolean,
      method: String,             // "totp", "sms", "email"
      secret: String,             // Encrypted TOTP secret
      backupCodes: [String],      // Encrypted backup codes
      phone: String               // For SMS MFA
    },
    
    // OAuth providers
    providers: [{
      provider: String,           // "google", "facebook", "apple"
      providerId: String,         // Provider's user ID
      connectedAt: Date,
      profile: Object             // Provider profile data
    }],
    
    // Session management
    sessions: [{
      sessionId: String,
      createdAt: Date,
      expiresAt: Date,
      ipAddress: String,
      userAgent: String,
      location: {
        country: String,
        city: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      revoked: Boolean,
      revokedAt: Date
    }],
    
    // Security
    loginAttempts: Number,
    lockedUntil: Date,
    lastLoginAt: Date,
    lastLoginIp: String
  },
  
  // Contact Reference
  contactId: ObjectId,            // Reference to contacts collection (required)
  
  // User Preferences (not personal data)
  profile: {
    displayName: String,          // Preferred display name for UI
    
    // Profile customization
    avatar: {
      url: String,
      uploadedAt: Date,
      source: String              // "upload", "gravatar", "provider"
    },
    
    timezone: String,             // IANA timezone
    locale: String,               // Language preference
    currency: String              // Preferred currency
  },
  
  // Roles and Permissions
  access: {
    roles: [String],              // "customer", "staff", "admin", "superadmin"
    permissions: [String],        // Granular permissions
    
    // Organisation access
    organisations: [{
      organisationId: ObjectId,
      role: String,               // "member", "secretary", "admin"
      permissions: [String],      // Org-specific permissions
      joinedAt: Date,
      invitedBy: ObjectId,
      status: String              // "active", "suspended", "invited"
    }],
    
    // Restrictions
    restrictions: [{
      type: String,               // "purchase_limit", "event_ban"
      reason: String,
      appliedAt: Date,
      appliedBy: ObjectId,
      expiresAt: Date
    }]
  },
  
  // Financial Information
  financial: {
    // Payment methods
    paymentMethods: [{
      methodId: String,           // Unique ID
      type: String,               // "card", "bank", "paypal"
      
      // Card details (tokenized)
      card: {
        token: String,            // Payment gateway token
        last4: String,
        brand: String,            // "visa", "mastercard", etc.
        expiryMonth: Number,
        expiryYear: Number
      },
      
      // Bank details (encrypted)
      bank: {
        accountName: String,
        bsb: String,              // Encrypted
        accountNumber: String,    // Encrypted
        accountType: String
      },
      
      isDefault: Boolean,
      addedAt: Date,
      verifiedAt: Date
    }],
    
    // Billing preferences
    billing: {
      defaultAddress: ObjectId,   // Reference to addresses
      taxId: String,              // ABN, VAT, etc.
      invoiceEmails: [String],    // Additional invoice recipients
      autoPayEnabled: Boolean,
      paymentTerms: String        // "immediate", "net30", etc.
    },
    
    // Credit and loyalty
    credit: {
      balance: Decimal128,
      currency: String,
      history: [{
        amount: Decimal128,
        type: String,             // "purchase", "refund", "promotion"
        description: String,
        date: Date,
        referenceId: ObjectId
      }]
    },
    
    loyaltyPoints: {
      balance: Number,
      tier: String,               // "bronze", "silver", "gold", "platinum"
      tierExpiry: Date,
      lifetimePoints: Number
    }
  },
  
  // Preferences
  preferences: {
    // Communication preferences
    communications: {
      marketing: {
        email: Boolean,
        sms: Boolean,
        push: Boolean,
        post: Boolean
      },
      transactional: {
        email: Boolean,
        sms: Boolean
      },
      newsletter: Boolean,
      partnerOffers: Boolean
    },
    
    // Event preferences
    events: {
      categories: [String],       // Interested categories
      notifications: {
        newEvents: Boolean,
        preSale: Boolean,
        lastChance: Boolean
      },
      accessibility: [String],    // Required accommodations
      dietary: [String]           // Dietary preferences (actual requirements in contacts)
    },
    
    // Privacy settings
    privacy: {
      profileVisibility: String,  // "public", "friends", "private"
      showInDirectory: Boolean,
      allowTagging: Boolean,
      dataSharing: {
        analytics: Boolean,
        partners: Boolean,
        improvement: Boolean
      }
    }
  },
  
  // Activity and Engagement
  activity: {
    // Registration history
    registrations: {
      count: Number,
      firstDate: Date,
      lastDate: Date,
      totalSpent: Decimal128,
      functionIds: [String]       // Functions attended
    },
    
    // Interaction metrics
    engagement: {
      lastActiveAt: Date,
      loginCount: Number,
      pageViews: Number,
      searchQueries: [String],    // Recent searches
      favoriteEvents: [ObjectId], // Bookmarked events
      
      // Social features
      following: [ObjectId],      // Other users
      followers: [ObjectId],
      reviews: [{
        eventId: String,
        rating: Number,
        comment: String,
        postedAt: Date
      }]
    },
    
    // Support history
    support: {
      ticketsCreated: Number,
      lastTicketAt: Date,
      satisfactionScore: Number
    }
  },
  
  // Account Relationships
  relationships: {
    // Managed accounts (for parents/guardians)
    managedAccounts: [{
      userId: ObjectId,
      relationship: String,       // "child", "dependent"
      permissions: [String]       // What they can manage
    }]
  },
  
  // Compliance and Legal
  compliance: {
    // Terms acceptance
    termsAccepted: [{
      version: String,
      acceptedAt: Date,
      ipAddress: String
    }],
    
    // Age verification
    ageVerified: Boolean,
    ageVerifiedAt: Date,
    ageVerificationMethod: String,
    
    // Data retention
    dataRetention: {
      deleteRequestedAt: Date,
      deleteScheduledFor: Date,
      retentionReason: String     // If keeping despite request
    },
    
    // GDPR/Privacy
    gdpr: {
      consentGiven: Boolean,
      consentDate: Date,
      dataExports: [{
        requestedAt: Date,
        completedAt: Date,
        downloadUrl: String,
        expiresAt: Date
      }]
    }
  },
  
  // System fields
  flags: {
    isActive: Boolean,
    isVerified: Boolean,
    isVip: Boolean,
    isBanned: Boolean,
    isDeleted: Boolean,
    
    // Feature flags
    betaFeatures: [String],
    experimentGroups: [String]
  },
  
  // Metadata
  metadata: {
    source: String,               // "web", "mobile", "import", "admin"
    referrer: String,             // Referral source
    campaign: String,             // Marketing campaign
    
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    
    // Data quality
    lastValidated: Date,
    validationErrors: [String],
    importBatchId: String,
    legacyId: String              // ID from old system
  }
}
```

## Field Constraints

### Required Fields
- `userId` - Unique user identifier
- `auth.email` - Primary email address
- `contactId` - Reference to contacts collection
- `flags.isActive` - Account status

### Enumerations

**Roles:**
- `customer` - Regular user
- `staff` - Event staff
- `admin` - Administrator
- `superadmin` - System administrator
- `support` - Customer support

**MFA Methods:**
- `totp` - Time-based OTP
- `sms` - SMS verification
- `email` - Email verification

**OAuth Providers:**
- `google`
- `facebook`
- `apple`
- `microsoft`

## Indexes
- `userId` - Unique index
- `auth.email` - Unique index
- `contactId` - Contact reference lookup
- `auth.providers.providerId, auth.providers.provider` - Unique compound
- `access.organisations.organisationId` - Organisation members
- `metadata.createdAt` - Date range queries
- `flags.isActive, auth.email` - Active user lookups

## Relationships
- **Contacts** - User profile data via `contactId`
- **Registrations** - User makes registrations
- **Attendees** - User can be linked to attendee profiles
- **Organisations** - User belongs to organisations
- **Financial Transactions** - User's financial history

## Security Considerations

### Data Protection
- `auth.passwordHash` - Bcrypt with appropriate rounds
- `auth.mfa.secret` - AES encrypted
- `financial.paymentMethods` - Tokenized/encrypted
- `financial.bank` - Full encryption required

### Session Management
- Automatic session expiry
- Device fingerprinting
- Concurrent session limits
- Suspicious login detection

### Access Control
- Role-based permissions
- Organisation-specific roles
- Feature flags for gradual rollouts
- IP-based restrictions if needed

## Business Logic

### Account Creation
1. Create or link to contact record
2. Validate email uniqueness
3. Hash password with bcrypt
4. Send verification email
5. Create with basic customer role
6. Log account creation event

### Login Process
1. Check login attempts/lockout
2. Verify password
3. Check MFA if enabled
4. Create new session
5. Update last login info
6. Check for suspicious activity

### Password Reset
1. Generate secure reset token
2. Set expiry (24 hours)
3. Send reset email
4. Invalidate on use
5. Force logout other sessions

### Data Retention
- Soft delete by default
- Hard delete after retention period
- Anonymize rather than delete where possible
- Maintain audit trail for compliance