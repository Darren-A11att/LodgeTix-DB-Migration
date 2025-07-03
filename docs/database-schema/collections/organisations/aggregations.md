# Organisations Collection - Aggregation Pipelines

## Organisation Analytics

### 1. Organisation Overview Dashboard
```javascript
// Get comprehensive organisation statistics
db.organisations.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $facet: {
      // Type distribution
      byType: [
        {
          $group: {
            _id: "$profile.type",
            count: { $sum: 1 },
            totalMembers: { $sum: "$profile.details.size.activeMembers" },
            avgSize: { $avg: "$profile.details.size.activeMembers" }
          }
        },
        {
          $sort: { count: -1 }
        }
      ],
      
      // Geographic distribution
      byLocation: [
        {
          $group: {
            _id: {
              state: "$profile.addresses.physical.state",
              city: "$profile.addresses.physical.city"
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 20
        }
      ],
      
      // Size categories
      bySizeCategory: [
        {
          $group: {
            _id: "$profile.details.size.category",
            count: { $sum: 1 },
            totalMembers: { $sum: "$profile.details.size.memberCount" }
          }
        }
      ],
      
      // Financial overview
      financialSummary: [
        {
          $group: {
            _id: null,
            totalCreditLimit: { $sum: "$financial.credit.limit" },
            totalCreditUsed: { $sum: "$financial.credit.used" },
            avgDaysToPayment: { $avg: "$financial.credit.averageDaysToPayment" },
            excellentCredit: {
              $sum: { $cond: [{ $eq: ["$financial.credit.rating", "excellent"] }, 1, 0] }
            }
          }
        }
      ],
      
      // Event participation
      eventMetrics: [
        {
          $group: {
            _id: null,
            totalEventsAttended: { $sum: "$events.history.eventsAttended" },
            totalRevenue: { $sum: "$events.history.totalSpent" },
            activeParticipants: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      "$events.history.lastEventDate",
                      { $subtract: [new Date(), 365 * 24 * 60 * 60 * 1000] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]
    }
  }
])
```

### 2. Membership Analysis
```javascript
// Analyze membership patterns and officer distribution
db.organisations.aggregate([
  {
    $match: {
      status: "active",
      "membership.members": { $exists: true, $ne: [] }
    }
  },
  {
    $project: {
      organisationId: 1,
      name: "$profile.name",
      type: "$profile.type",
      
      // Member metrics
      memberStats: {
        total: { $size: "$membership.members" },
        active: {
          $size: {
            $filter: {
              input: "$membership.members",
              cond: { $eq: ["$$this.status", "active"] }
            }
          }
        },
        suspended: {
          $size: {
            $filter: {
              input: "$membership.members",
              cond: { $eq: ["$$this.status", "suspended"] }
            }
          }
        }
      },
      
      // Officer analysis
      officerPositions: {
        $map: {
          input: {
            $filter: {
              input: "$membership.officers",
              cond: { $eq: ["$$this.current", true] }
            }
          },
          in: "$$this.position"
        }
      },
      
      // Membership types
      membershipTypes: {
        $arrayToObject: {
          $map: {
            input: { $setUnion: "$membership.members.membershipType" },
            as: "type",
            in: {
              k: "$$type",
              v: {
                $size: {
                  $filter: {
                    input: "$membership.members",
                    cond: { $eq: ["$$this.membershipType", "$$type"] }
                  }
                }
              }
            }
          }
        }
      },
      
      // Dues status
      duesStatus: {
        current: {
          $size: {
            $filter: {
              input: "$membership.members",
              cond: {
                $and: [
                  { $eq: ["$$this.status", "active"] },
                  { $gte: ["$$this.dues.paidUntil", new Date()] }
                ]
              }
            }
          }
        },
        overdue: {
          $size: {
            $filter: {
              input: "$membership.members",
              cond: {
                $and: [
                  { $eq: ["$$this.status", "active"] },
                  { $lt: ["$$this.dues.paidUntil", new Date()] }
                ]
              }
            }
          }
        }
      }
    }
  },
  {
    $project: {
      organisationId: 1,
      name: 1,
      type: 1,
      memberStats: 1,
      membershipTypes: 1,
      duesStatus: 1,
      
      // Officer coverage
      hasKeyOfficers: {
        hasMaster: { $in: ["Master", "$officerPositions"] },
        hasSecretary: { $in: ["Secretary", "$officerPositions"] },
        hasTreasurer: { $in: ["Treasurer", "$officerPositions"] }
      },
      
      // Health metrics
      membershipHealth: {
        retentionRate: {
          $multiply: [
            { $divide: ["$memberStats.active", "$memberStats.total"] },
            100
          ]
        },
        duesCompliance: {
          $multiply: [
            { $divide: ["$duesStatus.current", "$memberStats.active"] },
            100
          ]
        }
      }
    }
  },
  {
    $sort: { "memberStats.total": -1 }
  }
])
```

## Financial Analysis

### 3. Credit and Payment Analysis
```javascript
// Analyze credit usage and payment performance
db.organisations.aggregate([
  {
    $match: {
      "financial.credit": { $exists: true }
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type"
      },
      
      creditProfile: {
        limit: "$financial.credit.limit",
        used: "$financial.credit.used",
        available: "$financial.credit.available",
        utilizationRate: {
          $multiply: [
            { $divide: ["$financial.credit.used", "$financial.credit.limit"] },
            100
          ]
        },
        rating: "$financial.credit.rating"
      },
      
      paymentBehavior: {
        avgDaysToPayment: "$financial.credit.averageDaysToPayment",
        onTimeRate: {
          $multiply: [
            {
              $divide: [
                "$financial.credit.onTimePayments",
                { $add: ["$financial.credit.onTimePayments", "$financial.credit.latePayments"] }
              ]
            },
            100
          ]
        },
        totalTransactions: {
          $add: ["$financial.credit.onTimePayments", "$financial.credit.latePayments"]
        }
      },
      
      riskScore: {
        $add: [
          // High utilization risk
          {
            $cond: [
              { $gte: [{ $divide: ["$financial.credit.used", "$financial.credit.limit"] }, 0.8] },
              30,
              0
            ]
          },
          // Payment delay risk
          {
            $cond: [
              { $gte: ["$financial.credit.averageDaysToPayment", 45] },
              20,
              0
            ]
          },
          // Late payment history
          {
            $multiply: [
              { $divide: ["$financial.credit.latePayments", { $add: ["$financial.credit.onTimePayments", "$financial.credit.latePayments", 1] }] },
              50
            ]
          }
        ]
      }
    }
  },
  {
    $group: {
      _id: "$creditProfile.rating",
      count: { $sum: 1 },
      avgCreditLimit: { $avg: "$creditProfile.limit" },
      avgUtilization: { $avg: "$creditProfile.utilizationRate" },
      avgDaysToPayment: { $avg: "$paymentBehavior.avgDaysToPayment" },
      
      // High risk organisations
      highRisk: {
        $push: {
          $cond: [
            { $gte: ["$riskScore", 30] },
            {
              organisation: "$organisation",
              riskScore: "$riskScore",
              creditProfile: "$creditProfile"
            },
            null
          ]
        }
      }
    }
  },
  {
    $project: {
      rating: "$_id",
      metrics: {
        count: "$count",
        avgCreditLimit: { $round: ["$avgCreditLimit", 2] },
        avgUtilization: { $round: ["$avgUtilization", 1] },
        avgDaysToPayment: { $round: ["$avgDaysToPayment", 0] }
      },
      highRiskOrgs: {
        $filter: {
          input: "$highRisk",
          cond: { $ne: ["$$this", null] }
        }
      }
    }
  }
])
```

### 4. Revenue by Organisation
```javascript
// Calculate total revenue and event participation by organisation
db.organisations.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $lookup: {
      from: "registrations",
      localField: "_id",
      foreignField: "registrant.id",
      as: "registrations"
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type",
        memberCount: "$profile.details.size.activeMembers"
      },
      
      // Revenue metrics
      revenue: {
        total: { $sum: "$registrations.purchase.total" },
        count: { $size: "$registrations" },
        avgOrderValue: { $avg: "$registrations.purchase.total" }
      },
      
      // Event participation
      events: {
        $setUnion: {
          $map: {
            input: "$registrations",
            in: "$$this.functionId"
          }
        }
      },
      
      // Time analysis
      activity: {
        firstPurchase: { $min: "$registrations.metadata.createdAt" },
        lastPurchase: { $max: "$registrations.metadata.createdAt" },
        
        // Recent activity
        recentPurchases: {
          $size: {
            $filter: {
              input: "$registrations",
              cond: {
                $gte: [
                  "$$this.metadata.createdAt",
                  { $subtract: [new Date(), 90 * 24 * 60 * 60 * 1000] }
                ]
              }
            }
          }
        }
      }
    }
  },
  {
    $project: {
      organisation: 1,
      revenue: 1,
      engagement: {
        totalEvents: { $size: "$events" },
        purchaseFrequency: {
          $cond: [
            { $gt: ["$revenue.count", 1] },
            {
              $divide: [
                { $subtract: ["$activity.lastPurchase", "$activity.firstPurchase"] },
                { $multiply: ["$revenue.count", 24 * 60 * 60 * 1000] }
              ]
            },
            0
          ]
        },
        isActive: { $gt: ["$activity.recentPurchases", 0] }
      },
      
      // Value per member
      memberValue: {
        $cond: [
          { $gt: ["$organisation.memberCount", 0] },
          { $divide: ["$revenue.total", "$organisation.memberCount"] },
          0
        ]
      }
    }
  },
  {
    $sort: { "revenue.total": -1 }
  },
  {
    $limit: 100
  }
])
```

## Event Management

### 5. Event Hosting Analysis
```javascript
// Analyze organisations that host events
db.organisations.aggregate([
  {
    $match: {
      "events.history.eventsHosted": { $exists: true, $ne: [] }
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        venue: "$profile.addresses.physical.venue"
      },
      
      hostingStats: {
        totalEventsHosted: { $size: "$events.history.eventsHosted" },
        
        eventTypes: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$events.history.eventsHosted.type" },
              as: "type",
              in: {
                k: "$$type",
                v: {
                  $size: {
                    $filter: {
                      input: "$events.history.eventsHosted",
                      cond: { $eq: ["$$this.type", "$$type"] }
                    }
                  }
                }
              }
            }
          }
        },
        
        totalAttendance: { $sum: "$events.history.eventsHosted.attendance" },
        avgAttendance: { $avg: "$events.history.eventsHosted.attendance" },
        
        lastEventHosted: { $max: "$events.history.eventsHosted.date" }
      },
      
      venueCapacity: "$profile.addresses.physical.venue.capacity",
      venueFacilities: "$profile.addresses.physical.venue.facilities"
    }
  },
  {
    $project: {
      organisation: 1,
      hostingStats: 1,
      venue: {
        capacity: "$venueCapacity",
        facilities: "$venueFacilities",
        utilizationRate: {
          $multiply: [
            { $divide: ["$hostingStats.avgAttendance", "$venueCapacity"] },
            100
          ]
        }
      },
      
      // Hosting frequency
      hostingFrequency: {
        $cond: [
          { $gt: ["$hostingStats.lastEventHosted", null] },
          {
            $divide: [
              "$hostingStats.totalEventsHosted",
              {
                $divide: [
                  { $subtract: [new Date(), "$hostingStats.lastEventHosted"] },
                  1000 * 60 * 60 * 24 * 365 // Years
                ]
              }
            ]
          },
          0
        ]
      }
    }
  },
  {
    $sort: { "hostingStats.totalEventsHosted": -1 }
  }
])
```

### 6. Bulk Booking Patterns
```javascript
// Analyze bulk booking behavior and preferences
db.organisations.aggregate([
  {
    $match: {
      "events.defaults.registrationType": { $in: ["lodge", "delegation"] }
    }
  },
  {
    $lookup: {
      from: "registrations",
      let: { orgId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$registrant.id", "$$orgId"] },
                { $eq: ["$type", "lodge"] }
              ]
            }
          }
        },
        {
          $project: {
            functionId: 1,
            attendeeCount: { $size: "$attendeeIds" },
            totalAmount: "$purchase.total",
            purchaseDate: "$metadata.createdAt"
          }
        }
      ],
      as: "bulkBookings"
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        defaultAllocation: "$events.defaults.bulkBooking.defaultAllocation"
      },
      
      bookingAnalysis: {
        totalBookings: { $size: "$bulkBookings" },
        
        avgGroupSize: { $avg: "$bulkBookings.attendeeCount" },
        maxGroupSize: { $max: "$bulkBookings.attendeeCount" },
        minGroupSize: { $min: "$bulkBookings.attendeeCount" },
        
        // Allocation efficiency
        allocationEfficiency: {
          $multiply: [
            {
              $divide: [
                { $avg: "$bulkBookings.attendeeCount" },
                "$events.defaults.bulkBooking.defaultAllocation"
              ]
            },
            100
          ]
        },
        
        totalSpent: { $sum: "$bulkBookings.totalAmount" },
        avgBookingValue: { $avg: "$bulkBookings.totalAmount" }
      },
      
      // Booking frequency
      bookingFrequency: {
        $let: {
          vars: {
            firstBooking: { $min: "$bulkBookings.purchaseDate" },
            lastBooking: { $max: "$bulkBookings.purchaseDate" }
          },
          in: {
            $cond: [
              { $gt: [{ $size: "$bulkBookings" }, 1] },
              {
                $divide: [
                  { $size: "$bulkBookings" },
                  {
                    $divide: [
                      { $subtract: ["$$lastBooking", "$$firstBooking"] },
                      1000 * 60 * 60 * 24 * 30 // Per month
                    ]
                  }
                ]
              },
              0
            ]
          }
        }
      },
      
      // Seating preferences
      seatingRequirements: "$events.defaults.seating"
    }
  },
  {
    $match: {
      "bookingAnalysis.totalBookings": { $gt: 0 }
    }
  },
  {
    $sort: { "bookingAnalysis.totalSpent": -1 }
  }
])
```

## Compliance and Risk

### 7. Insurance Expiry Report
```javascript
// Track insurance expiry and compliance status
db.organisations.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type"
      },
      
      insurance: {
        publicLiability: {
          hasPolicy: { $ne: ["$documents.insurance.publicLiability", null] },
          expiryDate: "$documents.insurance.publicLiability.expiryDate",
          daysUntilExpiry: {
            $divide: [
              {
                $subtract: [
                  "$documents.insurance.publicLiability.expiryDate",
                  new Date()
                ]
              },
              1000 * 60 * 60 * 24
            ]
          },
          coverAmount: "$documents.insurance.publicLiability.coverAmount"
        },
        
        professionalIndemnity: {
          hasPolicy: { $ne: ["$documents.insurance.professionalIndemnity", null] },
          expiryDate: "$documents.insurance.professionalIndemnity.expiryDate",
          daysUntilExpiry: {
            $divide: [
              {
                $subtract: [
                  "$documents.insurance.professionalIndemnity.expiryDate",
                  new Date()
                ]
              },
              1000 * 60 * 60 * 24
            ]
          },
          coverAmount: "$documents.insurance.professionalIndemnity.coverAmount"
        }
      },
      
      // Compliance status
      complianceDocuments: {
        $filter: {
          input: { $ifNull: ["$documents.compliance", []] },
          cond: { $eq: ["$$this.year", { $year: new Date() }] }
        }
      }
    }
  },
  {
    $project: {
      organisation: 1,
      insurance: 1,
      
      // Risk assessment
      insuranceRisk: {
        $switch: {
          branches: [
            {
              case: {
                $or: [
                  { $lte: ["$insurance.publicLiability.daysUntilExpiry", 0] },
                  { $eq: ["$insurance.publicLiability.hasPolicy", false] }
                ]
              },
              then: "critical"
            },
            {
              case: { $lte: ["$insurance.publicLiability.daysUntilExpiry", 30] },
              then: "high"
            },
            {
              case: { $lte: ["$insurance.publicLiability.daysUntilExpiry", 60] },
              then: "medium"
            }
          ],
          default: "low"
        }
      },
      
      complianceStatus: {
        documentsSubmitted: { $size: "$complianceDocuments" },
        allApproved: {
          $allElementsTrue: {
            $map: {
              input: "$complianceDocuments",
              in: { $eq: ["$$this.status", "approved"] }
            }
          }
        }
      }
    }
  },
  {
    $match: {
      $or: [
        { insuranceRisk: { $in: ["critical", "high"] } },
        { "complianceStatus.allApproved": false }
      ]
    }
  },
  {
    $sort: { insuranceRisk: 1, "insurance.publicLiability.daysUntilExpiry": 1 }
  }
])
```

### 8. Document Verification Status
```javascript
// Track document verification and compliance
db.organisations.aggregate([
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type",
        status: "$status"
      },
      
      verificationStatus: {
        isVerified: "$verification.verified",
        verifiedAt: "$verification.verifiedAt",
        daysSinceVerification: {
          $divide: [
            { $subtract: [new Date(), "$verification.verifiedAt"] },
            1000 * 60 * 60 * 24
          ]
        }
      },
      
      // Document checklist
      documentStatus: {
        hasConstitution: "$documents.constitution.uploaded",
        hasPublicLiability: { $ne: ["$documents.insurance.publicLiability", null] },
        hasProfessionalIndemnity: { $ne: ["$documents.insurance.professionalIndemnity", null] },
        hasCurrentCompliance: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$documents.compliance", []] },
                  cond: {
                    $and: [
                      { $eq: ["$$this.year", { $year: new Date() }] },
                      { $eq: ["$$this.status", "approved"] }
                    ]
                  }
                }
              }
            },
            0
          ]
        }
      },
      
      // Calculate completion percentage
      documentCompleteness: {
        $multiply: [
          {
            $divide: [
              {
                $add: [
                  { $cond: ["$documents.constitution.uploaded", 1, 0] },
                  { $cond: [{ $ne: ["$documents.insurance.publicLiability", null] }, 1, 0] },
                  { $cond: [{ $ne: ["$documents.insurance.professionalIndemnity", null] }, 1, 0] },
                  {
                    $cond: [
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ["$documents.compliance", []] },
                                cond: { $eq: ["$$this.year", { $year: new Date() }] }
                              }
                            }
                          },
                          0
                        ]
                      },
                      1,
                      0
                    ]
                  }
                ]
              },
              4 // Total required documents
            ]
          },
          100
        ]
      }
    }
  },
  {
    $match: {
      $or: [
        { "verificationStatus.isVerified": false },
        { documentCompleteness: { $lt: 100 } }
      ]
    }
  },
  {
    $sort: { documentCompleteness: 1 }
  }
])
```

## Relationship Analysis

### 9. Organisation Network
```javascript
// Map organisation relationships and affiliations
db.organisations.aggregate([
  {
    $match: {
      status: "active",
      $or: [
        { "relationships.parent": { $exists: true } },
        { "relationships.children": { $exists: true, $ne: [] } },
        { "relationships.affiliations": { $exists: true, $ne: [] } }
      ]
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type"
      },
      
      // Hierarchy
      hierarchy: {
        parent: "$relationships.parent",
        childCount: { $size: { $ifNull: ["$relationships.children", []] } },
        level: {
          $cond: [
            { $ne: ["$relationships.parent", null] },
            "child",
            {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$relationships.children", []] } }, 0] },
                "parent",
                "standalone"
              ]
            }
          ]
        }
      },
      
      // Network size
      networkSize: {
        affiliations: {
          $size: {
            $filter: {
              input: { $ifNull: ["$relationships.affiliations", []] },
              cond: { $eq: ["$$this.current", true] }
            }
          }
        },
        reciprocal: { $size: { $ifNull: ["$relationships.reciprocal", []] } }
      },
      
      // Active relationships
      activeRelationships: {
        $concatArrays: [
          { $ifNull: ["$relationships.children", []] },
          {
            $filter: {
              input: { $ifNull: ["$relationships.affiliations", []] },
              cond: { $eq: ["$$this.current", true] }
            }
          },
          { $ifNull: ["$relationships.reciprocal", []] }
        ]
      }
    }
  },
  {
    $project: {
      organisation: 1,
      hierarchy: 1,
      networkMetrics: {
        totalConnections: {
          $add: [
            { $cond: [{ $ne: ["$hierarchy.parent", null] }, 1, 0] },
            "$hierarchy.childCount",
            "$networkSize.affiliations",
            "$networkSize.reciprocal"
          ]
        },
        networkType: {
          $switch: {
            branches: [
              {
                case: { $eq: ["$hierarchy.level", "parent"] },
                then: "hub"
              },
              {
                case: {
                  $gte: [
                    { $add: ["$networkSize.affiliations", "$networkSize.reciprocal"] },
                    5
                  ]
                },
                then: "well_connected"
              },
              {
                case: {
                  $gt: [
                    { $add: ["$networkSize.affiliations", "$networkSize.reciprocal"] },
                    0
                  ]
                },
                then: "connected"
              }
            ],
            default: "isolated"
          }
        }
      },
      
      // List active connections
      connections: {
        $map: {
          input: "$activeRelationships",
          in: {
            name: "$$this.name",
            type: "$$this.type"
          }
        }
      }
    }
  },
  {
    $sort: { "networkMetrics.totalConnections": -1 }
  }
])
```

## Performance Dashboard

### 10. Organisation Health Score
```javascript
// Calculate comprehensive health score for organisations
db.organisations.aggregate([
  {
    $match: {
      status: "active"
    }
  },
  {
    $lookup: {
      from: "registrations",
      localField: "_id",
      foreignField: "registrant.id",
      as: "recentRegistrations"
    }
  },
  {
    $project: {
      organisation: {
        id: "$organisationId",
        name: "$profile.name",
        type: "$profile.type"
      },
      
      // Calculate individual health metrics
      healthMetrics: {
        // Membership health (0-25 points)
        membershipScore: {
          $min: [
            25,
            {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: ["$profile.details.size.activeMembers", 0] },
                    { $max: [{ $ifNull: ["$profile.details.size.memberCount", 1] }, 1] }
                  ]
                },
                25
              ]
            }
          ]
        },
        
        // Financial health (0-25 points)
        financialScore: {
          $min: [
            25,
            {
              $add: [
                // Credit rating
                {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$financial.credit.rating", "excellent"] }, then: 10 },
                      { case: { $eq: ["$financial.credit.rating", "good"] }, then: 7 },
                      { case: { $eq: ["$financial.credit.rating", "fair"] }, then: 4 }
                    ],
                    default: 0
                  }
                },
                // Payment performance
                {
                  $cond: [
                    { $lte: ["$financial.credit.averageDaysToPayment", 30] },
                    10,
                    {
                      $cond: [
                        { $lte: ["$financial.credit.averageDaysToPayment", 45] },
                        5,
                        0
                      ]
                    }
                  ]
                },
                // Credit utilization
                {
                  $cond: [
                    {
                      $lte: [
                        { $divide: ["$financial.credit.used", { $max: ["$financial.credit.limit", 1] }] },
                        0.5
                      ]
                    },
                    5,
                    0
                  ]
                }
              ]
            }
          ]
        },
        
        // Event participation (0-25 points)
        participationScore: {
          $min: [
            25,
            {
              $add: [
                // Recent activity
                {
                  $cond: [
                    {
                      $gte: [
                        "$events.history.lastEventDate",
                        { $subtract: [new Date(), 180 * 24 * 60 * 60 * 1000] }
                      ]
                    },
                    15,
                    0
                  ]
                },
                // Event frequency
                {
                  $min: [
                    10,
                    { $divide: [{ $ifNull: ["$events.history.eventsAttended", 0] }, 2] }
                  ]
                }
              ]
            }
          ]
        },
        
        // Compliance (0-25 points)
        complianceScore: {
          $min: [
            25,
            {
              $add: [
                // Verification status
                { $cond: ["$verification.verified", 10, 0] },
                // Insurance current
                {
                  $cond: [
                    {
                      $gt: [
                        "$documents.insurance.publicLiability.expiryDate",
                        { $add: [new Date(), 30 * 24 * 60 * 60 * 1000] }
                      ]
                    },
                    10,
                    0
                  ]
                },
                // Documents complete
                { $cond: ["$documents.constitution.uploaded", 5, 0] }
              ]
            }
          ]
        }
      }
    }
  },
  {
    $project: {
      organisation: 1,
      healthMetrics: 1,
      
      // Calculate total health score
      totalHealthScore: {
        $add: [
          "$healthMetrics.membershipScore",
          "$healthMetrics.financialScore",
          "$healthMetrics.participationScore",
          "$healthMetrics.complianceScore"
        ]
      },
      
      // Determine health status
      healthStatus: {
        $switch: {
          branches: [
            {
              case: {
                $gte: [
                  {
                    $add: [
                      "$healthMetrics.membershipScore",
                      "$healthMetrics.financialScore",
                      "$healthMetrics.participationScore",
                      "$healthMetrics.complianceScore"
                    ]
                  },
                  80
                ]
              },
              then: "excellent"
            },
            {
              case: {
                $gte: [
                  {
                    $add: [
                      "$healthMetrics.membershipScore",
                      "$healthMetrics.financialScore",
                      "$healthMetrics.participationScore",
                      "$healthMetrics.complianceScore"
                    ]
                  },
                  60
                ]
              },
              then: "good"
            },
            {
              case: {
                $gte: [
                  {
                    $add: [
                      "$healthMetrics.membershipScore",
                      "$healthMetrics.financialScore",
                      "$healthMetrics.participationScore",
                      "$healthMetrics.complianceScore"
                    ]
                  },
                  40
                ]
              },
              then: "fair"
            }
          ],
          default: "needs_attention"
        }
      }
    }
  },
  {
    $sort: { totalHealthScore: -1 }
  }
])
```

### 11. Jurisdiction Analysis
```javascript
// Analyze organisations by jurisdiction
db.organisations.aggregate([
  {
    $match: {
      status: "active",
      jurisdictionId: { $exists: true }
    }
  },
  {
    $lookup: {
      from: "jurisdictions",
      localField: "jurisdictionId",
      foreignField: "_id",
      as: "jurisdiction"
    }
  },
  { $unwind: "$jurisdiction" },
  {
    $group: {
      _id: {
        jurisdictionId: "$jurisdictionId",
        jurisdictionType: "$jurisdiction.type"
      },
      jurisdictionName: { $first: "$jurisdiction.definitions.parentName" },
      organisations: {
        $push: {
          id: "$organisationId",
          name: "$profile.name",
          type: "$profile.type",
          memberCount: "$profile.details.size.activeMembers"
        }
      },
      totalOrganisations: { $sum: 1 },
      totalMembers: { $sum: "$profile.details.size.activeMembers" },
      avgMembersPerOrg: { $avg: "$profile.details.size.activeMembers" }
    }
  },
  {
    $project: {
      _id: 0,
      jurisdiction: {
        id: "$_id.jurisdictionId",
        type: "$_id.jurisdictionType",
        name: "$jurisdictionName"
      },
      statistics: {
        organisationCount: "$totalOrganisations",
        totalMembers: "$totalMembers",
        avgMembersPerOrg: { $round: ["$avgMembersPerOrg", 0] }
      },
      organisations: {
        $slice: [
          {
            $sortArray: {
              input: "$organisations",
              sortBy: { memberCount: -1 }
            }
          },
          10 // Top 10 organisations by member count
        ]
      }
    }
  },
  { $sort: { "statistics.organisationCount": -1 } }
])
```