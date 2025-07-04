# Contacts Collection Aggregations

## Contact Search and Enrichment

### 1. Search Contacts with Roles
```javascript
// Search contacts by name, email, or role
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { "profile.firstName": { $regex: "searchTerm", $options: "i" } },
        { "profile.lastName": { $regex: "searchTerm", $options: "i" } },
        { "profile.email": { $regex: "searchTerm", $options: "i" } },
        { "roles.role": "searchRole" }
      ]
    }
  },
  {
    $addFields: {
      fullName: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      displayName: {
        $cond: [
          { $ne: ["$profile.preferredName", null] },
          { $concat: ["$profile.preferredName", " ", "$profile.lastName"] },
          { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
        ]
      },
      activeRoles: {
        $filter: {
          input: "$roles",
          cond: {
            $or: [
              { $eq: ["$$this.endDate", null] },
              { $gte: ["$$this.endDate", new Date()] }
            ]
          }
        }
      },
      orderCount: { $size: { $ifNull: ["$orderReferences", []] } }
    }
  },
  {
    $project: {
      contactNumber: 1,
      fullName: 1,
      displayName: 1,
      email: "$profile.email",
      phone: "$profile.phone",
      activeRoles: 1,
      orderCount: 1
    }
  },
  { $limit: 20 }
])
```

### 2. Get Contact with Full Profile
```javascript
// Retrieve complete contact information with all relationships
db.contacts.aggregate([
  { $match: { _id: ObjectId("contactId") } },
  
  // Lookup user account
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userAccount"
    }
  },
  
  // Lookup related contacts
  {
    $lookup: {
      from: "contacts",
      localField: "relationships.contactId",
      foreignField: "_id",
      as: "relatedContacts"
    }
  },
  
  // Lookup orders
  {
    $lookup: {
      from: "orders",
      localField: "orderReferences.orderId",
      foreignField: "_id",
      as: "orders"
    }
  },
  
  // Format output
  {
    $project: {
      contactNumber: 1,
      profile: 1,
      addresses: 1,
      masonicProfile: 1,
      
      userAccount: {
        $arrayElemAt: [
          {
            $map: {
              input: "$userAccount",
              in: {
                email: "$$this.email",
                status: "$$this.status",
                lastLogin: "$$this.authentication.lastLogin"
              }
            }
          },
          0
        ]
      },
      
      activeRoles: {
        $filter: {
          input: "$roles",
          cond: {
            $or: [
              { $eq: ["$$this.endDate", null] },
              { $gte: ["$$this.endDate", new Date()] }
            ]
          }
        }
      },
      
      relationships: {
        $map: {
          input: "$relationships",
          as: "rel",
          in: {
            $mergeObjects: [
              "$$rel",
              {
                contact: {
                  $let: {
                    vars: {
                      related: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$relatedContacts",
                              cond: { $eq: ["$$this._id", "$$rel.contactId"] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: {
                      contactNumber: "$$related.contactNumber",
                      name: {
                        $concat: [
                          "$$related.profile.firstName",
                          " ",
                          "$$related.profile.lastName"
                        ]
                      },
                      email: "$$related.profile.email",
                      phone: "$$related.profile.phone"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      
      orderSummary: {
        total: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totals.total" },
        lastOrderDate: { $max: "$orders.metadata.createdAt" }
      }
    }
  }
])
```

## Role-Based Analytics

### 3. Function Attendees Report
```javascript
// Get all attendees for a specific function
db.contacts.aggregate([
  {
    $match: {
      "roles.context": "function",
      "roles.contextId": ObjectId("functionId"),
      "roles.role": "attendee"
    }
  },
  {
    $unwind: "$roles"
  },
  {
    $match: {
      "roles.context": "function",
      "roles.contextId": ObjectId("functionId"),
      "roles.role": "attendee"
    }
  },
  {
    $lookup: {
      from: "orders",
      let: { contactId: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$catalogObjectId", ObjectId("functionId")] },
                {
                  $in: [
                    "$$contactId",
                    {
                      $map: {
                        input: "$lineItems",
                        as: "item",
                        in: "$$item.owner.contactId"
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      ],
      as: "orderInfo"
    }
  },
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      email: "$profile.email",
      phone: "$profile.phone",
      dietaryRequirements: "$profile.dietaryRequirements",
      specialNeeds: "$profile.specialNeeds",
      roleStartDate: "$roles.startDate",
      orderNumber: { $arrayElemAt: ["$orderInfo.orderNumber", 0] },
      ticketType: "extracted_from_order_items"
    }
  },
  {
    $sort: { name: 1 }
  }
])
```

### 4. Organisation Members with Roles
```javascript
// List all members of an organisation with their roles
db.contacts.aggregate([
  {
    $match: {
      "roles.context": "organisation",
      "roles.contextId": ObjectId("orgId")
    }
  },
  {
    $addFields: {
      orgRoles: {
        $filter: {
          input: "$roles",
          cond: {
            $and: [
              { $eq: ["$$this.context", "organisation"] },
              { $eq: ["$$this.contextId", ObjectId("orgId")] },
              {
                $or: [
                  { $eq: ["$$this.endDate", null] },
                  { $gte: ["$$this.endDate", new Date()] }
                ]
              }
            ]
          }
        }
      }
    }
  },
  {
    $unwind: "$orgRoles"
  },
  {
    $group: {
      _id: "$orgRoles.role",
      count: { $sum: 1 },
      members: {
        $push: {
          contactNumber: "$contactNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          email: "$profile.email",
          startDate: "$orgRoles.startDate",
          permissions: "$orgRoles.permissions"
        }
      }
    }
  },
  {
    $sort: { _id: 1 }
  }
])
```

## Order History Analysis

### 5. Contact Purchase History
```javascript
// Get complete purchase history for a contact
db.contacts.aggregate([
  { $match: { _id: ObjectId("contactId") } },
  { $unwind: "$orderReferences" },
  {
    $lookup: {
      from: "orders",
      localField: "orderReferences.orderId",
      foreignField: "_id",
      as: "orderDetails"
    }
  },
  { $unwind: "$orderDetails" },
  {
    $lookup: {
      from: "catalogObjects",
      localField: "orderDetails.catalogObjectId",
      foreignField: "_id",
      as: "catalogObject"
    }
  },
  {
    $project: {
      contactNumber: 1,
      orderNumber: "$orderReferences.orderNumber",
      orderDate: "$orderDetails.metadata.createdAt",
      orderStatus: "$orderDetails.status",
      role: "$orderReferences.role",
      functionName: { $arrayElemAt: ["$catalogObject.name", 0] },
      
      items: {
        $filter: {
          input: "$orderDetails.lineItems",
          cond: {
            $or: [
              { $eq: ["$$this.owner.contactId", "$_id"] },
              { $eq: ["$orderReferences.role", "purchaser"] }
            ]
          }
        }
      },
      
      orderTotal: "$orderDetails.totals.total",
      paymentStatus: "$orderDetails.payment.status"
    }
  },
  {
    $group: {
      _id: "$_id",
      contactNumber: { $first: "$contactNumber" },
      orders: {
        $push: {
          orderNumber: "$orderNumber",
          orderDate: "$orderDate",
          functionName: "$functionName",
          role: "$role",
          items: "$items",
          total: "$orderTotal"
        }
      },
      totalOrders: { $sum: 1 },
      totalSpent: {
        $sum: {
          $cond: [
            { $eq: ["$role", "purchaser"] },
            "$orderTotal",
            0
          ]
        }
      }
    }
  }
])
```

### 6. Top Purchasers Report
```javascript
// Find top purchasers by total spend
db.contacts.aggregate([
  { $unwind: "$orderReferences" },
  { $match: { "orderReferences.role": "purchaser" } },
  {
    $lookup: {
      from: "orders",
      localField: "orderReferences.orderId",
      foreignField: "_id",
      as: "order"
    }
  },
  { $unwind: "$order" },
  { $match: { "order.status": { $in: ["paid", "partially_paid"] } } },
  {
    $group: {
      _id: "$_id",
      contactNumber: { $first: "$contactNumber" },
      name: { 
        $first: { $concat: ["$profile.firstName", " ", "$profile.lastName"] } 
      },
      email: { $first: "$profile.email" },
      totalOrders: { $sum: 1 },
      totalSpent: { $sum: "$order.totals.total" },
      firstPurchase: { $min: "$order.metadata.createdAt" },
      lastPurchase: { $max: "$order.metadata.createdAt" }
    }
  },
  {
    $addFields: {
      avgOrderValue: {
        $round: [{ $divide: ["$totalSpent", "$totalOrders"] }, 2]
      },
      customerLifetime: {
        $divide: [
          { $subtract: ["$lastPurchase", "$firstPurchase"] },
          1000 * 60 * 60 * 24 // Days
        ]
      }
    }
  },
  {
    $sort: { totalSpent: -1 }
  },
  {
    $limit: 100
  }
])
```

## Lodge Analytics

### 7. Lodge Members with Ranks and Roles
```javascript
// Analyze lodge membership with their various roles
db.contacts.aggregate([
  { 
    $match: { 
      "masonicProfile.craft.lodge.organisationId": ObjectId("lodgeOrgId") 
    } 
  },
  {
    $addFields: {
      functionRoles: {
        $filter: {
          input: "$roles",
          cond: { $eq: ["$$this.context", "function"] }
        }
      },
      organisationRoles: {
        $filter: {
          input: "$roles",
          cond: { 
            $and: [
              { $eq: ["$$this.context", "organisation"] },
              { $eq: ["$$this.contextId", ObjectId("lodgeOrgId")] }
            ]
          }
        }
      }
    }
  },
  {
    $group: {
      _id: "$masonicProfile.craft.rank",
      count: { $sum: 1 },
      members: {
        $push: {
          contactNumber: "$contactNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          title: "$masonicProfile.craft.title",
          email: "$profile.email",
          lodgeRoles: "$organisationRoles",
          eventAttendance: { $size: "$functionRoles" },
          totalOrders: { $size: { $ifNull: ["$orderReferences", []] } }
        }
      }
    }
  },
  {
    $sort: { _id: 1 }
  }
])
```

## Relationship Analysis

### 8. Emergency Contact Network
```javascript
// Map emergency contact relationships
db.contacts.aggregate([
  { $unwind: "$relationships" },
  { $match: { "relationships.isEmergencyContact": true } },
  {
    $lookup: {
      from: "contacts",
      localField: "relationships.contactId",
      foreignField: "_id",
      as: "emergencyContact"
    }
  },
  { $unwind: "$emergencyContact" },
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      hasActiveOrders: {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$orderReferences", []] },
                cond: { $eq: ["$$this.role", "attendee"] }
              }
            }
          },
          0
        ]
      },
      emergencyContact: {
        name: { 
          $concat: [
            "$emergencyContact.profile.firstName", 
            " ", 
            "$emergencyContact.profile.lastName"
          ] 
        },
        phone: "$emergencyContact.profile.phone",
        email: "$emergencyContact.profile.email",
        relationship: "$relationships.relationshipType"
      }
    }
  },
  {
    $match: { hasActiveOrders: true }
  }
])
```

## Data Quality

### 9. Duplicate Detection by Email/Phone
```javascript
// Find potential duplicate contacts
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { "profile.email": { $ne: null } },
        { "profile.phone": { $ne: null } }
      ]
    }
  },
  {
    $group: {
      _id: {
        email: { $toLower: "$profile.email" },
        phone: "$profile.phone"
      },
      count: { $sum: 1 },
      contacts: {
        $push: {
          _id: "$_id",
          contactNumber: "$contactNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          createdAt: "$metadata.createdAt",
          hasUser: { $ne: ["$userId", null] },
          orderCount: { $size: { $ifNull: ["$orderReferences", []] } }
        }
      }
    }
  },
  {
    $match: { 
      count: { $gt: 1 },
      "_id.email": { $ne: null }
    }
  },
  {
    $project: {
      duplicateKey: "$_id",
      duplicateCount: "$count",
      contacts: 1,
      recommendation: {
        $cond: [
          { $gt: [{ $size: { $filter: { input: "$contacts", cond: "$$this.hasUser" } } }, 0] },
          "Keep contact with user account",
          "Keep contact with most orders"
        ]
      }
    }
  },
  {
    $sort: { duplicateCount: -1 }
  }
])
```

### 10. Contacts Missing Critical Data
```javascript
// Identify contacts needing data completion
db.contacts.aggregate([
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      
      issues: {
        $concatArrays: [
          {
            $cond: [
              { $and: [
                { $eq: ["$profile.email", null] },
                { $eq: ["$profile.phone", null] }
              ]},
              ["No contact method"],
              []
            ]
          },
          {
            $cond: [
              { $eq: [{ $size: { $ifNull: ["$addresses", []] } }, 0] },
              ["No address"],
              []
            ]
          },
          {
            $cond: [
              { $and: [
                { $gt: [{ $size: { $ifNull: ["$orderReferences", []] } }, 0] },
                { $eq: ["$profile.dateOfBirth", null] }
              ]},
              ["Has orders but no date of birth"],
              []
            ]
          },
          {
            $cond: [
              { $and: [
                { $ne: ["$userId", null] },
                { $eq: ["$profile.email", null] }
              ]},
              ["Has user account but no email"],
              []
            ]
          }
        ]
      },
      
      hasActiveRole: {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$roles", []] },
                cond: {
                  $or: [
                    { $eq: ["$$this.endDate", null] },
                    { $gte: ["$$this.endDate", new Date()] }
                  ]
                }
              }
            }
          },
          0
        ]
      }
    }
  },
  {
    $match: {
      $and: [
        { "issues.0": { $exists: true } },
        { hasActiveRole: true }
      ]
    }
  },
  {
    $project: {
      contactNumber: 1,
      name: 1,
      issues: 1,
      issueCount: { $size: "$issues" }
    }
  },
  {
    $sort: { issueCount: -1 }
  }
])
```