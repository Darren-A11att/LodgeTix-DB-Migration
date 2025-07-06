# Users Collection - Aggregation Pipelines

## Authentication and Security

### 1. Active Sessions Report
```javascript
// Monitor active user sessions
db.users.aggregate([
  {
    $match: {
      status: "active",
      lastLogin: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "contactId",
      as: "contact"
    }
  },
  { $unwind: "$contact" },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      name: { $concat: ["$contact.firstName", " ", "$contact.lastName"] },
      lastLogin: 1,
      loginCount: 1,
      hasOAuth: { 
        $or: [
          { $ne: ["$authProviders.google.id", null] },
          { $ne: ["$authProviders.facebook.id", null] }
        ]
      },
      daysSinceCreation: {
        $divide: [
          { $subtract: [new Date(), "$createdAt"] },
          1000 * 60 * 60 * 24
        ]
      }
    }
  },
  { $sort: { lastLogin: -1 } }
])
```

### 2. User Authentication Methods
```javascript
// Analyze authentication methods used
db.users.aggregate([
  {
    $facet: {
      byMethod: [
        {
          $project: {
            hasPassword: { $ne: ["$password", null] },
            hasGoogle: { $ne: ["$authProviders.google.id", null] },
            hasFacebook: { $ne: ["$authProviders.facebook.id", null] },
            hasEmail: { $ne: ["$email", null] },
            hasPhone: { $ne: ["$phone", null] }
          }
        },
        {
          $group: {
            _id: null,
            passwordAuth: { $sum: { $cond: ["$hasPassword", 1, 0] } },
            googleAuth: { $sum: { $cond: ["$hasGoogle", 1, 0] } },
            facebookAuth: { $sum: { $cond: ["$hasFacebook", 1, 0] } },
            emailUsers: { $sum: { $cond: ["$hasEmail", 1, 0] } },
            phoneUsers: { $sum: { $cond: ["$hasPhone", 1, 0] } },
            total: { $sum: 1 }
          }
        }
      ],
      verificationStatus: [
        {
          $group: {
            _id: null,
            emailVerified: { 
              $sum: { 
                $cond: [
                  { $and: ["$email", "$emailVerified"] }, 
                  1, 
                  0
                ] 
              } 
            },
            emailUnverified: { 
              $sum: { 
                $cond: [
                  { $and: ["$email", { $not: "$emailVerified" }] }, 
                  1, 
                  0
                ] 
              } 
            },
            phoneVerified: { 
              $sum: { 
                $cond: [
                  { $and: ["$phone", "$phoneVerified"] }, 
                  1, 
                  0
                ] 
              } 
            },
            phoneUnverified: { 
              $sum: { 
                $cond: [
                  { $and: ["$phone", { $not: "$phoneVerified" }] }, 
                  1, 
                  0
                ] 
              } 
            }
          }
        }
      ]
    }
  },
  {
    $project: {
      authMethods: { $arrayElemAt: ["$byMethod", 0] },
      verification: { $arrayElemAt: ["$verificationStatus", 0] }
    }
  }
])
```

### 3. Password Reset Activity
```javascript
// Track password reset requests
db.users.aggregate([
  {
    $match: {
      passwordResetToken: { $ne: null }
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      resetExpired: {
        $lt: ["$passwordResetExpires", new Date()]
      },
      hoursUntilExpiry: {
        $cond: [
          { $gt: ["$passwordResetExpires", new Date()] },
          {
            $divide: [
              { $subtract: ["$passwordResetExpires", new Date()] },
              1000 * 60 * 60
            ]
          },
          0
        ]
      }
    }
  },
  {
    $group: {
      _id: "$resetExpired",
      count: { $sum: 1 },
      users: {
        $push: {
          userId: "$userId",
          email: "$email",
          hoursUntilExpiry: "$hoursUntilExpiry"
        }
      }
    }
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
      withEmail: {
        $sum: { $cond: [{ $ne: ["$email", null] }, 1, 0] }
      },
      withPhone: {
        $sum: { $cond: [{ $ne: ["$phone", null] }, 1, 0] }
      },
      withOAuth: {
        $sum: { 
          $cond: [
            {
              $or: [
                { $ne: ["$authProviders.google.id", null] },
                { $ne: ["$authProviders.facebook.id", null] }
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
      period: {
        year: "$_id.year",
        month: "$_id.month",
        week: "$_id.week"
      },
      metrics: {
        newUsers: "$newUsers",
        emailUsers: "$withEmail",
        phoneUsers: "$withPhone",
        oAuthUsers: "$withOAuth"
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
  { $limit: 52 } // Last year of weekly data
])
```

### 5. User Role Distribution
```javascript
// Analyze user roles and permissions
db.users.aggregate([
  {
    $unwind: "$roles"
  },
  {
    $group: {
      _id: "$roles",
      count: { $sum: 1 },
      activeUsers: {
        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
      },
      recentlyActive: {
        $sum: {
          $cond: [
            {
              $gte: ["$lastLogin", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
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
      role: "$_id",
      totalUsers: "$count",
      activeUsers: 1,
      recentlyActive: 1,
      activityRate: {
        $round: [
          { $multiply: [{ $divide: ["$recentlyActive", "$count"] }, 100] },
          2
        ]
      }
    }
  },
  { $sort: { totalUsers: -1 } }
])
```

## Contact Integration

### 6. Users with Complete Profiles
```javascript
// Join users with their contact information
db.users.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "contactId",
      as: "contact"
    }
  },
  { $unwind: "$contact" },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      roles: 1,
      profile: {
        fullName: {
          $concat: ["$contact.firstName", " ", "$contact.lastName"]
        },
        preferredName: "$contact.preferredName",
        hasAddress: { $ne: ["$contact.address", null] },
        hasMasonicProfile: { $ne: ["$contact.masonicProfile", null] },
        registrationCount: { 
          $size: { $objectToArray: { $ifNull: ["$contact.registrations", {}] } } 
        },
        organizationCount: { 
          $size: { $objectToArray: { $ifNull: ["$contact.organizations", {}] } } 
        }
      },
      lastLogin: 1,
      loginCount: 1
    }
  },
  { $sort: { lastLogin: -1 } }
])
```

### 7. Booking/Billing Contacts Status
```javascript
// Check if all booking/billing contacts have user accounts
db.contacts.aggregate([
  // Convert registrations object to array
  {
    $addFields: {
      registrationsArray: { $objectToArray: { $ifNull: ["$registrations", {}] } }
    }
  },
  // Filter for booking/billing contacts
  {
    $match: {
      "registrationsArray.v.role": { $in: ["bookingContact", "billingContact"] }
    }
  },
  // Check if they have user accounts
  {
    $lookup: {
      from: "users",
      localField: "contactId",
      foreignField: "contactId",
      as: "userAccount"
    }
  },
  {
    $project: {
      contactId: 1,
      name: { $concat: ["$firstName", " ", "$lastName"] },
      email: 1,
      phone: 1,
      roles: {
        $map: {
          input: {
            $filter: {
              input: "$registrationsArray",
              cond: { $in: ["$$this.v.role", ["bookingContact", "billingContact"]] }
            }
          },
          as: "reg",
          in: {
            role: "$$reg.v.role",
            functionName: "$$reg.v.functionName"
          }
        }
      },
      hasUserAccount: { $gt: [{ $size: "$userAccount" }, 0] },
      userStatus: { $arrayElemAt: ["$userAccount.status", 0] }
    }
  },
  {
    $match: {
      hasUserAccount: false
    }
  },
  { $sort: { name: 1 } }
])
```

## Security Monitoring

### 8. Inactive User Analysis
```javascript
// Identify inactive users
db.users.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      daysSinceLastLogin: {
        $cond: [
          { $ne: ["$lastLogin", null] },
          {
            $divide: [
              { $subtract: [new Date(), "$lastLogin"] },
              1000 * 60 * 60 * 24
            ]
          },
          {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        ]
      },
      neverLoggedIn: { $eq: ["$lastLogin", null] },
      loginCount: 1,
      createdAt: 1
    }
  },
  {
    $match: {
      $or: [
        { daysSinceLastLogin: { $gte: 90 } }, // 3 months inactive
        { neverLoggedIn: true }
      ]
    }
  },
  {
    $group: {
      _id: {
        $cond: [
          "$neverLoggedIn",
          "never_logged_in",
          {
            $switch: {
              branches: [
                { case: { $lt: ["$daysSinceLastLogin", 180] }, then: "3-6_months" },
                { case: { $lt: ["$daysSinceLastLogin", 365] }, then: "6-12_months" },
                { case: { $gte: ["$daysSinceLastLogin", 365] }, then: "over_1_year" }
              ]
            }
          }
        ]
      },
      count: { $sum: 1 },
      users: {
        $push: {
          userId: "$userId",
          email: "$email",
          lastLogin: "$lastLogin",
          daysSinceLastLogin: { $round: ["$daysSinceLastLogin", 0] }
        }
      }
    }
  },
  { $sort: { _id: 1 } }
])
```

### 9. OAuth Provider Usage
```javascript
// Analyze OAuth provider adoption
db.users.aggregate([
  {
    $project: {
      authMethods: {
        hasPassword: { $ne: ["$password", null] },
        hasGoogle: { $ne: ["$authProviders.google.id", null] },
        hasFacebook: { $ne: ["$authProviders.facebook.id", null] }
      },
      status: 1,
      lastLogin: 1
    }
  },
  {
    $group: {
      _id: {
        google: "$authMethods.hasGoogle",
        facebook: "$authMethods.hasFacebook",
        password: "$authMethods.hasPassword"
      },
      count: { $sum: 1 },
      activeCount: {
        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
      },
      recentlyActive: {
        $sum: {
          $cond: [
            { $gte: ["$lastLogin", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
            1,
            0
          ]
        }
      }
    }
  },
  {
    $project: {
      authCombination: "$_id",
      userCount: "$count",
      activeUsers: "$activeCount",
      monthlyActiveUsers: "$recentlyActive",
      activityRate: {
        $round: [
          { $multiply: [{ $divide: ["$recentlyActive", "$count"] }, 100] },
          2
        ]
      }
    }
  },
  { $sort: { userCount: -1 } }
])
```

## Data Quality

### 10. Users Missing Required Data
```javascript
// Identify users with incomplete data
db.users.aggregate([
  {
    $lookup: {
      from: "contacts",
      localField: "contactId",
      foreignField: "contactId",
      as: "contact"
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      issues: {
        $concatArrays: [
          {
            $cond: [
              { $and: [{ $eq: ["$email", null] }, { $eq: ["$phone", null] }] },
              ["No authentication method"],
              []
            ]
          },
          {
            $cond: [
              { $and: ["$email", { $not: "$emailVerified" }] },
              ["Email not verified"],
              []
            ]
          },
          {
            $cond: [
              { $and: ["$phone", { $not: "$phoneVerified" }] },
              ["Phone not verified"],
              []
            ]
          },
          {
            $cond: [
              { $eq: [{ $size: "$contact" }, 0] },
              ["No contact record"],
              []
            ]
          },
          {
            $cond: [
              {
                $and: [
                  { $in: ["host", "$roles"] },
                  { $not: "$emailVerified" }
                ]
              },
              ["Host without verified email"],
              []
            ]
          }
        ]
      },
      contact: { $arrayElemAt: ["$contact", 0] },
      lastLogin: 1,
      status: 1
    }
  },
  {
    $match: {
      "issues.0": { $exists: true }
    }
  },
  {
    $project: {
      userId: 1,
      email: 1,
      phone: 1,
      issues: 1,
      issueCount: { $size: "$issues" },
      isActive: { $eq: ["$status", "active"] },
      daysSinceLastLogin: {
        $cond: [
          { $ne: ["$lastLogin", null] },
          {
            $divide: [
              { $subtract: [new Date(), "$lastLogin"] },
              1000 * 60 * 60 * 24
            ]
          },
          null
        ]
      }
    }
  },
  { $sort: { isActive: -1, issueCount: -1 } }
])
```