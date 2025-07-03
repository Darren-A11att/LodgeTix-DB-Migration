# Users Collection - Aggregation Pipelines

## Contact Integration

### 1. Get User with Contact Details
```javascript
// Fetch user with full contact information
db.users.aggregate([
  { $match: { _id: ObjectId("userId") } },
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "_id",
      as: "contact"
    }
  },
  { $unwind: "$contact" },
  {
    $project: {
      userId: 1,
      email: "$auth.email",
      displayName: "$profile.displayName",
      roles: "$access.roles",
      // Contact details
      name: { $concat: ["$contact.profile.firstName", " ", "$contact.profile.lastName"] },
      phone: "$contact.profile.phone",
      addresses: "$contact.addresses",
      dietaryRequirements: "$contact.profile.dietaryRequirements",
      specialNeeds: "$contact.profile.specialNeeds",
      masonicProfile: "$contact.masonicProfile"
    }
  }
])
```

### 2. Find Users Without Contacts
```javascript
// Identify users that need contact records created
db.users.aggregate([
  {
    $match: {
      $or: [
        { contactId: { $exists: false } },
        { contactId: null }
      ]
    }
  },
  {
    $project: {
      userId: 1,
      email: "$auth.email",
      createdAt: "$metadata.createdAt",
      lastLogin: "$auth.lastLoginAt",
      isActive: "$flags.isActive"
    }
  },
  { $sort: { createdAt: -1 } }
])
```

### 3. Users and Contact Relationships
```javascript
// Find users with their emergency contacts
db.users.aggregate([
  { $match: { "flags.isActive": true } },
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "_id",
      as: "contact"
    }
  },
  { $unwind: "$contact" },
  { $unwind: { path: "$contact.relationships", preserveNullAndEmptyArrays: true } },
  { $match: { "contact.relationships.isEmergencyContact": true } },
  {
    $lookup: {
      from: "contacts",
      localField: "contact.relationships.contactId",
      foreignField: "_id",
      as: "emergencyContact"
    }
  },
  { $unwind: "$emergencyContact" },
  {
    $group: {
      _id: "$_id",
      userId: { $first: "$userId" },
      userName: { $first: { $concat: ["$contact.profile.firstName", " ", "$contact.profile.lastName"] } },
      emergencyContacts: {
        $push: {
          name: { $concat: ["$emergencyContact.profile.firstName", " ", "$emergencyContact.profile.lastName"] },
          phone: "$emergencyContact.profile.phone",
          relationship: "$contact.relationships.relationshipType"
        }
      }
    }
  }
])
```

## User Analytics

### 4. User Growth Analysis
```javascript
// Track user acquisition over time
db.users.aggregate([
  {
    $match: {
      "flags.isDeleted": false
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$metadata.createdAt" },
        month: { $month: "$metadata.createdAt" },
        source: "$metadata.source"
      },
      newUsers: { $sum: 1 },
      verified: {
        $sum: { $cond: ["$auth.emailVerified", 1, 0] }
      },
      withPurchases: {
        $sum: { $cond: [{ $gt: ["$activity.registrations.count", 0] }, 1, 0] }
      },
      campaigns: {
        $addToSet: "$metadata.campaign"
      }
    }
  },
  {
    $group: {
      _id: {
        year: "$_id.year",
        month: "$_id.month"
      },
      totalNewUsers: { $sum: "$newUsers" },
      bySource: {
        $push: {
          source: "$_id.source",
          count: "$newUsers",
          verificationRate: {
            $multiply: [
              { $divide: ["$verified", "$newUsers"] },
              100
            ]
          },
          conversionRate: {
            $multiply: [
              { $divide: ["$withPurchases", "$newUsers"] },
              100
            ]
          }
        }
      },
      campaigns: {
        $reduce: {
          input: "$campaigns",
          initialValue: [],
          in: { $concatArrays: ["$$value", "$$this"] }
        }
      }
    }
  },
  {
    $project: {
      date: {
        $dateFromParts: {
          year: "$_id.year",
          month: "$_id.month"
        }
      },
      metrics: {
        totalNewUsers: "$totalNewUsers",
        sources: "$bySource",
        activeCampaigns: { $size: { $setUnion: "$campaigns" } }
      },
      growth: {
        $let: {
          vars: {
            prevMonth: {
              $dateFromParts: {
                year: "$_id.year",
                month: { $subtract: ["$_id.month", 1] }
              }
            }
          },
          in: "calculated_separately" // Would need separate query for month-over-month
        }
      }
    }
  },
  {
    $sort: { date: -1 }
  }
])
```

### 2. Customer Lifetime Value (CLV)
```javascript
// Calculate CLV by cohort
db.users.aggregate([
  {
    $match: {
      "activity.registrations.count": { $gt: 0 }
    }
  },
  {
    $project: {
      userId: 1,
      cohort: {
        $dateToString: {
          format: "%Y-%m",
          date: "$metadata.createdAt"
        }
      },
      accountAge: {
        $divide: [
          { $subtract: [new Date(), "$metadata.createdAt"] },
          1000 * 60 * 60 * 24 * 30 // Months
        ]
      },
      revenue: "$activity.registrations.totalSpent",
      purchaseCount: "$activity.registrations.count",
      lastPurchase: "$activity.registrations.lastDate",
      
      // Engagement metrics
      loginFrequency: {
        $divide: ["$activity.engagement.loginCount", "$accountAge"]
      },
      isActive: {
        $gt: [
          "$activity.engagement.lastActiveAt",
          { $subtract: [new Date(), 30 * 24 * 60 * 60 * 1000] }
        ]
      }
    }
  },
  {
    $group: {
      _id: "$cohort",
      users: { $sum: 1 },
      totalRevenue: { $sum: "$revenue" },
      avgRevenue: { $avg: "$revenue" },
      avgPurchases: { $avg: "$purchaseCount" },
      
      // Retention metrics
      activeUsers: {
        $sum: { $cond: ["$isActive", 1, 0] }
      },
      
      // Revenue distribution
      revenueSegments: {
        $push: {
          $switch: {
            branches: [
              { case: { $gte: ["$revenue", 5000] }, then: "whale" },
              { case: { $gte: ["$revenue", 1000] }, then: "high_value" },
              { case: { $gte: ["$revenue", 100] }, then: "regular" },
              { case: { $gt: ["$revenue", 0] }, then: "low_value" }
            ],
            default: "inactive"
          }
        }
      }
    }
  },
  {
    $project: {
      cohort: "$_id",
      metrics: {
        userCount: "$users",
        totalRevenue: "$totalRevenue",
        avgCLV: { $round: ["$avgRevenue", 2] },
        avgOrderCount: { $round: ["$avgPurchases", 1] },
        retentionRate: {
          $multiply: [
            { $divide: ["$activeUsers", "$users"] },
            100
          ]
        }
      },
      segments: {
        $arrayToObject: {
          $map: {
            input: { $setUnion: "$revenueSegments" },
            as: "segment",
            in: {
              k: "$$segment",
              v: {
                $size: {
                  $filter: {
                    input: "$revenueSegments",
                    cond: { $eq: ["$$this", "$$segment"] }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  {
    $sort: { cohort: -1 }
  }
])
```

## Authentication and Security

### 3. Login Pattern Analysis
```javascript
// Analyze login patterns and suspicious activity
db.users.aggregate([
  {
    $match: {
      "auth.lastLoginAt": {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    }
  },
  {
    $project: {
      userId: 1,
      email: "$auth.email",
      loginAttempts: "$auth.loginAttempts",
      isLocked: { $gt: ["$auth.lockedUntil", new Date()] },
      
      // Session analysis
      sessionCount: { $size: { $ifNull: ["$auth.sessions", []] } },
      activeSessionCount: {
        $size: {
          $filter: {
            input: { $ifNull: ["$auth.sessions", []] },
            cond: {
              $and: [
                { $eq: ["$$this.revoked", false] },
                { $gt: ["$$this.expiresAt", new Date()] }
              ]
            }
          }
        }
      },
      
      // Location diversity
      uniqueCountries: {
        $size: {
          $setUnion: {
            $map: {
              input: { $ifNull: ["$auth.sessions", []] },
              in: "$$this.location.country"
            }
          }
        }
      },
      
      // MFA status
      mfaEnabled: "$auth.mfa.enabled",
      
      // Risk indicators
      recentPasswordChange: {
        $gt: [
          "$auth.passwordChangedAt",
          { $subtract: [new Date(), 24 * 60 * 60 * 1000] }
        ]
      }
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      securityStatus: {
        loginAttempts: "$loginAttempts",
        isLocked: "$isLocked",
        mfaEnabled: "$mfaEnabled",
        activeSessions: "$activeSessionCount"
      },
      riskScore: {
        $add: [
          { $cond: [{ $gte: ["$loginAttempts", 3] }, 20, 0] },
          { $cond: [{ $gte: ["$uniqueCountries", 3] }, 30, 0] },
          { $cond: ["$recentPasswordChange", 10, 0] },
          { $cond: [{ $gte: ["$sessionCount", 10] }, 20, 0] },
          { $cond: [{ $eq: ["$mfaEnabled", false] }, 20, 0] }
        ]
      }
    }
  },
  {
    $match: {
      riskScore: { $gte: 30 }
    }
  },
  {
    $sort: { riskScore: -1 }
  }
])
```

### 4. Failed Login Report
```javascript
// Track failed login attempts by IP and user
db.users.aggregate([
  {
    $match: {
      "auth.loginAttempts": { $gt: 0 }
    }
  },
  {
    $group: {
      _id: "$auth.lastLoginIp",
      attemptedUsers: {
        $push: {
          userId: "$userId",
          email: "$auth.email",
          attempts: "$auth.loginAttempts",
          isLocked: { $gt: ["$auth.lockedUntil", new Date()] }
        }
      },
      totalAttempts: { $sum: "$auth.loginAttempts" },
      lockedAccounts: {
        $sum: {
          $cond: [{ $gt: ["$auth.lockedUntil", new Date()] }, 1, 0]
        }
      }
    }
  },
  {
    $match: {
      $or: [
        { totalAttempts: { $gte: 10 } },
        { lockedAccounts: { $gte: 2 } }
      ]
    }
  },
  {
    $project: {
      ipAddress: "$_id",
      threat: {
        totalAttempts: "$totalAttempts",
        uniqueTargets: { $size: "$attemptedUsers" },
        lockedAccounts: "$lockedAccounts",
        isDistributed: { $gte: [{ $size: "$attemptedUsers" }, 5] }
      },
      topTargets: {
        $slice: [
          {
            $sortArray: {
              input: "$attemptedUsers",
              sortBy: { attempts: -1 }
            }
          },
          5
        ]
      }
    }
  },
  {
    $sort: { "threat.totalAttempts": -1 }
  }
])
```

## Customer Segmentation

### 5. VIP Customer Identification
```javascript
// Identify and segment high-value customers
db.users.aggregate([
  {
    $match: {
      "flags.isActive": true,
      "activity.registrations.count": { $gt: 0 }
    }
  },
  {
    $project: {
      userId: 1,
      profile: {
        name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
        email: "$auth.email"
      },
      
      // Value metrics
      totalSpent: "$activity.registrations.totalSpent",
      orderCount: "$activity.registrations.count",
      avgOrderValue: {
        $divide: ["$activity.registrations.totalSpent", "$activity.registrations.count"]
      },
      
      // Recency
      daysSinceLastOrder: {
        $divide: [
          { $subtract: [new Date(), "$activity.registrations.lastDate"] },
          1000 * 60 * 60 * 24
        ]
      },
      
      // Engagement
      loyaltyTier: "$financial.loyaltyPoints.tier",
      loyaltyPoints: "$financial.loyaltyPoints.balance",
      
      // Account features
      hasPaymentMethod: { $gt: [{ $size: { $ifNull: ["$financial.paymentMethods", []] } }, 0] },
      isOrganisation: { $gt: [{ $size: { $ifNull: ["$access.organisations", []] } }, 0] }
    }
  },
  {
    $project: {
      userId: 1,
      profile: 1,
      metrics: {
        totalSpent: "$totalSpent",
        orderCount: "$orderCount",
        avgOrderValue: { $round: ["$avgOrderValue", 2] },
        recencyDays: { $round: ["$daysSinceLastOrder", 0] }
      },
      
      // VIP Score calculation
      vipScore: {
        $add: [
          // Spending score (max 40 points)
          {
            $min: [
              40,
              { $multiply: [{ $divide: ["$totalSpent", 1000] }, 4] }
            ]
          },
          // Frequency score (max 30 points)
          {
            $min: [
              30,
              { $multiply: ["$orderCount", 2] }
            ]
          },
          // Recency score (max 20 points)
          {
            $switch: {
              branches: [
                { case: { $lte: ["$daysSinceLastOrder", 30] }, then: 20 },
                { case: { $lte: ["$daysSinceLastOrder", 90] }, then: 10 },
                { case: { $lte: ["$daysSinceLastOrder", 180] }, then: 5 }
              ],
              default: 0
            }
          },
          // Loyalty bonus (max 10 points)
          {
            $switch: {
              branches: [
                { case: { $eq: ["$loyaltyTier", "platinum"] }, then: 10 },
                { case: { $eq: ["$loyaltyTier", "gold"] }, then: 7 },
                { case: { $eq: ["$loyaltyTier", "silver"] }, then: 4 },
                { case: { $eq: ["$loyaltyTier", "bronze"] }, then: 2 }
              ],
              default: 0
            }
          }
        ]
      },
      
      features: {
        loyaltyTier: "$loyaltyTier",
        hasPaymentMethod: "$hasPaymentMethod",
        isOrganisation: "$isOrganisation"
      }
    }
  },
  {
    $project: {
      userId: 1,
      profile: 1,
      metrics: 1,
      features: 1,
      vipScore: 1,
      segment: {
        $switch: {
          branches: [
            { case: { $gte: ["$vipScore", 80] }, then: "platinum_vip" },
            { case: { $gte: ["$vipScore", 60] }, then: "gold_vip" },
            { case: { $gte: ["$vipScore", 40] }, then: "silver_vip" },
            { case: { $gte: ["$vipScore", 20] }, then: "bronze_vip" }
          ],
          default: "regular"
        }
      }
    }
  },
  {
    $match: {
      vipScore: { $gte: 40 }
    }
  },
  {
    $sort: { vipScore: -1 }
  },
  {
    $limit: 1000
  }
])
```

### 6. Churn Risk Analysis
```javascript
// Identify users at risk of churning
db.users.aggregate([
  {
    $match: {
      "flags.isActive": true,
      "activity.registrations.count": { $gt: 0 }
    }
  },
  {
    $project: {
      userId: 1,
      email: "$auth.email",
      
      // Activity metrics
      daysSinceLastLogin: {
        $divide: [
          { $subtract: [new Date(), "$activity.engagement.lastActiveAt"] },
          1000 * 60 * 60 * 24
        ]
      },
      daysSinceLastPurchase: {
        $divide: [
          { $subtract: [new Date(), "$activity.registrations.lastDate"] },
          1000 * 60 * 60 * 24
        ]
      },
      
      // Historical behavior
      avgDaysBetweenPurchases: {
        $divide: [
          {
            $divide: [
              { $subtract: ["$activity.registrations.lastDate", "$activity.registrations.firstDate"] },
              1000 * 60 * 60 * 24
            ]
          },
          { $max: [{ $subtract: ["$activity.registrations.count", 1] }, 1] }
        ]
      },
      
      // Engagement decline
      recentLoginCount: {
        $size: {
          $filter: {
            input: { $ifNull: ["$auth.sessions", []] },
            cond: {
              $gte: [
                "$$this.createdAt",
                { $subtract: [new Date(), 30 * 24 * 60 * 60 * 1000] }
              ]
            }
          }
        }
      },
      
      // Communication preferences
      unsubscribed: {
        $not: "$preferences.communications.marketing.email"
      }
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      metrics: {
        daysSinceLastLogin: { $round: ["$daysSinceLastLogin", 0] },
        daysSinceLastPurchase: { $round: ["$daysSinceLastPurchase", 0] },
        expectedPurchaseIn: {
          $subtract: [
            "$avgDaysBetweenPurchases",
            "$daysSinceLastPurchase"
          ]
        }
      },
      
      // Churn risk score
      churnRisk: {
        $add: [
          // Inactivity score
          {
            $cond: [
              { $gte: ["$daysSinceLastLogin", 90] },
              40,
              {
                $cond: [
                  { $gte: ["$daysSinceLastLogin", 60] },
                  20,
                  0
                ]
              }
            ]
          },
          // Purchase delay score
          {
            $cond: [
              { $gt: ["$daysSinceLastPurchase", { $multiply: ["$avgDaysBetweenPurchases", 2] }] },
              30,
              0
            ]
          },
          // Engagement decline
          {
            $cond: [{ $eq: ["$recentLoginCount", 0] }, 20, 0]
          },
          // Unsubscribed
          { $cond: ["$unsubscribed", 10, 0] }
        ]
      }
    }
  },
  {
    $match: {
      churnRisk: { $gte: 30 }
    }
  },
  {
    $sort: { churnRisk: -1 }
  }
])
```

## Organisation Analytics

### 7. Organisation Member Analysis
```javascript
// Analyze organisation membership and activity
db.users.aggregate([
  {
    $match: {
      "access.organisations": { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$access.organisations" },
  {
    $match: {
      "access.organisations.status": "active"
    }
  },
  {
    $group: {
      _id: "$access.organisations.organisationId",
      members: {
        $push: {
          userId: "$_id",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          email: "$auth.email",
          role: "$access.organisations.role",
          joinedAt: "$access.organisations.joinedAt",
          totalSpent: "$activity.registrations.totalSpent"
        }
      },
      roleDistribution: {
        $push: "$access.organisations.role"
      }
    }
  },
  {
    $lookup: {
      from: "organisations",
      localField: "_id",
      foreignField: "_id",
      as: "organisation"
    }
  },
  {
    $unwind: "$organisation"
  },
  {
    $project: {
      organisation: {
        id: "$_id",
        name: "$organisation.name",
        type: "$organisation.type"
      },
      metrics: {
        totalMembers: { $size: "$members" },
        totalRevenue: { $sum: "$members.totalSpent" },
        avgMemberValue: { $avg: "$members.totalSpent" },
        roles: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$roleDistribution" },
              as: "role",
              in: {
                k: "$$role",
                v: {
                  $size: {
                    $filter: {
                      input: "$roleDistribution",
                      cond: { $eq: ["$$this", "$$role"] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      topSpenders: {
        $slice: [
          {
            $sortArray: {
              input: "$members",
              sortBy: { totalSpent: -1 }
            }
          },
          5
        ]
      }
    }
  },
  {
    $sort: { "metrics.totalRevenue": -1 }
  }
])
```

## Communication and Marketing

### 8. Email Campaign Segmentation
```javascript
// Segment users for targeted email campaigns
db.users.aggregate([
  {
    $match: {
      "flags.isActive": true,
      "preferences.communications.marketing.email": true
    }
  },
  {
    $project: {
      email: "$auth.email",
      profile: {
        firstName: "$profile.firstName",
        locale: "$profile.locale",
        timezone: "$profile.timezone"
      },
      
      // Segmentation criteria
      segment: {
        $switch: {
          branches: [
            // New users
            {
              case: {
                $and: [
                  { $lte: [
                    { $subtract: [new Date(), "$metadata.createdAt"] },
                    30 * 24 * 60 * 60 * 1000
                  ]},
                  { $eq: ["$activity.registrations.count", 0] }
                ]
              },
              then: "new_no_purchase"
            },
            // Active buyers
            {
              case: {
                $and: [
                  { $gte: ["$activity.registrations.count", 3] },
                  { $lte: [
                    { $subtract: [new Date(), "$activity.registrations.lastDate"] },
                    90 * 24 * 60 * 60 * 1000
                  ]}
                ]
              },
              then: "active_buyer"
            },
            // Lapsed customers
            {
              case: {
                $and: [
                  { $gt: ["$activity.registrations.count", 0] },
                  { $gt: [
                    { $subtract: [new Date(), "$activity.registrations.lastDate"] },
                    180 * 24 * 60 * 60 * 1000
                  ]}
                ]
              },
              then: "lapsed_customer"
            },
            // Event category interest
            {
              case: {
                $gt: [
                  { $size: { $ifNull: ["$preferences.events.categories", []] } },
                  0
                ]
              },
              then: "interested_subscriber"
            }
          ],
          default: "general"
        }
      },
      
      // Personalization data
      interests: "$preferences.events.categories",
      lastEventTypes: {
        $slice: ["$activity.engagement.searchQueries", -5]
      }
    }
  },
  {
    $group: {
      _id: "$segment",
      recipients: {
        $push: {
          email: "$email",
          firstName: "$profile.firstName",
          locale: "$profile.locale",
          timezone: "$profile.timezone",
          interests: "$interests"
        }
      },
      count: { $sum: 1 }
    }
  },
  {
    $project: {
      segment: "$_id",
      audienceSize: "$count",
      sample: { $slice: ["$recipients", 10] },
      
      // Timezone distribution for send time optimization
      timezones: {
        $arrayToObject: {
          $map: {
            input: { $setUnion: "$recipients.timezone" },
            as: "tz",
            in: {
              k: "$$tz",
              v: {
                $size: {
                  $filter: {
                    input: "$recipients",
                    cond: { $eq: ["$$this.timezone", "$$tz"] }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
])
```

## Data Quality and Compliance

### 9. Data Validation Report
```javascript
// Identify users with incomplete or invalid data
db.users.aggregate([
  {
    $match: {
      "flags.isActive": true
    }
  },
  {
    $project: {
      userId: 1,
      email: "$auth.email",
      
      // Data completeness checks
      issues: {
        missingPhone: { $eq: [{ $size: { $ifNull: ["$profile.phones", []] } }, 0] },
        missingAddress: { $eq: [{ $size: { $ifNull: ["$profile.addresses", []] } }, 0] },
        unverifiedEmail: { $not: "$auth.emailVerified" },
        missingDateOfBirth: { $eq: ["$profile.dateOfBirth", null] },
        
        // Age verification for events
        needsAgeVerification: {
          $and: [
            { $eq: ["$compliance.ageVerified", false] },
            { $gt: ["$activity.registrations.count", 0] }
          ]
        },
        
        // Payment method validation
        expiredPaymentMethods: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$financial.paymentMethods", []] },
                  cond: {
                    $and: [
                      { $eq: ["$$this.type", "card"] },
                      {
                        $lte: [
                          {
                            $dateFromParts: {
                              year: "$$this.card.expiryYear",
                              month: "$$this.card.expiryMonth"
                            }
                          },
                          new Date()
                        ]
                      }
                    ]
                  }
                }
              }
            },
            0
          ]
        },
        
        // GDPR compliance
        missingGDPRConsent: {
          $and: [
            { $ne: ["$profile.addresses.country", "US"] },
            { $ne: ["$compliance.gdpr.consentGiven", true] }
          ]
        }
      }
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      issueCount: {
        $add: [
          { $cond: ["$issues.missingPhone", 1, 0] },
          { $cond: ["$issues.missingAddress", 1, 0] },
          { $cond: ["$issues.unverifiedEmail", 1, 0] },
          { $cond: ["$issues.missingDateOfBirth", 1, 0] },
          { $cond: ["$issues.needsAgeVerification", 1, 0] },
          { $cond: ["$issues.expiredPaymentMethods", 1, 0] },
          { $cond: ["$issues.missingGDPRConsent", 1, 0] }
        ]
      },
      criticalIssues: {
        $filter: {
          input: [
            { $cond: ["$issues.unverifiedEmail", "unverified_email", null] },
            { $cond: ["$issues.needsAgeVerification", "needs_age_verification", null] },
            { $cond: ["$issues.expiredPaymentMethods", "expired_payment_methods", null] },
            { $cond: ["$issues.missingGDPRConsent", "missing_gdpr_consent", null] }
          ],
          cond: { $ne: ["$$this", null] }
        }
      }
    }
  },
  {
    $match: {
      issueCount: { $gt: 0 }
    }
  },
  {
    $sort: { issueCount: -1 }
  }
])
```

### 10. GDPR Data Export Request
```javascript
// Compile all user data for GDPR export
db.users.aggregate([
  {
    $match: {
      _id: ObjectId("user_id_here")
    }
  },
  {
    $lookup: {
      from: "registrations",
      localField: "_id",
      foreignField: "purchase.purchasedBy.id",
      as: "registrations"
    }
  },
  {
    $lookup: {
      from: "attendees",
      let: { userId: "$_id" },
      pipeline: [
        {
          $lookup: {
            from: "registrations",
            localField: "registrationId",
            foreignField: "_id",
            as: "registration"
          }
        },
        {
          $match: {
            $expr: {
              $eq: [{ $first: "$registration.purchase.purchasedBy.id" }, "$$userId"]
            }
          }
        }
      ],
      as: "attendees"
    }
  },
  {
    $lookup: {
      from: "financial-transactions",
      localField: "_id",
      foreignField: "parties.customer.id",
      as: "transactions"
    }
  },
  {
    $project: {
      // Personal Information
      personalData: {
        userId: "$userId",
        email: "$auth.email",
        profile: {
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          dateOfBirth: "$profile.dateOfBirth",
          gender: "$profile.gender",
          phones: "$profile.phones",
          addresses: "$profile.addresses"
        }
      },
      
      // Account Information
      accountData: {
        createdAt: "$metadata.createdAt",
        lastLoginAt: "$auth.lastLoginAt",
        emailVerified: "$auth.emailVerified",
        roles: "$access.roles",
        organisations: "$access.organisations"
      },
      
      // Purchase History
      purchaseHistory: {
        $map: {
          input: "$registrations",
          as: "reg",
          in: {
            registrationNumber: "$$reg.registrationNumber",
            date: "$$reg.metadata.createdAt",
            items: "$$reg.purchase.items",
            total: "$$reg.purchase.total"
          }
        }
      },
      
      // Event Attendance
      eventAttendance: {
        $map: {
          input: "$attendees",
          as: "att",
          in: {
            attendeeNumber: "$$att.attendeeNumber",
            events: "$$att.tickets",
            checkIns: "$$att.checkIns"
          }
        }
      },
      
      // Financial Data
      financialData: {
        paymentMethods: {
          $map: {
            input: { $ifNull: ["$financial.paymentMethods", []] },
            as: "pm",
            in: {
              type: "$$pm.type",
              last4: "$$pm.card.last4",
              addedAt: "$$pm.addedAt"
            }
          }
        },
        transactions: {
          $map: {
            input: "$transactions",
            as: "trans",
            in: {
              date: "$$trans.metadata.createdAt",
              type: "$$trans.type",
              amount: "$$trans.amounts.total"
            }
          }
        }
      },
      
      // Preferences and Communications
      preferences: "$preferences",
      
      // Activity Log
      activitySummary: {
        totalLogins: "$activity.engagement.loginCount",
        lastActive: "$activity.engagement.lastActiveAt",
        totalSpent: "$activity.registrations.totalSpent"
      },
      
      exportMetadata: {
        exportDate: new Date(),
        dataRetentionPolicy: "Data retained for 7 years per legal requirements"
      }
    }
  }
])
```