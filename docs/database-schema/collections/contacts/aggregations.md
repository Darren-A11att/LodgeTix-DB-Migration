# Contacts Collection Aggregations

## Contact Search and Enrichment

### 1. Search Contacts
```javascript
// Search contacts by name, email, or phone
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { firstName: { $regex: "searchTerm", $options: "i" } },
        { lastName: { $regex: "searchTerm", $options: "i" } },
        { preferredName: { $regex: "searchTerm", $options: "i" } },
        { email: { $regex: "searchTerm", $options: "i" } },
        { phone: { $regex: "searchTerm", $options: "i" } }
      ]
    }
  },
  {
    $addFields: {
      fullName: { $concat: ["$firstName", " ", "$lastName"] },
      displayName: {
        $cond: [
          { $ne: ["$preferredName", null] },
          { $concat: ["$preferredName", " ", "$lastName"] },
          { $concat: ["$firstName", " ", "$lastName"] }
        ]
      },
      registrationCount: { $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } },
      organizationCount: { $size: { $objectToArray: { $ifNull: ["$organizations", {}] } } },
      hostingCount: { $size: { $objectToArray: { $ifNull: ["$hosting", {}] } } }
    }
  },
  {
    $project: {
      contactId: 1,
      fullName: 1,
      displayName: 1,
      email: 1,
      phone: 1,
      hasUserAccount: 1,
      registrationCount: 1,
      organizationCount: 1,
      hostingCount: 1
    }
  },
  { $limit: 20 }
])
```

### 2. Get Contact with Full Profile
```javascript
// Retrieve complete contact information
db.contacts.aggregate([
  { $match: { contactId: "550e8400-e29b-41d4-a716-446655440000" } },
  
  // Convert registrations object to array for processing
  {
    $addFields: {
      registrationsArray: { $objectToArray: { $ifNull: ["$registrations", {}] } },
      organizationsArray: { $objectToArray: { $ifNull: ["$organizations", {}] } },
      hostingArray: { $objectToArray: { $ifNull: ["$hosting", {}] } }
    }
  },
  
  // Lookup partner contacts
  {
    $lookup: {
      from: "contacts",
      let: { partnerIds: "$relationships.partners.contactId" },
      pipeline: [
        { $match: { $expr: { $in: ["$contactId", { $ifNull: ["$$partnerIds", []] }] } } },
        { $project: { contactId: 1, firstName: 1, lastName: 1, email: 1, phone: 1 } }
      ],
      as: "partnerContacts"
    }
  },
  
  // Format output
  {
    $project: {
      contactId: 1,
      personalInfo: {
        firstName: "$firstName",
        lastName: "$lastName",
        preferredName: "$preferredName",
        title: "$title",
        dateOfBirth: "$profile.dateOfBirth"
      },
      
      contactInfo: {
        email: "$email",
        phone: "$phone",
        mobile: "$mobile",
        alternatePhone: "$alternatePhone",
        address: "$address",
        preferredCommunication: "$profile.preferredCommunication"
      },
      
      masonicProfile: 1,
      
      eventParticipation: {
        $map: {
          input: "$registrationsArray",
          as: "reg",
          in: {
            registrationId: "$$reg.k",
            role: "$$reg.v.role",
            functionName: "$$reg.v.functionName",
            eventName: "$$reg.v.eventName",
            tableNumber: "$$reg.v.tableNumber",
            seatNumber: "$$reg.v.seatNumber",
            registeredAt: "$$reg.v.registeredAt"
          }
        }
      },
      
      organizationAffiliations: {
        $map: {
          input: "$organizationsArray",
          as: "org",
          in: {
            organizationId: "$$org.k",
            organizationName: "$$org.v.organizationName",
            role: "$$org.v.role",
            isCurrent: "$$org.v.isCurrent",
            startDate: "$$org.v.startDate"
          }
        }
      },
      
      eventsHosted: {
        $map: {
          input: "$hostingArray",
          as: "host",
          in: {
            functionId: "$$host.k",
            functionName: "$$host.v.functionName",
            role: "$$host.v.role",
            responsibilities: "$$host.v.responsibilities"
          }
        }
      },
      
      relationships: {
        partners: {
          $map: {
            input: "$relationships.partners",
            as: "partner",
            in: {
              $mergeObjects: [
                "$$partner",
                {
                  contactInfo: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$partnerContacts",
                          cond: { $eq: ["$$this.contactId", "$$partner.contactId"] }
                        }
                      },
                      0
                    ]
                  }
                }
              ]
            }
          }
        },
        emergencyContacts: "$relationships.emergencyContacts"
      },
      
      systemInfo: {
        hasUserAccount: "$hasUserAccount",
        isActive: "$isActive",
        tags: "$tags",
        source: "$source",
        createdAt: "$createdAt",
        updatedAt: "$updatedAt"
      }
    }
  }
])
```

## Event-Based Analytics

### 3. Function Attendees Report
```javascript
// Get all attendees for a specific function
db.contacts.aggregate([
  // Match contacts with registrations for this function
  {
    $match: {
      "registrations": { $exists: true }
    }
  },
  
  // Convert registrations object to array
  {
    $addFields: {
      registrationsArray: { $objectToArray: "$registrations" }
    }
  },
  
  // Filter for specific function attendees
  {
    $match: {
      "registrationsArray": {
        $elemMatch: {
          "v.functionId": "685beba0b2fa6b693adaba43",
          "v.role": "attendee"
        }
      }
    }
  },
  
  // Find the specific registration
  {
    $addFields: {
      functionRegistration: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$registrationsArray",
              cond: {
                $and: [
                  { $eq: ["$$this.v.functionId", "685beba0b2fa6b693adaba43"] },
                  { $eq: ["$$this.v.role", "attendee"] }
                ]
              }
            }
          },
          0
        ]
      }
    }
  },
  
  // Project attendee details
  {
    $project: {
      contactId: 1,
      name: { $concat: ["$firstName", " ", "$lastName"] },
      email: 1,
      phone: 1,
      dietaryRequirements: "$profile.dietaryRequirements",
      specialNeeds: "$profile.specialNeeds",
      masonicTitle: "$masonicProfile.title",
      lodgeName: "$masonicProfile.lodgeName",
      tableNumber: "$functionRegistration.v.tableNumber",
      seatNumber: "$functionRegistration.v.seatNumber",
      registeredAt: "$functionRegistration.v.registeredAt",
      registeredBy: "$functionRegistration.v.registeredBy"
    }
  },
  {
    $sort: { lastName: 1, firstName: 1 }
  }
])
```

### 4. Function Hosts and Organizers
```javascript
// Get all hosts/organizers for upcoming functions
db.contacts.aggregate([
  {
    $match: {
      "hosting": { $exists: true, $ne: {} }
    }
  },
  
  // Convert hosting object to array
  {
    $addFields: {
      hostingArray: { $objectToArray: "$hosting" }
    }
  },
  
  // Unwind to process each hosting role
  { $unwind: "$hostingArray" },
  
  // Lookup function details
  {
    $lookup: {
      from: "functions",
      localField: "hostingArray.k",
      foreignField: "_id",
      as: "functionDetails"
    }
  },
  
  { $unwind: "$functionDetails" },
  
  // Filter for future functions
  {
    $match: {
      "functionDetails.dates.startDate": { $gte: new Date() }
    }
  },
  
  // Group by function
  {
    $group: {
      _id: "$hostingArray.k",
      functionName: { $first: "$functionDetails.name" },
      functionStartDate: { $first: "$functionDetails.dates.startDate" },
      hosts: {
        $push: {
          contactId: "$contactId",
          name: { $concat: ["$firstName", " ", "$lastName"] },
          email: "$email",
          phone: "$phone",
          role: "$hostingArray.v.role",
          responsibilities: "$hostingArray.v.responsibilities"
        }
      }
    }
  },
  
  { $sort: { functionStartDate: 1 } }
])
```

## Organization Analytics

### 5. Organization Members by Role
```javascript
// List all members of an organization grouped by role
db.contacts.aggregate([
  {
    $match: {
      "organizations.3e893fa6-2cc2-448c-be9c-e3858cc90e11": { $exists: true }
    }
  },
  
  // Extract the specific organization data
  {
    $addFields: {
      orgData: "$organizations.3e893fa6-2cc2-448c-be9c-e3858cc90e11"
    }
  },
  
  // Filter for current members only
  {
    $match: {
      "orgData.isCurrent": true
    }
  },
  
  // Group by role
  {
    $group: {
      _id: "$orgData.role",
      count: { $sum: 1 },
      members: {
        $push: {
          contactId: "$contactId",
          name: { $concat: ["$firstName", " ", "$lastName"] },
          email: "$email",
          phone: "$phone",
          startDate: "$orgData.startDate",
          masonicRank: "$masonicProfile.rank"
        }
      }
    }
  },
  
  { $sort: { _id: 1 } }
])
```

## Lodge Analytics

### 6. Lodge Members with Masonic Details
```javascript
// Analyze lodge membership
db.contacts.aggregate([
  { 
    $match: { 
      "masonicProfile.lodgeId": "7f4e9b2a-1234-5678-9012-3456789abcde",
      "isActive": true
    } 
  },
  
  // Group by rank
  {
    $group: {
      _id: "$masonicProfile.rank",
      count: { $sum: 1 },
      members: {
        $push: {
          contactId: "$contactId",
          name: { $concat: ["$firstName", " ", "$lastName"] },
          title: "$masonicProfile.title",
          email: "$email",
          grandOfficer: "$masonicProfile.grandOfficer",
          grandRank: "$masonicProfile.grandRank",
          registrationCount: { $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } }
        }
      }
    }
  },
  
  // Sort by masonic rank hierarchy
  {
    $sort: {
      _id: {
        $switch: {
          branches: [
            { case: { $eq: ["$_id", "EA"] }, then: 1 },
            { case: { $eq: ["$_id", "FC"] }, then: 2 },
            { case: { $eq: ["$_id", "MM"] }, then: 3 },
            { case: { $eq: ["$_id", "PM"] }, then: 4 }
          ],
          default: 5
        }
      }
    }
  }
])
```

### 7. Grand Officers by Jurisdiction
```javascript
// List all grand officers by grand lodge
db.contacts.aggregate([
  {
    $match: {
      "masonicProfile.grandOfficer": true,
      "isActive": true
    }
  },
  
  {
    $group: {
      _id: "$masonicProfile.grandLodgeId",
      grandLodgeName: { $first: "$masonicProfile.grandLodgeName" },
      officers: {
        $push: {
          contactId: "$contactId",
          name: { $concat: ["$firstName", " ", "$lastName"] },
          email: "$email",
          grandRank: "$masonicProfile.grandRank",
          grandOffice: "$masonicProfile.grandOffice",
          lodgeName: "$masonicProfile.lodgeName"
        }
      },
      count: { $sum: 1 }
    }
  },
  
  { $sort: { grandLodgeName: 1 } }
])
```

## Relationship Analysis

### 8. Partner and Emergency Contact Network
```javascript
// Map partner and emergency contact relationships
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { "relationships.partners": { $exists: true, $ne: [] } },
        { "relationships.emergencyContacts": { $exists: true, $ne: [] } }
      ]
    }
  },
  
  // Lookup partner details
  {
    $lookup: {
      from: "contacts",
      let: { partnerIds: "$relationships.partners.contactId" },
      pipeline: [
        { $match: { $expr: { $in: ["$contactId", { $ifNull: ["$$partnerIds", []] }] } } },
        { $project: { contactId: 1, firstName: 1, lastName: 1, hasUserAccount: 1 } }
      ],
      as: "partnerDetails"
    }
  },
  
  {
    $project: {
      contactId: 1,
      name: { $concat: ["$firstName", " ", "$lastName"] },
      email: 1,
      
      partners: {
        $map: {
          input: "$relationships.partners",
          as: "partner",
          in: {
            name: "$$partner.name",
            relationshipType: "$$partner.relationshipType",
            isPrimary: "$$partner.isPrimary",
            hasAccount: {
              $let: {
                vars: {
                  partnerInfo: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$partnerDetails",
                          cond: { $eq: ["$$this.contactId", "$$partner.contactId"] }
                        }
                      },
                      0
                    ]
                  }
                },
                in: "$$partnerInfo.hasUserAccount"
              }
            }
          }
        }
      },
      
      emergencyContacts: "$relationships.emergencyContacts",
      
      activeRegistrations: { 
        $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } 
      }
    }
  },
  
  {
    $match: { activeRegistrations: { $gt: 0 } }
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
        { email: { $ne: null } },
        { phone: { $ne: null } }
      ]
    }
  },
  
  // Normalize phone for comparison
  {
    $addFields: {
      normalizedPhone: {
        $cond: [
          { $ne: ["$phone", null] },
          { $replaceAll: { input: "$phone", find: " ", replacement: "" } },
          null
        ]
      }
    }
  },
  
  {
    $group: {
      _id: {
        email: { $toLower: { $ifNull: ["$email", "no-email"] } },
        phone: { $ifNull: ["$normalizedPhone", "no-phone"] }
      },
      count: { $sum: 1 },
      contacts: {
        $push: {
          contactId: "$contactId",
          name: { $concat: ["$firstName", " ", "$lastName"] },
          createdAt: "$createdAt",
          hasUser: "$hasUserAccount",
          registrationCount: { $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } },
          source: "$source"
        }
      }
    }
  },
  
  {
    $match: { 
      count: { $gt: 1 },
      $or: [
        { "_id.email": { $ne: "no-email" } },
        { "_id.phone": { $ne: "no-phone" } }
      ]
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
          "Keep contact with most registrations"
        ]
      }
    }
  },
  
  { $sort: { duplicateCount: -1 } }
])
```

### 10. Contacts Missing Critical Data
```javascript
// Identify contacts needing data completion
db.contacts.aggregate([
  {
    $project: {
      contactId: 1,
      name: { $concat: ["$firstName", " ", "$lastName"] },
      
      issues: {
        $concatArrays: [
          {
            $cond: [
              { $and: [
                { $eq: ["$email", null] },
                { $eq: ["$phone", null] },
                { $eq: ["$mobile", null] }
              ]},
              ["No contact method"],
              []
            ]
          },
          {
            $cond: [
              { $and: [
                { $eq: ["$address", null] },
                { $gt: [{ $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } }, 0] }
              ]},
              ["Has registrations but no address"],
              []
            ]
          },
          {
            $cond: [
              { $and: [
                { $eq: ["$hasUserAccount", false] },
                { $gt: [{ $size: { 
                  $filter: {
                    input: { $objectToArray: { $ifNull: ["$registrations", {}] } },
                    cond: { $in: ["$$this.v.role", ["bookingContact", "billingContact"]] }
                  }
                }}, 0] }
              ]},
              ["Booking/billing contact without user account"],
              []
            ]
          },
          {
            $cond: [
              { $and: [
                { $eq: ["$masonicProfile.isMason", true] },
                { $eq: ["$masonicProfile.lodgeId", null] }
              ]},
              ["Mason without lodge affiliation"],
              []
            ]
          }
        ]
      },
      
      hasActiveRole: {
        $or: [
          { $gt: [{ $size: { $objectToArray: { $ifNull: ["$registrations", {}] } } }, 0] },
          { $gt: [{ $size: { $objectToArray: { $ifNull: ["$organizations", {}] } } }, 0] },
          { $gt: [{ $size: { $objectToArray: { $ifNull: ["$hosting", {}] } } }, 0] }
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
      contactId: 1,
      name: 1,
      issues: 1,
      issueCount: { $size: "$issues" }
    }
  },
  
  { $sort: { issueCount: -1 } }
])
```

### 11. Booking/Billing Contacts Analysis
```javascript
// Analyze booking and billing contacts
db.contacts.aggregate([
  // Convert registrations to array
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
  
  // Separate booking and billing roles
  {
    $addFields: {
      bookingRoles: {
        $filter: {
          input: "$registrationsArray",
          cond: { $eq: ["$$this.v.role", "bookingContact"] }
        }
      },
      billingRoles: {
        $filter: {
          input: "$registrationsArray",
          cond: { $eq: ["$$this.v.role", "billingContact"] }
        }
      }
    }
  },
  
  {
    $project: {
      contactId: 1,
      name: { $concat: ["$firstName", " ", "$lastName"] },
      email: 1,
      hasUserAccount: 1,
      hasAddress: { $ne: ["$address", null] },
      
      bookingStats: {
        count: { $size: "$bookingRoles" },
        totalBookingsManaged: {
          $sum: {
            $map: {
              input: "$bookingRoles",
              in: { $ifNull: ["$$this.v.bookingsManaged", 0] }
            }
          }
        }
      },
      
      billingStats: {
        count: { $size: "$billingRoles" }
      },
      
      requiresUserAccount: true,
      userAccountMissing: { $eq: ["$hasUserAccount", false] }
    }
  },
  
  { $sort: { userAccountMissing: -1, "bookingStats.totalBookingsManaged": -1 } }
])
```