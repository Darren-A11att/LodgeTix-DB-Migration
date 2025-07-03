# Organisations Collection Schema

## Overview
The organisations collection represents groups such as Masonic lodges, companies, associations, and other entities that can register for events, manage members, and make bulk purchases.

## Document Structure

```javascript
{
  _id: ObjectId,
  organisationId: String,         // Unique identifier (e.g., "ORG-123456")
  
  // Basic Information
  profile: {
    name: String,                 // Official organisation name
    displayName: String,          // Short/display name
    type: String,                 // Organisation type
    
    // Identification
    registration: {
      number: String,             // Registration/lodge number
      registeredName: String,     // Legal registered name
      abn: String,                // Australian Business Number
      acn: String,                // Australian Company Number
      taxId: String,              // Other tax identifier
      gstRegistered: Boolean,
      charityStatus: Boolean,
      charityNumber: String
    },
    
    // Contact Information
    contact: {
      primary: {
        name: String,
        role: String,             // "Secretary", "President", etc.
        email: String,
        phone: String
      },
      
      // Additional contacts
      billing: {
        name: String,
        email: String,
        phone: String
      },
      
      events: {
        name: String,
        email: String,
        phone: String
      },
      
      // General enquiries
      general: {
        email: String,
        phone: String,
        website: String,
        socialMedia: {
          facebook: String,
          twitter: String,
          linkedin: String,
          instagram: String
        }
      }
    },
    
    // Addresses
    addresses: {
      physical: {
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postcode: String,
        country: String,
        
        // Venue details
        venue: {
          name: String,           // Building/venue name
          capacity: Number,
          facilities: [String],   // "parking", "wheelchair", "catering"
          directions: String
        }
      },
      
      postal: {
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postcode: String,
        country: String
      },
      
      billing: {
        sameAsPostal: Boolean,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postcode: String,
        country: String
      }
    },
    
    // Organisation details
    details: {
      founded: Date,
      description: String,
      mission: String,
      
      // For lodges
      lodge: {
        district: String,
        grandLodge: String,
        meetingSchedule: String,  // "First Tuesday of month"
        meetingTime: String,      // "19:30"
        dresscode: String
      },
      
      // Size and structure
      size: {
        memberCount: Number,
        activeMembers: Number,
        category: String          // "small", "medium", "large"
      }
    }
  },
  
  // Membership Management
  membership: {
    // Member tracking
    members: [{
      userId: ObjectId,           // Reference to users collection
      memberNumber: String,       // Internal member number
      role: String,               // Role in organisation
      title: String,              // Honorary title
      
      status: String,             // "active", "suspended", "resigned"
      joinedAt: Date,
      
      // Permissions within org
      permissions: [String],      // Organisation-specific permissions
      
      // Membership details
      membershipType: String,     // "full", "associate", "honorary"
      dues: {
        amount: Decimal128,
        frequency: String,        // "annual", "quarterly"
        paidUntil: Date,
        autoRenew: Boolean
      }
    }],
    
    // Office bearers
    officers: [{
      position: String,           // "Master", "Secretary", "Treasurer"
      userId: ObjectId,
      name: String,               // Denormalized
      startDate: Date,
      endDate: Date,
      current: Boolean,
      
      // Contact override
      contact: {
        email: String,
        phone: String
      }
    }],
    
    // Membership rules
    rules: {
      approvalRequired: Boolean,
      approvalQuorum: Number,
      votingRights: {
        minimumTenure: Number,    // Days
        requiresDuesPaid: Boolean
      },
      
      // Eligibility
      eligibility: {
        minAge: Number,
        maxAge: Number,
        gender: [String],
        requiresInvitation: Boolean,
        requiresSponsor: Boolean,
        otherRequirements: [String]
      }
    }
  },
  
  // Financial Information
  financial: {
    // Banking details
    banking: {
      accountName: String,
      bsb: String,                // Encrypted
      accountNumber: String,      // Encrypted
      bankName: String,
      
      // Payment preferences
      preferredMethod: String,    // "invoice", "direct_debit"
      terms: String,              // "net30", "immediate"
    },
    
    // Credit and limits
    credit: {
      limit: Decimal128,
      used: Decimal128,
      available: Decimal128,
      
      // Credit history
      rating: String,             // "excellent", "good", "fair"
      lastReview: Date,
      
      // Payment history
      onTimePayments: Number,
      latePayments: Number,
      averageDaysToPayment: Number
    },
    
    // Invoicing
    invoicing: {
      consolidated: Boolean,      // Single invoice for all purchases
      frequency: String,          // "immediate", "weekly", "monthly"
      format: String,             // "pdf", "electronic"
      
      // Special instructions
      purchaseOrderRequired: Boolean,
      costCenters: [{
        code: String,
        name: String,
        approver: ObjectId
      }]
    },
    
    // Tax settings
    tax: {
      exemptStatus: Boolean,
      exemptionCertificate: {
        number: String,
        expiryDate: Date,
        documentUrl: String
      }
    }
  },
  
  // Event Participation
  events: {
    // Registration defaults
    defaults: {
      registrationType: String,   // "lodge", "delegation"
      paymentMethod: String,
      
      // Bulk booking preferences
      bulkBooking: {
        minimumAttendees: Number,
        defaultAllocation: Number,
        autoAssignMembers: Boolean
      },
      
      // Seating preferences
      seating: {
        preferTogether: Boolean,
        specialRequirements: [String],
        vipMembers: [ObjectId]    // Members requiring special seating
      }
    },
    
    // Historical participation
    history: {
      eventsAttended: Number,
      totalAttendees: Number,
      totalSpent: Decimal128,
      
      lastEventDate: Date,
      favoriteEvents: [String],   // Event types frequently attended
      
      // Hosting history
      eventsHosted: [{
        eventId: String,
        date: Date,
        type: String,
        attendance: Number
      }]
    },
    
    // Special arrangements
    arrangements: {
      cateringPreferences: {
        provider: String,
        restrictions: [String],
        notes: String
      },
      
      transportArrangements: {
        required: Boolean,
        details: String
      },
      
      accommodationPreferences: {
        preferredHotels: [String],
        roomTypes: [String],
        specialNeeds: [String]
      }
    }
  },
  
  // Jurisdiction Reference (for Masonic organisations)
  jurisdictionId: ObjectId,       // Reference to jurisdictions collection
  
  // Relationships
  relationships: {
    // Parent/child organisations
    parent: {
      organisationId: ObjectId,
      name: String,
      type: String                // "grand_lodge", "parent_company"
    },
    
    children: [{
      organisationId: ObjectId,
      name: String,
      type: String                // "lodge", "subsidiary"
    }],
    
    // Affiliations
    affiliations: [{
      organisationId: ObjectId,
      name: String,
      type: String,               // "sister", "partner", "sponsor"
      startDate: Date,
      endDate: Date,
      current: Boolean
    }],
    
    // Reciprocal arrangements
    reciprocal: [{
      organisationId: ObjectId,
      name: String,
      benefits: [String],         // Benefits provided
      validUntil: Date
    }]
  },
  
  // Documents and Compliance
  documents: {
    // Required documents
    constitution: {
      uploaded: Boolean,
      uploadedAt: Date,
      documentUrl: String,
      version: String
    },
    
    insurance: {
      publicLiability: {
        insurer: String,
        policyNumber: String,
        coverAmount: Decimal128,
        expiryDate: Date,
        documentUrl: String
      },
      
      professionalIndemnity: {
        insurer: String,
        policyNumber: String,
        coverAmount: Decimal128,
        expiryDate: Date,
        documentUrl: String
      }
    },
    
    // Compliance documents
    compliance: [{
      type: String,               // "annual_return", "audit_report"
      year: Number,
      submittedAt: Date,
      documentUrl: String,
      status: String              // "pending", "approved", "rejected"
    }],
    
    // Agreements
    agreements: [{
      type: String,               // "venue_hire", "catering", "sponsorship"
      party: String,
      startDate: Date,
      endDate: Date,
      documentUrl: String,
      autoRenew: Boolean
    }]
  },
  
  // Communication Preferences
  communications: {
    // Notification settings
    notifications: {
      newEvents: {
        enabled: Boolean,
        channels: [String],       // "email", "sms", "post"
        recipients: [String]      // Role-based: "secretary", "events"
      },
      
      reminders: {
        enabled: Boolean,
        daysBefore: [Number],     // [30, 14, 7, 1]
        channels: [String]
      },
      
      announcements: {
        enabled: Boolean,
        channels: [String],
        allMembers: Boolean       // Send to all members
      }
    },
    
    // Bulk communication rules
    bulkCommunication: {
      requireApproval: Boolean,
      approvers: [ObjectId],      // Users who can approve
      
      blackoutDates: [{
        startDate: Date,
        endDate: Date,
        reason: String
      }]
    }
  },
  
  // Settings and Preferences
  settings: {
    // Privacy settings
    privacy: {
      listPublicly: Boolean,
      showMemberCount: Boolean,
      allowMemberDirectory: Boolean,
      shareContactDetails: Boolean
    },
    
    // Feature toggles
    features: {
      onlineVoting: Boolean,
      memberPortal: Boolean,
      eventHosting: Boolean,
      fundraising: Boolean
    },
    
    // Branding
    branding: {
      logo: {
        url: String,
        uploadedAt: Date
      },
      colors: {
        primary: String,
        secondary: String
      },
      customDomain: String
    }
  },
  
  // Status and Metadata
  status: String,                 // "active", "suspended", "dissolved"
  
  verification: {
    verified: Boolean,
    verifiedAt: Date,
    verifiedBy: ObjectId,
    
    // Verification documents
    documents: [{
      type: String,
      status: String,
      notes: String
    }]
  },
  
  // System metadata
  metadata: {
    source: String,               // "registration", "import", "admin"
    tags: [String],               // Custom tags for categorization
    
    createdAt: Date,
    createdBy: ObjectId,
    updatedAt: Date,
    updatedBy: ObjectId,
    
    // Import tracking
    importBatchId: String,
    legacyId: String,             // ID from old system
    migrationNotes: String
  }
}
```

## Field Constraints

### Required Fields
- `organisationId` - Unique identifier
- `profile.name` - Official organisation name
- `profile.type` - Organisation type
- `profile.contact.primary` - Primary contact required
- `status` - Current status

### Enumerations

**Organisation Types:**
- `lodge` - Masonic lodge
- `company` - Corporate entity
- `association` - Member association
- `charity` - Charitable organisation
- `government` - Government body
- `educational` - School/university
- `other` - Other type

**Member Status:**
- `active` - Active member
- `suspended` - Temporarily suspended
- `resigned` - Voluntarily left
- `expelled` - Removed from organisation
- `deceased` - Passed away

**Organisation Status:**
- `active` - Operating normally
- `suspended` - Temporarily inactive
- `dissolved` - No longer operating
- `pending` - Awaiting verification

## Indexes
- `organisationId` - Unique index
- `profile.registration.abn` - Unique sparse index
- `profile.type, status` - Type filtering
- `membership.members.userId` - Member lookups
- `profile.registration.number` - Registration number lookup
- `metadata.createdAt` - Date queries

## Relationships
- **Users** - Members via `membership.members.userId`
- **Registrations** - Organisation makes registrations
- **Financial Transactions** - Organisation financial history

## Security Considerations

### Sensitive Data
- `financial.banking` - Must be encrypted
- `profile.registration.taxId` - Requires encryption
- `documents` - Access control required
- Member personal data - Privacy controls

### Access Control
- Officers have elevated permissions
- Financial data restricted to authorized roles
- Member list visibility controls
- Document access logging required

## Business Logic

### Membership Management
1. New members require approval if configured
2. Voting rights based on tenure and dues
3. Officer positions have term limits
4. Automatic dues reminders

### Financial Controls
1. Credit limits enforced on purchases
2. Purchase orders required if configured
3. Consolidated invoicing for bulk purchases
4. Tax exemption validation

### Event Registration
1. Bulk allocation for group bookings
2. Member pre-assignment for events
3. Seating arrangements maintained
4. Group discounts applied automatically