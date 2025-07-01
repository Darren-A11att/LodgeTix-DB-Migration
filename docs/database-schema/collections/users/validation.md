# Users Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "auth", "profile", "flags"],
      properties: {
        userId: {
          bsonType: "string",
          pattern: "^USR-[0-9]{6}$",
          description: "User ID must follow pattern USR-NNNNNN"
        },
        auth: {
          bsonType: "object",
          required: ["email"],
          properties: {
            email: {
              bsonType: "string",
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              description: "Must be valid email address"
            },
            emailVerified: { bsonType: "bool" },
            emailVerifiedAt: { bsonType: ["date", "null"] },
            passwordHash: {
              bsonType: "string",
              minLength: 60,
              description: "Bcrypt hash"
            },
            passwordChangedAt: { bsonType: ["date", "null"] },
            passwordResetToken: { bsonType: ["string", "null"] },
            passwordResetExpires: { bsonType: ["date", "null"] },
            mfa: {
              bsonType: ["object", "null"],
              properties: {
                enabled: { bsonType: "bool" },
                method: {
                  bsonType: "string",
                  enum: ["totp", "sms", "email"]
                },
                secret: { bsonType: ["string", "null"] },
                backupCodes: {
                  bsonType: "array",
                  items: { bsonType: "string" },
                  maxItems: 10
                },
                phone: {
                  bsonType: ["string", "null"],
                  pattern: "^\\+?[0-9\\s-()]+$"
                }
              }
            },
            providers: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["provider", "providerId", "connectedAt"],
                properties: {
                  provider: {
                    bsonType: "string",
                    enum: ["google", "facebook", "apple", "microsoft"]
                  },
                  providerId: { bsonType: "string" },
                  connectedAt: { bsonType: "date" },
                  profile: { bsonType: "object" }
                }
              }
            },
            sessions: {
              bsonType: "array",
              maxItems: 10,
              items: {
                bsonType: "object",
                required: ["sessionId", "createdAt", "expiresAt"],
                properties: {
                  sessionId: {
                    bsonType: "string",
                    minLength: 32
                  },
                  createdAt: { bsonType: "date" },
                  expiresAt: { bsonType: "date" },
                  ipAddress: {
                    bsonType: ["string", "null"],
                    pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$"
                  },
                  userAgent: { bsonType: ["string", "null"] },
                  location: {
                    bsonType: ["object", "null"],
                    properties: {
                      country: { bsonType: "string" },
                      city: { bsonType: "string" },
                      coordinates: {
                        bsonType: "object",
                        properties: {
                          latitude: {
                            bsonType: "number",
                            minimum: -90,
                            maximum: 90
                          },
                          longitude: {
                            bsonType: "number",
                            minimum: -180,
                            maximum: 180
                          }
                        }
                      }
                    }
                  },
                  revoked: { bsonType: "bool" },
                  revokedAt: { bsonType: ["date", "null"] }
                }
              }
            },
            loginAttempts: {
              bsonType: "int",
              minimum: 0,
              maximum: 10
            },
            lockedUntil: { bsonType: ["date", "null"] },
            lastLoginAt: { bsonType: ["date", "null"] },
            lastLoginIp: { bsonType: ["string", "null"] }
          }
        },
        profile: {
          bsonType: "object",
          required: ["firstName", "lastName"],
          properties: {
            firstName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 100
            },
            lastName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 100
            },
            displayName: {
              bsonType: ["string", "null"],
              maxLength: 200
            },
            dateOfBirth: { bsonType: ["date", "null"] },
            gender: {
              bsonType: ["string", "null"],
              enum: ["male", "female", "other", "prefer_not_to_say", null]
            },
            phones: {
              bsonType: "array",
              maxItems: 5,
              items: {
                bsonType: "object",
                required: ["type", "number"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["mobile", "home", "work"]
                  },
                  number: {
                    bsonType: "string",
                    pattern: "^\\+?[0-9\\s-()]+$"
                  },
                  verified: { bsonType: "bool" },
                  primary: { bsonType: "bool" }
                }
              }
            },
            addresses: {
              bsonType: "array",
              maxItems: 5,
              items: {
                bsonType: "object",
                required: ["type", "addressLine1", "city", "country"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["home", "work", "billing", "shipping"]
                  },
                  addressLine1: {
                    bsonType: "string",
                    minLength: 1,
                    maxLength: 200
                  },
                  addressLine2: {
                    bsonType: ["string", "null"],
                    maxLength: 200
                  },
                  city: {
                    bsonType: "string",
                    maxLength: 100
                  },
                  state: {
                    bsonType: ["string", "null"],
                    maxLength: 100
                  },
                  postcode: {
                    bsonType: ["string", "null"],
                    maxLength: 20
                  },
                  country: {
                    bsonType: "string",
                    minLength: 2,
                    maxLength: 2
                  },
                  primary: { bsonType: "bool" },
                  validatedAt: { bsonType: ["date", "null"] }
                }
              }
            },
            avatar: {
              bsonType: ["object", "null"],
              properties: {
                url: {
                  bsonType: "string",
                  pattern: "^https?://"
                },
                uploadedAt: { bsonType: "date" },
                source: {
                  bsonType: "string",
                  enum: ["upload", "gravatar", "provider"]
                }
              }
            },
            timezone: {
              bsonType: "string",
              pattern: "^[A-Za-z_]+/[A-Za-z_]+$"
            },
            locale: {
              bsonType: "string",
              pattern: "^[a-z]{2}-[A-Z]{2}$"
            },
            currency: {
              bsonType: "string",
              minLength: 3,
              maxLength: 3
            }
          }
        },
        access: {
          bsonType: "object",
          properties: {
            roles: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["customer", "staff", "admin", "superadmin", "support"]
              }
            },
            permissions: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            organisations: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["organisationId", "role", "status"],
                properties: {
                  organisationId: { bsonType: "objectId" },
                  role: {
                    bsonType: "string",
                    enum: ["member", "secretary", "admin", "owner"]
                  },
                  permissions: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  joinedAt: { bsonType: "date" },
                  invitedBy: { bsonType: ["objectId", "null"] },
                  status: {
                    bsonType: "string",
                    enum: ["active", "suspended", "invited", "declined"]
                  }
                }
              }
            },
            restrictions: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["type", "reason", "appliedAt"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["purchase_limit", "event_ban", "account_freeze"]
                  },
                  reason: { bsonType: "string" },
                  appliedAt: { bsonType: "date" },
                  appliedBy: { bsonType: "objectId" },
                  expiresAt: { bsonType: ["date", "null"] }
                }
              }
            }
          }
        },
        financial: {
          bsonType: ["object", "null"],
          properties: {
            paymentMethods: {
              bsonType: "array",
              maxItems: 10,
              items: {
                bsonType: "object",
                required: ["methodId", "type"],
                properties: {
                  methodId: { bsonType: "string" },
                  type: {
                    bsonType: "string",
                    enum: ["card", "bank", "paypal"]
                  },
                  card: {
                    bsonType: ["object", "null"],
                    properties: {
                      token: { bsonType: "string" },
                      last4: {
                        bsonType: "string",
                        pattern: "^[0-9]{4}$"
                      },
                      brand: {
                        bsonType: "string",
                        enum: ["visa", "mastercard", "amex", "discover"]
                      },
                      expiryMonth: {
                        bsonType: "int",
                        minimum: 1,
                        maximum: 12
                      },
                      expiryYear: {
                        bsonType: "int",
                        minimum: 2024,
                        maximum: 2099
                      }
                    }
                  },
                  bank: {
                    bsonType: ["object", "null"],
                    properties: {
                      accountName: { bsonType: "string" },
                      bsb: { bsonType: "string" },
                      accountNumber: { bsonType: "string" },
                      accountType: {
                        bsonType: "string",
                        enum: ["savings", "checking"]
                      }
                    }
                  },
                  isDefault: { bsonType: "bool" },
                  addedAt: { bsonType: "date" },
                  verifiedAt: { bsonType: ["date", "null"] }
                }
              }
            },
            billing: {
              bsonType: ["object", "null"],
              properties: {
                defaultAddress: { bsonType: ["objectId", "null"] },
                taxId: {
                  bsonType: ["string", "null"],
                  pattern: "^[0-9A-Z-]+$"
                },
                invoiceEmails: {
                  bsonType: "array",
                  items: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  }
                },
                autoPayEnabled: { bsonType: "bool" },
                paymentTerms: {
                  bsonType: "string",
                  enum: ["immediate", "net15", "net30", "net60", "net90"]
                }
              }
            },
            credit: {
              bsonType: ["object", "null"],
              properties: {
                balance: { bsonType: "decimal", minimum: 0 },
                currency: {
                  bsonType: "string",
                  minLength: 3,
                  maxLength: 3
                },
                history: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      amount: { bsonType: "decimal" },
                      type: {
                        bsonType: "string",
                        enum: ["purchase", "refund", "promotion", "adjustment"]
                      },
                      description: { bsonType: "string" },
                      date: { bsonType: "date" },
                      referenceId: { bsonType: ["objectId", "null"] }
                    }
                  }
                }
              }
            },
            loyaltyPoints: {
              bsonType: ["object", "null"],
              properties: {
                balance: { bsonType: "int", minimum: 0 },
                tier: {
                  bsonType: "string",
                  enum: ["bronze", "silver", "gold", "platinum"]
                },
                tierExpiry: { bsonType: ["date", "null"] },
                lifetimePoints: { bsonType: "int", minimum: 0 }
              }
            }
          }
        },
        preferences: {
          bsonType: ["object", "null"],
          properties: {
            communications: {
              bsonType: "object",
              properties: {
                marketing: {
                  bsonType: "object",
                  properties: {
                    email: { bsonType: "bool" },
                    sms: { bsonType: "bool" },
                    push: { bsonType: "bool" },
                    post: { bsonType: "bool" }
                  }
                },
                transactional: {
                  bsonType: "object",
                  properties: {
                    email: { bsonType: "bool" },
                    sms: { bsonType: "bool" }
                  }
                },
                newsletter: { bsonType: "bool" },
                partnerOffers: { bsonType: "bool" }
              }
            },
            events: {
              bsonType: ["object", "null"],
              properties: {
                categories: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                },
                notifications: {
                  bsonType: "object",
                  properties: {
                    newEvents: { bsonType: "bool" },
                    preSale: { bsonType: "bool" },
                    lastChance: { bsonType: "bool" }
                  }
                },
                accessibility: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                },
                dietary: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                }
              }
            },
            privacy: {
              bsonType: ["object", "null"],
              properties: {
                profileVisibility: {
                  bsonType: "string",
                  enum: ["public", "friends", "private"]
                },
                showInDirectory: { bsonType: "bool" },
                allowTagging: { bsonType: "bool" },
                dataSharing: {
                  bsonType: "object",
                  properties: {
                    analytics: { bsonType: "bool" },
                    partners: { bsonType: "bool" },
                    improvement: { bsonType: "bool" }
                  }
                }
              }
            }
          }
        },
        activity: {
          bsonType: ["object", "null"],
          properties: {
            registrations: {
              bsonType: ["object", "null"],
              properties: {
                count: { bsonType: "int", minimum: 0 },
                firstDate: { bsonType: ["date", "null"] },
                lastDate: { bsonType: ["date", "null"] },
                totalSpent: { bsonType: "decimal", minimum: 0 },
                functionIds: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                }
              }
            },
            engagement: {
              bsonType: ["object", "null"],
              properties: {
                lastActiveAt: { bsonType: ["date", "null"] },
                loginCount: { bsonType: "int", minimum: 0 },
                pageViews: { bsonType: "int", minimum: 0 },
                searchQueries: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                },
                favoriteEvents: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                },
                following: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                },
                followers: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                },
                reviews: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      eventId: { bsonType: "string" },
                      rating: {
                        bsonType: "int",
                        minimum: 1,
                        maximum: 5
                      },
                      comment: { bsonType: ["string", "null"] },
                      postedAt: { bsonType: "date" }
                    }
                  }
                }
              }
            },
            support: {
              bsonType: ["object", "null"],
              properties: {
                ticketsCreated: { bsonType: "int", minimum: 0 },
                lastTicketAt: { bsonType: ["date", "null"] },
                satisfactionScore: {
                  bsonType: "number",
                  minimum: 0,
                  maximum: 5
                }
              }
            }
          }
        },
        relationships: {
          bsonType: ["object", "null"],
          properties: {
            family: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  userId: { bsonType: "objectId" },
                  relationship: {
                    bsonType: "string",
                    enum: ["spouse", "child", "parent", "sibling", "guardian"]
                  },
                  confirmed: { bsonType: "bool" }
                }
              }
            },
            emergencyContacts: {
              bsonType: "array",
              maxItems: 3,
              items: {
                bsonType: "object",
                required: ["name", "phone"],
                properties: {
                  name: { bsonType: "string" },
                  relationship: { bsonType: "string" },
                  phone: {
                    bsonType: "string",
                    pattern: "^\\+?[0-9\\s-()]+$"
                  },
                  email: {
                    bsonType: ["string", "null"],
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  }
                }
              }
            },
            managedAccounts: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  userId: { bsonType: "objectId" },
                  relationship: {
                    bsonType: "string",
                    enum: ["child", "dependent"]
                  },
                  permissions: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  }
                }
              }
            }
          }
        },
        compliance: {
          bsonType: ["object", "null"],
          properties: {
            termsAccepted: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["version", "acceptedAt"],
                properties: {
                  version: { bsonType: "string" },
                  acceptedAt: { bsonType: "date" },
                  ipAddress: {
                    bsonType: ["string", "null"],
                    pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$"
                  }
                }
              }
            },
            ageVerified: { bsonType: "bool" },
            ageVerifiedAt: { bsonType: ["date", "null"] },
            ageVerificationMethod: {
              bsonType: ["string", "null"],
              enum: ["id_check", "credit_card", "manual", null]
            },
            dataRetention: {
              bsonType: ["object", "null"],
              properties: {
                deleteRequestedAt: { bsonType: ["date", "null"] },
                deleteScheduledFor: { bsonType: ["date", "null"] },
                retentionReason: { bsonType: ["string", "null"] }
              }
            },
            gdpr: {
              bsonType: ["object", "null"],
              properties: {
                consentGiven: { bsonType: "bool" },
                consentDate: { bsonType: ["date", "null"] },
                dataExports: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      requestedAt: { bsonType: "date" },
                      completedAt: { bsonType: ["date", "null"] },
                      downloadUrl: { bsonType: ["string", "null"] },
                      expiresAt: { bsonType: ["date", "null"] }
                    }
                  }
                }
              }
            }
          }
        },
        flags: {
          bsonType: "object",
          required: ["isActive"],
          properties: {
            isActive: { bsonType: "bool" },
            isVerified: { bsonType: "bool" },
            isVip: { bsonType: "bool" },
            isBanned: { bsonType: "bool" },
            isDeleted: { bsonType: "bool" },
            betaFeatures: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            experimentGroups: {
              bsonType: "array",
              items: { bsonType: "string" }
            }
          }
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt", "updatedAt"],
          properties: {
            source: {
              bsonType: "string",
              enum: ["web", "mobile", "import", "admin", "api"]
            },
            referrer: { bsonType: ["string", "null"] },
            campaign: { bsonType: ["string", "null"] },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
            updatedAt: { bsonType: "date" },
            updatedBy: { bsonType: ["objectId", "null"] },
            lastValidated: { bsonType: ["date", "null"] },
            validationErrors: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            importBatchId: { bsonType: ["string", "null"] },
            legacyId: { bsonType: ["string", "null"] }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Custom Validation Rules

### 1. Email Uniqueness
```javascript
// Ensure email is unique across active users
async function validateEmailUniqueness(email, userId) {
  const existing = await db.users.findOne({
    "auth.email": email.toLowerCase(),
    _id: { $ne: userId },
    "flags.isDeleted": false
  });
  
  return !existing;
}
```

### 2. Password Strength
```javascript
// Validate password meets security requirements
function validatePassword(password) {
  // At least 8 characters
  if (password.length < 8) return false;
  
  // Contains uppercase
  if (!/[A-Z]/.test(password)) return false;
  
  // Contains lowercase
  if (!/[a-z]/.test(password)) return false;
  
  // Contains number
  if (!/[0-9]/.test(password)) return false;
  
  // Contains special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  
  return true;
}
```

### 3. Age Verification
```javascript
// Ensure user meets minimum age requirement
function validateAge(dateOfBirth, minimumAge = 18) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= minimumAge;
}
```

### 4. Session Validation
```javascript
// Validate session limits and cleanup
async function validateSessions(userId, newSession) {
  const user = await db.users.findOne({ _id: userId });
  const activeSessions = user.auth.sessions.filter(s => 
    !s.revoked && s.expiresAt > new Date()
  );
  
  // Maximum 5 active sessions
  if (activeSessions.length >= 5) {
    // Revoke oldest session
    const oldestSession = activeSessions.sort((a, b) => 
      a.createdAt - b.createdAt
    )[0];
    
    await db.users.updateOne(
      { _id: userId, "auth.sessions.sessionId": oldestSession.sessionId },
      { $set: { "auth.sessions.$.revoked": true, "auth.sessions.$.revokedAt": new Date() } }
    );
  }
  
  return true;
}
```

### 5. Organisation Role Consistency
```javascript
// Ensure user has appropriate permissions for organisation role
function validateOrganisationRole(role, permissions) {
  const rolePermissions = {
    member: ["view", "purchase_for_self"],
    secretary: ["view", "purchase_for_org", "manage_members"],
    admin: ["view", "purchase_for_org", "manage_members", "manage_settings"],
    owner: ["*"]
  };
  
  const allowedPermissions = rolePermissions[role] || [];
  
  if (allowedPermissions.includes("*")) return true;
  
  return permissions.every(p => allowedPermissions.includes(p));
}
```

## Business Rules

1. **Email Format**: Must be valid email address, stored lowercase
2. **Password Policy**: Minimum 8 chars, mixed case, number, special char
3. **Account Lockout**: Lock after 5 failed attempts for 30 minutes
4. **Session Management**: Max 5 concurrent sessions, 7-day expiry
5. **Age Requirement**: Must be 18+ for account creation
6. **Phone Verification**: Required for MFA and high-value transactions
7. **Address Validation**: At least one verified address for shipping
8. **Payment Methods**: Max 10 stored payment methods
9. **Data Retention**: Soft delete with 30-day recovery period
10. **GDPR Compliance**: Must accept terms, can request data export

## Pre-save Validation Hook

```javascript
// Example pre-save validation in application
async function validateUser(user, isNew = false) {
  // Email uniqueness
  if (isNew || user.auth.email !== user._original?.auth.email) {
    const emailUnique = await validateEmailUniqueness(user.auth.email, user._id);
    if (!emailUnique) {
      throw new Error('Email already exists');
    }
  }
  
  // Age verification for new users
  if (isNew && user.profile.dateOfBirth) {
    if (!validateAge(user.profile.dateOfBirth)) {
      throw new Error('User must be 18 or older');
    }
  }
  
  // Organisation role validation
  if (user.access?.organisations) {
    for (const org of user.access.organisations) {
      if (!validateOrganisationRole(org.role, org.permissions || [])) {
        throw new Error('Invalid permissions for organisation role');
      }
    }
  }
  
  // At least one primary address
  if (user.profile.addresses?.length > 0) {
    const hasPrimary = user.profile.addresses.some(a => a.primary);
    if (!hasPrimary) {
      user.profile.addresses[0].primary = true;
    }
  }
  
  // At least one primary phone
  if (user.profile.phones?.length > 0) {
    const hasPrimary = user.profile.phones.some(p => p.primary);
    if (!hasPrimary) {
      user.profile.phones[0].primary = true;
    }
  }
  
  // Default flags for new users
  if (isNew) {
    user.flags = {
      isActive: true,
      isVerified: false,
      isVip: false,
      isBanned: false,
      isDeleted: false,
      betaFeatures: [],
      experimentGroups: []
    };
  }
  
  return true;
}
```

## Security Validations

1. **Password Hashing**: Use bcrypt with cost factor 12+
2. **Session Security**: Validate IP changes, user agent
3. **MFA Enforcement**: Required for admin roles
4. **OAuth Validation**: Verify provider tokens
5. **Rate Limiting**: Track login attempts per IP
6. **Data Encryption**: Encrypt PII and financial data