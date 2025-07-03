# Registrations Collection - Aggregation Pipelines

## Contact and Attendee Integration

### 1. Registration with Contact Details
```javascript
// Get registration with registrant contact information
db.registrations.aggregate([
  { $match: { _id: ObjectId("registrationId") } },
  
  // Lookup contact for individual registrants
  {
    $lookup: {
      from: "contacts",
      localField: "registrant.contactId",
      foreignField: "_id",
      as: "registrantContact"
    }
  },
  
  // Lookup organisation for org registrants
  {
    $lookup: {
      from: "organisations",
      localField: "registrant.organisationId",
      foreignField: "_id",
      as: "registrantOrg"
    }
  },
  
  // Lookup attendees
  {
    $lookup: {
      from: "attendees",
      localField: "attendeeIds",
      foreignField: "_id",
      as: "attendees"
    }
  },
  
  // Get contact details for each attendee
  {
    $lookup: {
      from: "contacts",
      localField: "attendees.contactId",
      foreignField: "_id",
      as: "attendeeContacts"
    }
  },
  
  {
    $project: {
      registrationNumber: 1,
      registrant: {
        type: "$registrant.type",
        name: "$registrant.name",
        email: "$registrant.email",
        phone: "$registrant.phone",
        // Full contact details if individual
        contact: { $arrayElemAt: ["$registrantContact", 0] },
        // Organisation details if org
        organisation: { $arrayElemAt: ["$registrantOrg", 0] }
      },
      attendees: {
        $map: {
          input: "$attendees",
          as: "attendee",
          in: {
            attendeeNumber: "$$attendee.attendeeNumber",
            profile: "$$attendee.profile",
            contact: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$attendeeContacts",
                    cond: { $eq: ["$$this._id", "$$attendee.contactId"] }
                  }
                },
                0
              ]
            }
          }
        }
      },
      purchase: 1
    }
  }
])
```

### 2. Contact Purchase History
```javascript
// Get all registrations for a specific contact
db.registrations.aggregate([
  {
    $match: {
      "registrant.contactId": ObjectId("contactId")
    }
  },
  {
    $group: {
      _id: "$registrant.contactId",
      totalRegistrations: { $sum: 1 },
      totalSpent: { $sum: "$purchase.total" },
      functions: { $addToSet: "$functionId" },
      registrations: {
        $push: {
          registrationNumber: "$registrationNumber",
          functionId: "$functionId",
          date: "$metadata.createdAt",
          total: "$purchase.total",
          status: "$status"
        }
      }
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "_id",
      foreignField: "_id",
      as: "contact"
    }
  },
  { $unwind: "$contact" },
  {
    $project: {
      contact: {
        name: { $concat: ["$contact.profile.firstName", " ", "$contact.profile.lastName"] },
        email: "$contact.profile.email",
        phone: "$contact.profile.phone"
      },
      purchaseHistory: {
        totalRegistrations: "$totalRegistrations",
        totalSpent: "$totalSpent",
        uniqueFunctions: { $size: "$functions" },
        registrations: "$registrations"
      }
    }
  }
])
```

## Revenue Analysis

### 3. Revenue by Function
```javascript
// Calculate total revenue by function
db.registrations.aggregate([
  {
    $match: {
      "payment.status": "paid"
    }
  },
  {
    $group: {
      _id: "$functionId",
      totalRegistrations: { $sum: 1 },
      totalRevenue: { $sum: "$purchase.total" },
      avgOrderValue: { $avg: "$purchase.total" },
      totalTickets: {
        $sum: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$purchase.items",
                  cond: { $eq: ["$$this.productType", "ticket"] }
                }
              },
              in: "$$this.quantity"
            }
          }
        }
      }
    }
  },
  {
    $lookup: {
      from: "functions",
      localField: "_id",
      foreignField: "functionId",
      as: "function"
    }
  },
  {
    $unwind: "$function"
  },
  {
    $project: {
      functionId: "$_id",
      functionName: "$function.name",
      revenue: {
        total: "$totalRevenue",
        average: { $round: ["$avgOrderValue", 2] },
        registrations: "$totalRegistrations",
        tickets: "$totalTickets"
      }
    }
  },
  {
    $sort: { "revenue.total": -1 }
  }
])
```

### 4. Registration Type Analysis
```javascript
// Analyze registration patterns and revenue by type
db.registrations.aggregate([
  {
    $match: {
      "payment.status": "paid"
    }
  },
  {
    $group: {
      _id: {
        functionId: "$functionId",
        type: "$type"
      },
      count: { $sum: 1 },
      totalRevenue: { $sum: "$purchase.total" },
      avgRevenue: { $avg: "$purchase.total" },
      totalAttendees: { $sum: { $size: "$attendeeIds" } },
      avgAttendeesPerRegistration: { $avg: { $size: "$attendeeIds" } }
    }
  },
  {
    $group: {
      _id: "$_id.functionId",
      types: {
        $push: {
          type: "$_id.type",
          metrics: {
            count: "$count",
            revenue: "$totalRevenue",
            avgRevenue: { $round: ["$avgRevenue", 2] },
            attendees: "$totalAttendees",
            avgAttendees: { $round: ["$avgAttendeesPerRegistration", 1] }
          }
        }
      },
      totals: {
        registrations: { $sum: "$count" },
        revenue: { $sum: "$totalRevenue" },
        attendees: { $sum: "$totalAttendees" }
      }
    }
  }
])
```

### 3. Product Sales Report
```javascript
// Detailed product sales across all registrations
db.registrations.aggregate([
  {
    $match: {
      "payment.status": "paid"
    }
  },
  { $unwind: "$purchase.items" },
  {
    $group: {
      _id: {
        productId: "$purchase.items.productId",
        productType: "$purchase.items.productType",
        productName: "$purchase.items.name"
      },
      quantitySold: { $sum: "$purchase.items.quantity" },
      totalRevenue: { $sum: "$purchase.items.total" },
      avgPrice: { $avg: "$purchase.items.unitPrice" },
      registrationCount: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      product: {
        id: "$_id.productId",
        type: "$_id.productType",
        name: "$_id.productName"
      },
      sales: {
        quantity: "$quantitySold",
        revenue: "$totalRevenue",
        avgPrice: { $round: ["$avgPrice", 2] },
        orders: "$registrationCount"
      }
    }
  },
  {
    $sort: { "sales.revenue": -1 }
  }
])
```

## Status and Workflow

### 4. Incomplete Registrations Report
```javascript
// Find registrations needing attention
db.registrations.aggregate([
  {
    $match: {
      status: { $in: ["pending", "partial"] }
    }
  },
  {
    $project: {
      registrationNumber: 1,
      functionId: 1,
      type: 1,
      registrant: "$registrant.name",
      status: 1,
      issue: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$payment.status", "pending"] },
              then: "Awaiting payment"
            },
            {
              case: { $gt: ["$attendeeAllocation.unassigned", 0] },
              then: "Unassigned attendees"
            },
            {
              case: { $eq: ["$communications.confirmationSent", false] },
              then: "Confirmation not sent"
            }
          ],
          default: "Other"
        }
      },
      daysOld: {
        $divide: [
          { $subtract: [new Date(), "$metadata.createdAt"] },
          1000 * 60 * 60 * 24
        ]
      },
      totalValue: "$purchase.total"
    }
  },
  {
    $sort: { daysOld: -1 }
  }
])
```

### 5. Attendee Assignment Status
```javascript
// Track attendee assignment progress for bulk registrations
db.registrations.aggregate([
  {
    $match: {
      type: { $in: ["lodge", "delegation"] },
      "attendeeAllocation.unassigned": { $gt: 0 }
    }
  },
  {
    $project: {
      registrationNumber: 1,
      functionId: 1,
      registrant: "$registrant.name",
      allocation: {
        total: "$attendeeAllocation.total",
        assigned: "$attendeeAllocation.assigned",
        unassigned: "$attendeeAllocation.unassigned",
        percentComplete: {
          $multiply: [
            { $divide: ["$attendeeAllocation.assigned", "$attendeeAllocation.total"] },
            100
          ]
        }
      },
      lastUpdated: "$metadata.updatedAt"
    }
  },
  {
    $sort: { "allocation.percentComplete": 1 }
  }
])
```

## Customer Analysis

### 6. Top Customers
```javascript
// Identify top customers by spend
db.registrations.aggregate([
  {
    $match: {
      "payment.status": "paid"
    }
  },
  {
    $group: {
      _id: "$registrant.id",
      customerName: { $first: "$registrant.name" },
      customerType: { $first: "$registrant.type" },
      totalOrders: { $sum: 1 },
      totalSpent: { $sum: "$purchase.total" },
      totalAttendees: { $sum: { $size: "$attendeeIds" } },
      functions: { $addToSet: "$functionId" },
      firstPurchase: { $min: "$metadata.createdAt" },
      lastPurchase: { $max: "$metadata.createdAt" }
    }
  },
  {
    $project: {
      customer: {
        id: "$_id",
        name: "$customerName",
        type: "$customerType"
      },
      metrics: {
        orders: "$totalOrders",
        revenue: "$totalSpent",
        avgOrderValue: { $divide: ["$totalSpent", "$totalOrders"] },
        attendees: "$totalAttendees",
        functionsAttended: { $size: "$functions" }
      },
      activity: {
        firstPurchase: "$firstPurchase",
        lastPurchase: "$lastPurchase",
        lifetimeValue: "$totalSpent"
      }
    }
  },
  {
    $sort: { "metrics.revenue": -1 }
  },
  {
    $limit: 50
  }
])
```

### 7. Repeat Customer Analysis
```javascript
// Analyze repeat purchase behavior
db.registrations.aggregate([
  {
    $match: {
      "payment.status": "paid"
    }
  },
  {
    $group: {
      _id: "$registrant.id",
      orderCount: { $sum: 1 },
      functions: { $addToSet: "$functionId" }
    }
  },
  {
    $group: {
      _id: "$orderCount",
      customerCount: { $sum: 1 },
      avgFunctionsAttended: { $avg: { $size: "$functions" } }
    }
  },
  {
    $project: {
      _id: 0,
      orderFrequency: "$_id",
      customers: "$customerCount",
      avgFunctionsPerCustomer: { $round: ["$avgFunctionsAttended", 1] }
    }
  },
  {
    $sort: { orderFrequency: 1 }
  }
])
```

## Financial Analysis

### 8. Payment Method Distribution
```javascript
// Analyze payment methods and their success rates
db.registrations.aggregate([
  {
    $group: {
      _id: {
        method: "$payment.method",
        status: "$payment.status"
      },
      count: { $sum: 1 },
      totalAmount: { $sum: "$purchase.total" }
    }
  },
  {
    $group: {
      _id: "$_id.method",
      statuses: {
        $push: {
          status: "$_id.status",
          count: "$count",
          amount: "$totalAmount"
        }
      },
      totalTransactions: { $sum: "$count" },
      totalAmount: { $sum: "$totalAmount" }
    }
  },
  {
    $project: {
      paymentMethod: "$_id",
      summary: {
        transactions: "$totalTransactions",
        amount: "$totalAmount",
        avgTransaction: { $divide: ["$totalAmount", "$totalTransactions"] }
      },
      breakdown: "$statuses",
      successRate: {
        $multiply: [
          {
            $divide: [
              {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: "$statuses",
                        cond: { $eq: ["$$this.status", "paid"] }
                      }
                    }
                  },
                  { count: 0 }
                ]
              },
              "$totalTransactions"
            ]
          },
          100
        ]
      }
    }
  }
])
```

### 9. Discount Analysis
```javascript
// Analyze discount usage and impact
db.registrations.aggregate([
  {
    $match: {
      "purchase.discountTotal": { $gt: 0 }
    }
  },
  { $unwind: "$purchase.items" },
  {
    $match: {
      "purchase.items.discount.amount": { $gt: 0 }
    }
  },
  {
    $group: {
      _id: "$purchase.items.discount.code",
      usageCount: { $sum: 1 },
      totalDiscount: { $sum: "$purchase.items.discount.amount" },
      totalRevenue: { $sum: "$purchase.items.total" },
      avgDiscountPercent: { $avg: "$purchase.items.discount.percentage" }
    }
  },
  {
    $project: {
      discountCode: { $ifNull: ["$_id", "No Code"] },
      usage: {
        count: "$usageCount",
        totalDiscountGiven: "$totalDiscount",
        revenueGenerated: "$totalRevenue",
        avgDiscountPercent: { $round: ["$avgDiscountPercent", 1] }
      },
      impact: {
        revenueWithoutDiscount: { $add: ["$totalRevenue", "$totalDiscount"] },
        conversionValue: {
          $subtract: ["$totalRevenue", { $multiply: ["$totalDiscount", 0.5] }]
        }
      }
    }
  },
  {
    $sort: { "usage.totalDiscountGiven": -1 }
  }
])
```

## Time-Based Analysis

### 10. Daily Registration Trends
```javascript
// Analyze registration patterns by day
db.registrations.aggregate([
  {
    $match: {
      "metadata.createdAt": {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    }
  },
  {
    $group: {
      _id: {
        date: { $dateToString: { format: "%Y-%m-%d", date: "$metadata.createdAt" } },
        dayOfWeek: { $dayOfWeek: "$metadata.createdAt" }
      },
      registrations: { $sum: 1 },
      revenue: { $sum: "$purchase.total" },
      avgOrderValue: { $avg: "$purchase.total" }
    }
  },
  {
    $sort: { "_id.date": 1 }
  },
  {
    $project: {
      date: "$_id.date",
      dayOfWeek: {
        $switch: {
          branches: [
            { case: { $eq: ["$_id.dayOfWeek", 1] }, then: "Sunday" },
            { case: { $eq: ["$_id.dayOfWeek", 2] }, then: "Monday" },
            { case: { $eq: ["$_id.dayOfWeek", 3] }, then: "Tuesday" },
            { case: { $eq: ["$_id.dayOfWeek", 4] }, then: "Wednesday" },
            { case: { $eq: ["$_id.dayOfWeek", 5] }, then: "Thursday" },
            { case: { $eq: ["$_id.dayOfWeek", 6] }, then: "Friday" },
            { case: { $eq: ["$_id.dayOfWeek", 7] }, then: "Saturday" }
          ]
        }
      },
      metrics: {
        registrations: "$registrations",
        revenue: "$revenue",
        avgOrderValue: { $round: ["$avgOrderValue", 2] }
      }
    }
  }
])
```