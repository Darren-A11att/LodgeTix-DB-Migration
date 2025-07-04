# Functions Collection - Additional Aggregation Pipelines

## 7. Update Financial Summary from Transactions

```javascript
// Updates function financial summary from financial transactions collection
db.functions.aggregate([
  {
    $lookup: {
      from: "financialTransactions",
      let: { functionId: "$functionId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$reference.functionId", "$$functionId"] },
            "payments.status": "succeeded"
          }
        },
        {
          $group: {
            _id: null,
            totalRegistrations: {
              $sum: { $cond: [{ $eq: ["$type", "registration_payment"] }, 1, 0] }
            },
            grossRevenue: {
              $sum: { $cond: [{ $eq: ["$type", "registration_payment"] }, "$amounts.gross", 0] }
            },
            processingFees: {
              $sum: { $cond: [{ $eq: ["$type", "registration_payment"] }, "$amounts.fees", 0] }
            },
            taxCollected: {
              $sum: { $cond: [{ $eq: ["$type", "registration_payment"] }, "$amounts.tax", 0] }
            },
            refundsIssued: {
              $sum: { $cond: [{ $eq: ["$type", "refund"] }, { $abs: "$amounts.total" }, 0] }
            },
            transactionCount: { $sum: 1 },
            firstTransaction: { $min: "$audit.createdAt" },
            lastTransaction: { $max: "$audit.createdAt" }
          }
        }
      ],
      as: "financialData"
    }
  },
  {
    $lookup: {
      from: "tickets",
      let: { functionId: "$functionId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$function.functionId", "$$functionId"] }
          }
        },
        { $count: "totalTickets" }
      ],
      as: "ticketData"
    }
  },
  {
    $addFields: {
      "financial_summary.actuals": {
        total_registrations: { $ifNull: [{ $first: "$financialData.totalRegistrations" }, 0] },
        total_tickets_sold: { $ifNull: [{ $first: "$ticketData.totalTickets" }, 0] },
        gross_revenue: { $ifNull: [{ $first: "$financialData.grossRevenue" }, 0] },
        net_revenue: {
          $subtract: [
            { $ifNull: [{ $first: "$financialData.grossRevenue" }, 0] },
            { $add: [
              { $ifNull: [{ $first: "$financialData.processingFees" }, 0] },
              { $ifNull: [{ $first: "$financialData.refundsIssued" }, 0] }
            ]}
          ]
        },
        processing_fees: { $ifNull: [{ $first: "$financialData.processingFees" }, 0] },
        tax_collected: { $ifNull: [{ $first: "$financialData.taxCollected" }, 0] },
        refunds_issued: { $ifNull: [{ $first: "$financialData.refundsIssued" }, 0] },
        lastUpdated: new Date()
      },
      "financial_summary.transactionCount": { $ifNull: [{ $first: "$financialData.transactionCount" }, 0] },
      "financial_summary.firstTransactionDate": { $first: "$financialData.firstTransaction" },
      "financial_summary.lastTransactionDate": { $first: "$financialData.lastTransaction" }
    }
  },
  {
    $project: {
      financialData: 0,
      ticketData: 0
    }
  },
  {
    $merge: {
      into: "functions",
      on: "_id",
      whenMatched: "merge",
      whenNotMatched: "discard"
    }
  }
])
```

## 8. Product Sales Performance

```javascript
// Analyze product performance across all functions
db.functions.aggregate([
  { $unwind: "$events" },
  { $unwind: "$events.products" },
  {
    $lookup: {
      from: "tickets",
      let: { 
        functionId: "$functionId",
        eventId: "$events.event_id",
        productId: "$events.products._id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$function.functionId", "$$functionId"] },
                { $eq: ["$event.eventId", "$$eventId"] },
                { $eq: ["$product.productId", "$$productId"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            sold: { $sum: 1 },
            revenue: { $sum: "$pricing.paidPrice" }
          }
        }
      ],
      as: "salesData"
    }
  },
  {
    $project: {
      functionId: 1,
      functionName: "$name",
      eventId: "$events.event_id",
      eventName: "$events.name",
      product: {
        id: "$events.products._id",
        sku: "$events.products.sku",
        name: "$events.products.name",
        type: "$events.products.type",
        price: "$events.products.price.amount"
      },
      inventory: {
        max: "$events.products.inventory.max",
        sold: { $ifNull: [{ $first: "$salesData.sold" }, 0] },
        available: "$events.products.inventory.allocated.available",
        percentSold: {
          $multiply: [
            { $divide: [
              { $ifNull: [{ $first: "$salesData.sold" }, 0] },
              "$events.products.inventory.max"
            ]},
            100
          ]
        }
      },
      revenue: { $ifNull: [{ $first: "$salesData.revenue" }, 0] }
    }
  },
  {
    $sort: { "inventory.percentSold": -1 }
  }
])
```

## 9. Registration Type Distribution

```javascript
// Analyze registration patterns by type
db.functions.aggregate([
  {
    $lookup: {
      from: "registrations",
      localField: "functionId",
      foreignField: "functionId",
      as: "registrations"
    }
  },
  {
    $unwind: "$registrations"
  },
  {
    $group: {
      _id: {
        functionId: "$functionId",
        registrationType: "$registrations.type"
      },
      functionName: { $first: "$name" },
      count: { $sum: 1 },
      totalTickets: { $sum: { $size: "$registrations.attendeeIds" } },
      totalRevenue: { $sum: "$registrations.purchase.total" }
    }
  },
  {
    $group: {
      _id: "$_id.functionId",
      functionName: { $first: "$functionName" },
      registrationTypes: {
        $push: {
          type: "$_id.registrationType",
          count: "$count",
          tickets: "$totalTickets",
          revenue: "$totalRevenue",
          avgTicketsPerRegistration: { $divide: ["$totalTickets", "$count"] }
        }
      },
      totals: {
        registrations: { $sum: "$count" },
        tickets: { $sum: "$totalTickets" },
        revenue: { $sum: "$totalRevenue" }
      }
    }
  }
])
```

## 10. Available Inventory Report

```javascript
// Real-time inventory availability across all functions
db.functions.aggregate([
  {
    $match: {
      "dates.closedDate": { $gte: new Date() },
      "dates.onSaleDate": { $lte: new Date() }
    }
  },
  { $unwind: "$events" },
  { $unwind: "$events.products" },
  {
    $match: {
      "events.products.status": "active",
      "events.settings.published": true
    }
  },
  {
    $project: {
      functionId: 1,
      functionName: "$name",
      eventId: "$events.event_id",
      eventName: "$events.name",
      eventDate: "$events.dates.eventStart",
      product: {
        id: "$events.products._id",
        name: "$events.products.name",
        type: "$events.products.type",
        price: "$events.products.price.amount"
      },
      availability: {
        total: "$events.products.inventory.max",
        available: "$events.products.inventory.allocated.available",
        reserved: "$events.products.inventory.allocated.reserved",
        sold: "$events.products.inventory.allocated.sold",
        percentAvailable: {
          $multiply: [
            { $divide: [
              "$events.products.inventory.allocated.available",
              "$events.products.inventory.max"
            ]},
            100
          ]
        }
      }
    }
  },
  {
    $match: {
      "availability.available": { $gt: 0 }
    }
  },
  {
    $sort: {
      eventDate: 1,
      "availability.percentAvailable": 1
    }
  }
])
```

## 11. Merchandise Sales Summary

```javascript
// Analyze non-ticket product sales
db.functions.aggregate([
  {
    $match: {
      merchandise: { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$merchandise" },
  {
    $lookup: {
      from: "registrations",
      let: { 
        functionId: "$functionId",
        productId: "$merchandise._id"
      },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$functionId", "$$functionId"] }
          }
        },
        { $unwind: "$purchase.items" },
        {
          $match: {
            $expr: { 
              $and: [
                { $eq: ["$purchase.items.productId", "$$productId"] },
                { $eq: ["$purchase.items.productType", "merchandise"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            quantity: { $sum: "$purchase.items.quantity" },
            revenue: { $sum: "$purchase.items.total" }
          }
        }
      ],
      as: "merchandiseSales"
    }
  },
  {
    $project: {
      functionId: 1,
      functionName: "$name",
      merchandise: {
        id: "$merchandise._id",
        sku: "$merchandise.sku",
        name: "$merchandise.name",
        price: "$merchandise.price.amount"
      },
      sales: {
        quantity: { $ifNull: [{ $first: "$merchandiseSales.quantity" }, 0] },
        revenue: { $ifNull: [{ $first: "$merchandiseSales.revenue" }, 0] }
      },
      inventory: {
        max: "$merchandise.inventory.max",
        available: "$merchandise.inventory.allocated.available"
      }
    }
  },
  {
    $group: {
      _id: "$functionId",
      functionName: { $first: "$functionName" },
      merchandiseItems: { $push: "$$ROOT.merchandise" },
      totalQuantity: { $sum: "$sales.quantity" },
      totalRevenue: { $sum: "$sales.revenue" }
    }
  }
])
```