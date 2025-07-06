# Organizations Collection Aggregations

## Registration Form Queries

### Get Organizations for Invoice Dropdown
```javascript
db.organizations.aggregate([
  { 
    $match: { 
      status: "active",
      type: { $in: ["lodge", "grandlodge"] }
    }
  },
  {
    $project: {
      _id: 0,
      value: "$organizationId",
      label: "$name",
      type: 1,
      billingEmail: 1,
      paymentTerms: 1
    }
  },
  { $sort: { name: 1 } }
])
```

### Get Lodge Organization Details
```javascript
db.organizations.aggregate([
  { 
    $match: { 
      lodgeId: "7f4e9b2a-1234-5678-9012-3456789abcde"
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      contactEmail: 1,
      billingEmail: 1,
      paymentTerms: 1,
      preferredPaymentMethod: 1,
      address: 1
    }
  }
])
```

## Event Host Queries

### Active Event Hosts
```javascript
db.organizations.aggregate([
  {
    $match: {
      stripeAccountStatus: "connected",
      stripePayoutsEnabled: true,
      status: "active"
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      stripeAccountId: 1,
      eventsHosted: "$eventStats.eventsHosted"
    }
  },
  { $sort: { eventsHosted: -1 } }
])
```

## Financial Queries

### High Value Organizations
```javascript
db.organizations.aggregate([
  {
    $match: {
      status: "active",
      "eventStats.totalSpent": { $gt: 0 }
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      type: 1,
      totalSpent: "$eventStats.totalSpent",
      ticketsPurchased: "$eventStats.ticketsPurchased",
      avgTicketValue: {
        $divide: ["$eventStats.totalSpent", "$eventStats.ticketsPurchased"]
      },
      lastPurchase: "$eventStats.lastPurchaseDate"
    }
  },
  { $sort: { totalSpent: -1 } },
  { $limit: 50 }
])
```

### Organizations by Payment Method
```javascript
db.organizations.aggregate([
  {
    $group: {
      _id: "$preferredPaymentMethod",
      count: { $sum: 1 },
      organizations: {
        $push: {
          name: "$name",
          type: "$type"
        }
      }
    }
  },
  { $sort: { count: -1 } }
])
```

## Analytics Queries

### Organizations by Type
```javascript
db.organizations.aggregate([
  {
    $group: {
      _id: "$type",
      count: { $sum: 1 },
      totalSpent: { $sum: "$eventStats.totalSpent" },
      avgSpent: { $avg: "$eventStats.totalSpent" }
    }
  },
  {
    $project: {
      _id: 0,
      type: "$_id",
      count: 1,
      totalSpent: { $round: ["$totalSpent", 2] },
      avgSpent: { $round: ["$avgSpent", 2] }
    }
  },
  { $sort: { count: -1 } }
])
```

### Recent Purchasers
```javascript
db.organizations.aggregate([
  {
    $match: {
      "eventStats.lastPurchaseDate": {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
      }
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      lastPurchase: "$eventStats.lastPurchaseDate",
      recentSpend: "$eventStats.totalSpent",
      contactEmail: 1
    }
  },
  { $sort: { lastPurchase: -1 } },
  { $limit: 100 }
])
```

## Jurisdiction Analysis

### Organizations by Jurisdiction
```javascript
db.organizations.aggregate([
  {
    $match: {
      jurisdictionId: { $exists: true, $ne: null }
    }
  },
  {
    $lookup: {
      from: "jurisdictions",
      localField: "jurisdictionId",
      foreignField: "jurisdictionId",
      as: "jurisdiction"
    }
  },
  { $unwind: "$jurisdiction" },
  {
    $group: {
      _id: "$jurisdictionId",
      jurisdictionName: { $first: "$jurisdiction.name" },
      organizationCount: { $sum: 1 },
      totalSpent: { $sum: "$eventStats.totalSpent" },
      organizations: { $push: "$name" }
    }
  },
  { $sort: { organizationCount: -1 } }
])
```

## Data Quality Checks

### Organizations Missing Billing Info
```javascript
db.organizations.aggregate([
  {
    $match: {
      status: "active",
      $or: [
        { billingEmail: { $in: [null, ""] } },
        { address: null },
        { abn: { $in: [null, ""] } }
      ]
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      missingBillingEmail: { $in: ["$billingEmail", [null, ""]] },
      missingAddress: { $eq: ["$address", null] },
      missingABN: { $in: ["$abn", [null, ""]] }
    }
  }
])
```

### Lodges Without Jurisdiction Links
```javascript
db.organizations.aggregate([
  {
    $match: {
      type: "lodge",
      $or: [
        { jurisdictionId: null },
        { lodgeId: null }
      ]
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      missingJurisdiction: { $eq: ["$jurisdictionId", null] },
      missingLodgeId: { $eq: ["$lodgeId", null] }
    }
  }
])
```

## Search Queries

### Organization Search
```javascript
db.organizations.aggregate([
  {
    $match: {
      $text: { $search: "Ryde" }
    }
  },
  {
    $project: {
      _id: 0,
      organizationId: 1,
      name: 1,
      type: 1,
      contactEmail: 1,
      score: { $meta: "textScore" }
    }
  },
  { $sort: { score: { $meta: "textScore" } } },
  { $limit: 20 }
])
```

## Invoice Generation Support

### Get Organization for Invoice
```javascript
db.organizations.aggregate([
  {
    $match: {
      organizationId: "3e893fa6-2cc2-448c-be9c-e3858cc90e11"
    }
  },
  {
    $project: {
      _id: 0,
      // Billing entity details
      name: 1,
      abn: 1,
      gstRegistered: 1,
      
      // Billing contact
      billingContact: {
        email: { $ifNull: ["$billingEmail", "$contactEmail"] },
        phone: { $ifNull: ["$billingPhone", "$contactPhone"] }
      },
      
      // Billing address
      billingAddress: "$address",
      
      // Payment preferences
      paymentTerms: 1,
      purchaseOrderRequired: 1
    }
  }
])
```