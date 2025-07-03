# Financial Transactions Collection - Aggregation Pipelines

## Revenue Analysis

### 1. Function Revenue Summary
```javascript
// Get total revenue by function with breakdown
db.financialTransactions.aggregate([
  {
    $match: {
      type: { $in: ["registration_payment", "refund"] },
      "payments.status": "succeeded"
    }
  },
  {
    $group: {
      _id: "$reference.functionId",
      functionName: { $first: "$reference.functionName" },
      transactions: { $sum: 1 },
      grossRevenue: { $sum: "$amounts.gross" },
      processingFees: { $sum: "$amounts.fees" },
      taxCollected: { $sum: "$amounts.tax" },
      netRevenue: { $sum: "$amounts.net" },
      refunds: {
        $sum: {
          $cond: [{ $eq: ["$type", "refund"] }, "$amounts.total", 0]
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      functionId: "$_id",
      functionName: 1,
      transactions: 1,
      revenue: {
        gross: "$grossRevenue",
        fees: "$processingFees",
        tax: "$taxCollected",
        net: "$netRevenue",
        refunds: { $abs: "$refunds" },
        total: { $subtract: ["$netRevenue", { $abs: "$refunds" }] }
      }
    }
  },
  { $sort: { "revenue.total": -1 } }
])
```

### 2. Monthly Revenue Trend
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      type: "registration_payment",
      "payments.status": "succeeded"
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$payments.processedAt" },
        month: { $month: "$payments.processedAt" }
      },
      revenue: { $sum: "$amounts.gross" },
      fees: { $sum: "$amounts.fees" },
      transactions: { $sum: 1 },
      avgTransaction: { $avg: "$amounts.total" }
    }
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 }
  },
  {
    $project: {
      _id: 0,
      period: {
        $concat: [
          { $toString: "$_id.year" },
          "-",
          { $cond: [
            { $lt: ["$_id.month", 10] },
            { $concat: ["0", { $toString: "$_id.month" }] },
            { $toString: "$_id.month" }
          ]}
        ]
      },
      revenue: 1,
      fees: 1,
      transactions: 1,
      avgTransaction: { $round: ["$avgTransaction", 2] }
    }
  }
])
```

### 3. Customer Spending Analysis
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      type: "registration_payment",
      "payments.status": "succeeded"
    }
  },
  {
    $group: {
      _id: {
        customerId: "$parties.customer.id",
        customerType: "$parties.customer.type"
      },
      customerName: { $first: "$parties.customer.name" },
      totalSpent: { $sum: "$amounts.total" },
      transactions: { $sum: 1 },
      firstPurchase: { $min: "$audit.createdAt" },
      lastPurchase: { $max: "$audit.createdAt" },
      functions: { $addToSet: "$reference.functionId" }
    }
  },
  {
    $project: {
      _id: 0,
      customer: {
        id: "$_id.customerId",
        type: "$_id.customerType",
        name: "$customerName"
      },
      spending: {
        total: "$totalSpent",
        transactions: "$transactions",
        average: { $divide: ["$totalSpent", "$transactions"] },
        functionsAttended: { $size: "$functions" }
      },
      activity: {
        firstPurchase: "$firstPurchase",
        lastPurchase: "$lastPurchase",
        daysSinceLastPurchase: {
          $divide: [
            { $subtract: [new Date(), "$lastPurchase"] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    }
  },
  { $sort: { "spending.total": -1 } },
  { $limit: 100 }
])
```

## Reconciliation Reports

### 4. Unreconciled Transactions
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "reconciliation.status": "pending",
      "payments.status": "succeeded",
      "payments.processedAt": { 
        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
      }
    }
  },
  {
    $project: {
      transactionId: 1,
      reference: 1,
      customerName: "$parties.customer.name",
      amount: "$amounts.total",
      paymentDate: { $first: "$payments.processedAt" },
      daysOutstanding: {
        $divide: [
          { $subtract: [new Date(), { $first: "$payments.processedAt" }] },
          1000 * 60 * 60 * 24
        ]
      },
      gatewayRef: { $first: "$payments.gatewayTransactionId" }
    }
  },
  { $sort: { daysOutstanding: -1 } }
])
```

### 5. Daily Banking Summary
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "payments.processedAt": {
        $gte: ISODate("2024-08-01T00:00:00Z"),
        $lt: ISODate("2024-08-02T00:00:00Z")
      },
      "payments.status": "succeeded"
    }
  },
  {
    $unwind: "$payments"
  },
  {
    $group: {
      _id: {
        date: { $dateToString: { format: "%Y-%m-%d", date: "$payments.processedAt" } },
        gateway: "$payments.gateway",
        method: "$payments.method"
      },
      transactions: { $sum: 1 },
      totalAmount: { $sum: "$payments.amount" },
      fees: { $sum: "$payments.fees.amount" },
      netAmount: { $sum: { $subtract: ["$payments.amount", "$payments.fees.amount"] } }
    }
  },
  {
    $group: {
      _id: "$_id.date",
      gateways: {
        $push: {
          gateway: "$_id.gateway",
          method: "$_id.method",
          transactions: "$transactions",
          amount: "$totalAmount",
          fees: "$fees",
          net: "$netAmount"
        }
      },
      dailyTotal: { $sum: "$totalAmount" },
      dailyFees: { $sum: "$fees" },
      dailyNet: { $sum: "$netAmount" }
    }
  }
])
```

## Tax Reporting

### 6. GST/Tax Summary
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "audit.createdAt": {
        $gte: ISODate("2024-07-01T00:00:00Z"),
        $lt: ISODate("2024-10-01T00:00:00Z")
      },
      type: { $in: ["registration_payment", "refund"] }
    }
  },
  {
    $facet: {
      sales: [
        { $match: { type: "registration_payment" } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$amounts.gross" },
            gstCollected: { $sum: "$amounts.tax" },
            count: { $sum: 1 }
          }
        }
      ],
      refunds: [
        { $match: { type: "refund" } },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: { $abs: "$amounts.gross" } },
            gstRefunded: { $sum: { $abs: "$amounts.tax" } },
            count: { $sum: 1 }
          }
        }
      ]
    }
  },
  {
    $project: {
      period: "Q3 2024",
      sales: { $first: "$sales" },
      refunds: { $first: "$refunds" },
      netGST: {
        $subtract: [
          { $first: "$sales.gstCollected" },
          { $first: "$refunds.gstRefunded" }
        ]
      }
    }
  }
])
```

### 7. Invoice Register
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "invoices.customer.issuedDate": {
        $gte: ISODate("2024-08-01T00:00:00Z"),
        $lt: ISODate("2024-09-01T00:00:00Z")
      }
    }
  },
  {
    $project: {
      invoiceNumber: "$invoices.customer.invoiceNumber",
      issuedDate: "$invoices.customer.issuedDate",
      customerName: "$parties.customer.name",
      customerType: "$parties.customer.type",
      subtotal: "$invoices.customer.totals.subtotal",
      tax: "$invoices.customer.totals.tax",
      total: "$invoices.customer.totals.total",
      status: "$invoices.customer.status",
      paymentStatus: { $first: "$payments.status" }
    }
  },
  { $sort: { issuedDate: 1 } }
])
```

## Payment Analytics

### 8. Payment Method Distribution
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      type: "registration_payment",
      "payments.status": "succeeded"
    }
  },
  { $unwind: "$payments" },
  {
    $group: {
      _id: {
        method: "$payments.method",
        brand: "$payments.card.brand"
      },
      count: { $sum: 1 },
      totalAmount: { $sum: "$payments.amount" },
      avgAmount: { $avg: "$payments.amount" },
      totalFees: { $sum: "$payments.fees.amount" },
      avgFeeRate: {
        $avg: {
          $multiply: [
            { $divide: ["$payments.fees.amount", "$payments.amount"] },
            100
          ]
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id.method",
      brands: {
        $push: {
          brand: { $ifNull: ["$_id.brand", "N/A"] },
          count: "$count",
          total: "$totalAmount",
          fees: "$totalFees"
        }
      },
      methodTotal: { $sum: "$totalAmount" },
      methodCount: { $sum: "$count" },
      methodFees: { $sum: "$totalFees" }
    }
  },
  {
    $project: {
      _id: 0,
      paymentMethod: "$_id",
      summary: {
        transactions: "$methodCount",
        total: "$methodTotal",
        average: { $divide: ["$methodTotal", "$methodCount"] },
        fees: "$methodFees",
        feeRate: {
          $concat: [
            { $toString: {
              $round: [
                { $multiply: [
                  { $divide: ["$methodFees", "$methodTotal"] },
                  100
                ]},
                2
              ]
            }},
            "%"
          ]
        }
      },
      breakdown: "$brands"
    }
  }
])
```

### 9. Failed Payments Analysis
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "payments.status": "failed"
    }
  },
  {
    $unwind: "$payments"
  },
  {
    $match: {
      "payments.status": "failed"
    }
  },
  {
    $group: {
      _id: {
        reason: { $ifNull: ["$payments.metadata.failureReason", "Unknown"] },
        method: "$payments.method"
      },
      count: { $sum: 1 },
      totalAmount: { $sum: "$payments.amount" },
      customers: { $addToSet: "$parties.customer.id" }
    }
  },
  {
    $project: {
      _id: 0,
      failureReason: "$_id.reason",
      paymentMethod: "$_id.method",
      occurrences: "$count",
      impactedAmount: "$totalAmount",
      uniqueCustomers: { $size: "$customers" }
    }
  },
  { $sort: { occurrences: -1 } }
])
```

## Accounting Integration

### 10. Export Queue
```javascript
db.financialTransactions.aggregate([
  {
    $match: {
      "accounting.exported": false,
      "reconciliation.status": "reconciled"
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$audit.createdAt" },
        month: { $month: "$audit.createdAt" }
      },
      transactions: { $push: "$$ROOT" },
      count: { $sum: 1 },
      totalValue: { $sum: "$amounts.total" }
    }
  },
  {
    $project: {
      _id: 0,
      period: {
        $concat: [
          { $toString: "$_id.year" },
          "-",
          { $cond: [
            { $lt: ["$_id.month", 10] },
            { $concat: ["0", { $toString: "$_id.month" }] },
            { $toString: "$_id.month" }
          ]}
        ]
      },
      readyForExport: "$count",
      totalValue: "$totalValue",
      transactions: {
        $slice: ["$transactions", 5] // Sample of transactions
      }
    }
  }
])
```

### 11. Customer Type Breakdown
```javascript
// Analyze transaction distribution by customer type (organisation vs contact vs user)
db.financialTransactions.aggregate([
  {
    $match: {
      type: "registration_payment",
      "payments.status": "succeeded"
    }
  },
  {
    $group: {
      _id: "$parties.customer.type",
      count: { $sum: 1 },
      totalRevenue: { $sum: "$amounts.total" },
      avgTransaction: { $avg: "$amounts.total" },
      uniqueCustomers: { $addToSet: "$parties.customer.id" }
    }
  },
  {
    $project: {
      _id: 0,
      customerType: "$_id",
      metrics: {
        transactions: "$count",
        revenue: "$totalRevenue",
        avgTransactionValue: { $round: ["$avgTransaction", 2] },
        uniqueCustomers: { $size: "$uniqueCustomers" }
      },
      revenueShare: {
        $multiply: [
          { $divide: ["$totalRevenue", { $sum: "$totalRevenue" }] },
          100
        ]
      }
    }
  },
  { $sort: { "metrics.revenue": -1 } }
])
```

### 12. Contact Customer Details
```javascript
// Get transaction details for contact customers with their full profile
db.financialTransactions.aggregate([
  {
    $match: {
      "parties.customer.type": "contact",
      type: "registration_payment"
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "parties.customer.id",
      foreignField: "_id",
      as: "contactDetails"
    }
  },
  {
    $unwind: {
      path: "$contactDetails",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project: {
      transactionId: 1,
      reference: 1,
      amount: "$amounts.total",
      paymentDate: { $first: "$payments.processedAt" },
      customer: {
        id: "$parties.customer.id",
        name: "$parties.customer.name",
        email: "$parties.customer.email",
        // Enhanced details from contact record
        profile: "$contactDetails.profile",
        masonicProfile: "$contactDetails.masonicProfile",
        dietaryRequirements: "$contactDetails.profile.dietaryRequirements",
        specialNeeds: "$contactDetails.profile.specialNeeds"
      }
    }
  },
  { $sort: { paymentDate: -1 } }
])
```