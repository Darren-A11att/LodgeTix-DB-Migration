# Users Collection - Aggregation Pipelines

## Authentication and Security

### 1. Active Sessions Report
```javascript
// Monitor active user sessions
db.users.aggregate([
  {
    $match: {
      status: "active",
      "authentication.lastLogin": {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  },
  {
    $project: {
      email: 1,
      lastLogin: "$authentication.lastLogin",
      lastLoginIp: "$authentication.lastLoginIp",
      mfaEnabled: "$authentication.mfa.enabled",
      daysSinceCreation: {
        $divide: [
          { $subtract: [new Date(), "$createdAt"] },
          1000 * 60 * 60 * 24
        ]
      }
    }
  },
  {
    $sort: { lastLogin: -1 }
  }
])
```

### 2. Failed Login Analysis
```javascript
// Track failed login attempts and locked accounts
db.users.aggregate([
  {
    $match: {
      $or: [
        { "authentication.failedAttempts": { $gt: 0 } },
        { "authentication.lockedUntil": { $exists: true } }
      ]
    }
  },
  {
    $project: {
      email: 1,
      failedAttempts: "$authentication.failedAttempts",
      isLocked: {
        $cond: [
          { $gt: ["$authentication.lockedUntil", new Date()] },
          true,
          false
        ]
      },
      lockExpiresIn: {
        $cond: [
          { $gt: ["$authentication.lockedUntil", new Date()] },
          {
            $divide: [
              { $subtract: ["$authentication.lockedUntil", new Date()] },
              1000 * 60 // Minutes
            ]
          },
          null
        ]
      },
      lastLoginIp: "$authentication.lastLoginIp"
    }
  },
  {
    $match: {
      $or: [
        { failedAttempts: { $gte: 3 } },
        { isLocked: true }
      ]
    }
  },
  {
    $sort: { failedAttempts: -1 }
  }
])
```

### 3. MFA Adoption Report
```javascript
// Analyze MFA adoption across users
db.users.aggregate([
  {
    $group: {
      _id: "$status",
      total: { $sum: 1 },
      mfaEnabled: {
        $sum: {
          $cond: ["$authentication.mfa.enabled", 1, 0]
        }
      },
      mfaTypes: {
        $push: {
          $cond: [
            "$authentication.mfa.enabled",
            "$authentication.mfa.type",
            null
          ]
        }
      }
    }
  },
  {
    $project: {
      status: "$_id",
      totalUsers: "$total",
      mfaEnabled: "$mfaEnabled",
      mfaAdoptionRate: {
        $multiply: [
          { $divide: ["$mfaEnabled", "$total"] },
          100
        ]
      },
      mfaTypes: {
        $reduce: {
          input: "$mfaTypes",
          initialValue: {
            totp: 0,
            sms: 0,
            email: 0
          },
          in: {
            totp: {
              $cond: [
                { $eq: ["$$this", "totp"] },
                { $add: ["$$value.totp", 1] },
                "$$value.totp"
              ]
            },
            sms: {
              $cond: [
                { $eq: ["$$this", "sms"] },
                { $add: ["$$value.sms", 1] },
                "$$value.sms"
              ]
            },
            email: {
              $cond: [
                { $eq: ["$$this", "email"] },
                { $add: ["$$value.email", 1] },
                "$$value.email"
              ]
            }
          }
        }
      }
    }
  },
  {
    $sort: { status: 1 }
  }
])
```

## User Analytics

### 4. User Growth Over Time
```javascript
// Track user registration trends
db.users.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        week: { $week: "$createdAt" }
      },
      newUsers: { $sum: 1 },
      verified: {
        $sum: { $cond: ["$emailVerified", 1, 0] }
      },
      withContacts: {
        $sum: { $cond: [{ $ne: ["$contactId", null] }, 1, 0] }
      }
    }
  },
  {
    $project: {
      period: {
        year: "$_id.year",
        month: "$_id.month",
        week: "$_id.week"
      },
      metrics: {
        newUsers: "$newUsers",
        verifiedUsers: "$verified",
        verificationRate: {
          $round: [
            { $multiply: [{ $divide: ["$verified", "$newUsers"] }, 100] },
            2
          ]
        },
        contactLinkRate: {
          $round: [
            { $multiply: [{ $divide: ["$withContacts", "$newUsers"] }, 100] },
            2
          ]
        }
      }
    }
  },
  {
    $sort: {
      "period.year": -1,
      "period.month": -1,
      "period.week": -1
    }
  },
  {
    $limit: 52 // Last year of weekly data
  }
])
```

### 5. Account Status Distribution
```javascript
// Analyze user account statuses
db.users.aggregate([
  {
    $facet: {
      byStatus: [
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            verified: {
              $sum: { $cond: ["$emailVerified", 1, 0] }
            },
            avgDaysActive: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "active"] },
                  {
                    $divide: [
                      { $subtract: [new Date(), "$createdAt"] },
                      1000 * 60 * 60 * 24
                    ]
                  },
                  null
                ]
              }
            }
          }
        }
      ],
      totals: [
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
            },
            inactive: {
              $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] }
            },
            suspended: {
              $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            }
          }
        }
      ],
      recentActivity: [
        {
          $match: {
            "authentication.lastLogin": {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: null,
            activeLastMonth: { $sum: 1 }
          }
        }
      ]
    }
  },
  {
    $project: {
      statusBreakdown: "$byStatus",
      summary: { $arrayElemAt: ["$totals", 0] },
      engagement: { $arrayElemAt: ["$recentActivity", 0] }
    }
  }
])
```

## Contact Integration

### 6. Users with Contact Details
```javascript
// Join users with their contact information
db.users.aggregate([
  {
    $match: {
      status: "active",
      contactId: { $ne: null }
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "_id",
      as: "contact"
    }
  },
  {
    $unwind: "$contact"
  },
  {
    $project: {
      email: 1,
      status: 1,
      profile: {
        fullName: {
          $concat: [
            "$contact.profile.firstName",
            " ",
            "$contact.profile.lastName"
          ]
        },
        preferredName: "$contact.profile.preferredName",
        email: "$contact.profile.email",
        phone: "$contact.profile.phone"
      },
      roles: "$contact.roles",
      hasOrders: {
        $gt: [{ $size: { $ifNull: ["$contact.orderReferences", []] } }, 0]
      },
      authentication: {
        lastLogin: "$authentication.lastLogin",
        mfaEnabled: "$authentication.mfa.enabled"
      }
    }
  },
  {
    $sort: { "authentication.lastLogin": -1 }
  }
])
```

### 7. Users Without Contacts
```javascript
// Identify users needing contact records
db.users.aggregate([
  {
    $match: {
      $or: [
        { contactId: null },
        { contactId: { $exists: false } }
      ]
    }
  },
  {
    $project: {
      email: 1,
      status: 1,
      createdAt: 1,
      daysSinceCreation: {
        $round: [
          {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60 * 24
            ]
          },
          0
        ]
      },
      lastLogin: "$authentication.lastLogin",
      requiresImmediate: {
        $and: [
          { $eq: ["$status", "active"] },
          { $gte: ["$authentication.lastLogin", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }
        ]
      }
    }
  },
  {
    $sort: { requiresImmediate: -1, daysSinceCreation: -1 }
  }
])
```

## Security Monitoring

### 8. Suspicious Activity Detection
```javascript
// Identify potentially compromised accounts
db.users.aggregate([
  {
    $match: {
      status: "active",
      $or: [
        { "authentication.failedAttempts": { $gte: 3 } },
        {
          "authentication.lastLogin": {
            $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      ]
    }
  },
  {
    $project: {
      email: 1,
      riskIndicators: {
        failedAttempts: "$authentication.failedAttempts",
        recentlyLocked: {
          $cond: [
            {
              $and: [
                { $ne: ["$authentication.lockedUntil", null] },
                { $gte: ["$authentication.lockedUntil", new Date(Date.now() - 24 * 60 * 60 * 1000)] }
              ]
            },
            true,
            false
          ]
        },
        noMFA: { $not: "$authentication.mfa.enabled" },
        unverifiedEmail: { $not: "$emailVerified" }
      },
      riskScore: {
        $add: [
          { $multiply: ["$authentication.failedAttempts", 10] },
          { $cond: [{ $not: "$authentication.mfa.enabled" }, 20, 0] },
          { $cond: [{ $not: "$emailVerified" }, 15, 0] },
          {
            $cond: [
              { $gte: ["$authentication.lockedUntil", new Date(Date.now() - 24 * 60 * 60 * 1000)] },
              25,
              0
            ]
          }
        ]
      }
    }
  },
  {
    $match: {
      riskScore: { $gte: 20 }
    }
  },
  {
    $sort: { riskScore: -1 }
  }
])
```

### 9. Login IP Analysis
```javascript
// Analyze login patterns by IP address
db.users.aggregate([
  {
    $match: {
      "authentication.lastLoginIp": { $ne: null }
    }
  },
  {
    $group: {
      _id: "$authentication.lastLoginIp",
      users: {
        $push: {
          email: "$email",
          lastLogin: "$authentication.lastLogin",
          failedAttempts: "$authentication.failedAttempts"
        }
      },
      totalUsers: { $sum: 1 },
      totalFailedAttempts: { $sum: "$authentication.failedAttempts" },
      avgFailedAttempts: { $avg: "$authentication.failedAttempts" }
    }
  },
  {
    $match: {
      $or: [
        { totalUsers: { $gte: 5 } },  // Multiple users from same IP
        { avgFailedAttempts: { $gte: 3 } }  // High failure rate
      ]
    }
  },
  {
    $project: {
      ipAddress: "$_id",
      metrics: {
        uniqueUsers: "$totalUsers",
        totalFailedAttempts: "$totalFailedAttempts",
        avgFailedAttempts: { $round: ["$avgFailedAttempts", 2] }
      },
      suspiciousActivity: {
        $or: [
          { $gte: ["$totalUsers", 10] },
          { $gte: ["$avgFailedAttempts", 5] }
        ]
      },
      recentUsers: {
        $slice: [
          {
            $sortArray: {
              input: "$users",
              sortBy: { lastLogin: -1 }
            }
          },
          5
        ]
      }
    }
  },
  {
    $sort: { "metrics.totalFailedAttempts": -1 }
  }
])
```

## Data Quality

### 10. Email Verification Status
```javascript
// Track email verification progress
db.users.aggregate([
  {
    $facet: {
      overallStats: [
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: { $cond: ["$emailVerified", 1, 0] }
            },
            pendingVerification: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "pending"] },
                      { $eq: ["$emailVerified", false] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            total: 1,
            verified: 1,
            unverified: { $subtract: ["$total", "$verified"] },
            verificationRate: {
              $round: [
                { $multiply: [{ $divide: ["$verified", "$total"] }, 100] },
                2
              ]
            }
          }
        }
      ],
      unverifiedUsers: [
        {
          $match: {
            emailVerified: false,
            status: { $ne: "suspended" }
          }
        },
        {
          $project: {
            email: 1,
            status: 1,
            createdAt: 1,
            daysSinceCreation: {
              $round: [
                {
                  $divide: [
                    { $subtract: [new Date(), "$createdAt"] },
                    1000 * 60 * 60 * 24
                  ]
                },
                0
              ]
            }
          }
        },
        {
          $sort: { createdAt: 1 }
        },
        {
          $limit: 20
        }
      ]
    }
  }
])
```