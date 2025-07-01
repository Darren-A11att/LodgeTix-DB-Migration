# Attendees Collection - Aggregation Pipelines

## Check-in Management

### 1. Real-time Check-in Status
```javascript
// Get current check-in status for an event
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025",
      status: { $ne: "cancelled" }
    }
  },
  {
    $project: {
      attendeeNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      hasCheckedIn: {
        $anyElementTrue: {
          $map: {
            input: "$checkIns",
            as: "checkIn",
            in: {
              $and: [
                { $eq: ["$$checkIn.eventId", "banquet-2025"] },
                { $ne: ["$$checkIn.checkInTime", null] }
              ]
            }
          }
        }
      },
      lastCheckIn: {
        $max: {
          $map: {
            input: {
              $filter: {
                input: "$checkIns",
                cond: { $eq: ["$$this.eventId", "banquet-2025"] }
              }
            },
            in: "$$this.checkInTime"
          }
        }
      }
    }
  },
  {
    $group: {
      _id: "$hasCheckedIn",
      count: { $sum: 1 },
      attendees: {
        $push: {
          attendeeNumber: "$attendeeNumber",
          name: "$name",
          checkInTime: "$lastCheckIn"
        }
      }
    }
  }
])
```

### 2. Check-in Timeline Analysis
```javascript
// Analyze check-in patterns over time
db.attendees.aggregate([
  { $unwind: "$checkIns" },
  {
    $match: {
      "checkIns.eventId": "banquet-2025"
    }
  },
  {
    $group: {
      _id: {
        hour: { $hour: "$checkIns.checkInTime" },
        minute: {
          $subtract: [
            { $minute: "$checkIns.checkInTime" },
            { $mod: [{ $minute: "$checkIns.checkInTime" }, 15] }
          ]
        }
      },
      checkInCount: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      time: {
        $concat: [
          { $toString: "$_id.hour" },
          ":",
          { $cond: [
            { $lt: ["$_id.minute", 10] },
            { $concat: ["0", { $toString: "$_id.minute" }] },
            { $toString: "$_id.minute" }
          ]}
        ]
      },
      count: "$checkInCount"
    }
  },
  { $sort: { time: 1 } }
])
```

### 3. Queue Management
```javascript
// Find attendees who haven't collected badges
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025",
      "badge.printed": true,
      "badge.collectedAt": null
    }
  },
  {
    $lookup: {
      from: "registrations",
      localField: "registrationId",
      foreignField: "_id",
      as: "registration"
    }
  },
  {
    $unwind: "$registration"
  },
  {
    $project: {
      attendeeNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      registrationType: "$registration.type",
      lodgeName: "$registration.registrant.name",
      badgePrintedAt: "$badge.printedAt",
      daysSincePrint: {
        $divide: [
          { $subtract: [new Date(), "$badge.printedAt"] },
          1000 * 60 * 60 * 24
        ]
      }
    }
  },
  {
    $sort: { daysSincePrint: -1 }
  }
])
```

## QR Code Analytics

### 4. QR Code Usage Patterns
```javascript
// Analyze QR code scanning frequency
db.attendees.aggregate([
  {
    $match: {
      "qrCode.scanCount": { $gt: 0 }
    }
  },
  {
    $project: {
      attendeeNumber: 1,
      scanFrequency: {
        $cond: [
          { $gt: ["$qrCode.lastScanned", null] },
          {
            $divide: [
              "$qrCode.scanCount",
              {
                $divide: [
                  { $subtract: ["$qrCode.lastScanned", "$qrCode.generatedAt"] },
                  1000 * 60 * 60 // Scans per hour
                ]
              }
            ]
          },
          0
        ]
      },
      totalScans: "$qrCode.scanCount",
      security: {
        hasPin: { $ne: ["$qrCode.security.pin", null] },
        isRevoked: "$qrCode.security.revoked"
      }
    }
  },
  {
    $group: {
      _id: {
        hasPin: "$security.hasPin",
        isRevoked: "$security.isRevoked"
      },
      avgScansPerHour: { $avg: "$scanFrequency" },
      totalAttendees: { $sum: 1 },
      totalScans: { $sum: "$totalScans" }
    }
  }
])
```

### 5. Security Incident Report
```javascript
// Find suspicious QR code activity
db.attendees.aggregate([
  {
    $match: {
      $or: [
        { "qrCode.security.revoked": true },
        { "qrCode.scanCount": { $gt: 50 } }, // Unusual scan frequency
        { 
          $expr: {
            $gt: [
              { $size: "$checkIns" },
              { $multiply: [{ $size: "$tickets" }, 3] } // Too many check-ins
            ]
          }
        }
      ]
    }
  },
  {
    $project: {
      attendeeNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      issue: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$qrCode.security.revoked", true] },
              then: {
                type: "Revoked QR",
                reason: "$qrCode.security.revokedReason"
              }
            },
            {
              case: { $gt: ["$qrCode.scanCount", 50] },
              then: {
                type: "High scan frequency",
                scanCount: "$qrCode.scanCount"
              }
            },
            {
              case: { $gt: [{ $size: "$checkIns" }, { $multiply: [{ $size: "$tickets" }, 3] }] },
              then: {
                type: "Excessive check-ins",
                checkInCount: { $size: "$checkIns" }
              }
            }
          ]
        }
      }
    }
  }
])
```

## Dietary and Accessibility Reports

### 6. Dietary Requirements Summary
```javascript
// Aggregate dietary requirements by event
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025",
      "requirements.dietary": { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$requirements.dietary" },
  { $unwind: "$tickets" },
  {
    $group: {
      _id: {
        eventId: "$tickets.eventId",
        dietary: "$requirements.dietary"
      },
      count: { $sum: 1 },
      attendees: {
        $push: {
          attendeeNumber: "$attendeeNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id.eventId",
      dietaryRequirements: {
        $push: {
          type: "$_id.dietary",
          count: "$count",
          attendees: { $slice: ["$attendees", 5] } // First 5 for preview
        }
      },
      totalSpecialMeals: { $sum: "$count" }
    }
  },
  {
    $lookup: {
      from: "functions",
      pipeline: [
        { $match: { functionId: "gp-2025" } },
        { $unwind: "$events" },
        { $match: { "events.event_id": "$_id" } },
        { $project: { eventName: "$events.name" } }
      ],
      as: "event"
    }
  },
  {
    $project: {
      eventId: "$_id",
      eventName: { $first: "$event.eventName" },
      totalSpecialMeals: 1,
      breakdown: "$dietaryRequirements"
    }
  }
])
```

### 7. Accessibility Needs Report
```javascript
// Compile accessibility requirements
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025",
      "requirements.accessibility": { $exists: true, $ne: [] }
    }
  },
  {
    $project: {
      attendeeNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      contact: "$profile.contact",
      accessibilityNeeds: "$requirements.accessibility",
      seatingPreference: "$requirements.seating.preference",
      events: {
        $map: {
          input: "$tickets",
          as: "ticket",
          in: {
            eventId: "$$ticket.eventId",
            eventName: "$$ticket.eventName",
            zones: "$$ticket.access.zones"
          }
        }
      }
    }
  },
  {
    $group: {
      _id: null,
      totalAttendees: { $sum: 1 },
      byNeed: {
        $push: "$accessibilityNeeds"
      },
      detailedList: {
        $push: {
          attendee: "$attendeeNumber",
          name: "$name",
          needs: "$accessibilityNeeds",
          events: "$events"
        }
      }
    }
  },
  {
    $project: {
      totalAttendees: 1,
      needsSummary: {
        $arrayToObject: {
          $map: {
            input: { $setUnion: { $reduce: {
              input: "$byNeed",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this"] }
            }}},
            as: "need",
            in: {
              k: "$$need",
              v: {
                $size: {
                  $filter: {
                    input: "$byNeed",
                    as: "attendeeNeeds",
                    cond: { $in: ["$$need", "$$attendeeNeeds"] }
                  }
                }
              }
            }
          }
        }
      },
      attendees: "$detailedList"
    }
  }
])
```

## Engagement and Analytics

### 8. VIP Attendee Identification
```javascript
// Find high-value attendees
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025"
    }
  },
  {
    $project: {
      attendeeNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      vipScore: {
        $add: [
          { $multiply: ["$engagement.eventsAttended", 10] },
          { $cond: [{ $gte: ["$engagement.totalSpent", 1000] }, 50, 0] },
          { $cond: [{ $eq: ["$badge.badgeType", "vip"] }, 100, 0] },
          { $multiply: [{ $size: { $ifNull: ["$engagement.sessions", []] } }, 5] }
        ]
      },
      metrics: {
        eventsAttended: "$engagement.eventsAttended",
        totalSpent: "$engagement.totalSpent",
        sessionCount: { $size: { $ifNull: ["$engagement.sessions", []] } },
        badgeType: "$badge.badgeType"
      }
    }
  },
  {
    $match: {
      vipScore: { $gte: 50 }
    }
  },
  {
    $sort: { vipScore: -1 }
  },
  {
    $limit: 100
  }
])
```

### 9. Session Attendance and Feedback
```javascript
// Analyze session participation and satisfaction
db.attendees.aggregate([
  {
    $match: {
      "engagement.sessions": { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$engagement.sessions" },
  {
    $group: {
      _id: {
        eventId: "$engagement.sessions.eventId",
        sessionId: "$engagement.sessions.sessionId"
      },
      totalRegistered: { $sum: 1 },
      actuallyAttended: {
        $sum: { $cond: ["$engagement.sessions.attended", 1, 0] }
      },
      feedbackProvided: {
        $sum: { 
          $cond: [
            { $ne: ["$engagement.sessions.feedback.rating", null] },
            1,
            0
          ]
        }
      },
      avgRating: { $avg: "$engagement.sessions.feedback.rating" },
      comments: {
        $push: {
          $cond: [
            { $ne: ["$engagement.sessions.feedback.comments", null] },
            "$engagement.sessions.feedback.comments",
            null
          ]
        }
      }
    }
  },
  {
    $project: {
      session: "$_id",
      metrics: {
        registered: "$totalRegistered",
        attended: "$actuallyAttended",
        attendanceRate: {
          $multiply: [
            { $divide: ["$actuallyAttended", "$totalRegistered"] },
            100
          ]
        },
        feedbackRate: {
          $multiply: [
            { $divide: ["$feedbackProvided", "$actuallyAttended"] },
            100
          ]
        },
        avgRating: { $round: ["$avgRating", 2] }
      },
      sampleComments: {
        $slice: [
          { $filter: { input: "$comments", cond: { $ne: ["$$this", null] } } },
          5
        ]
      }
    }
  }
])
```

## Accommodation Management

### 10. Room Assignment Report
```javascript
// Generate room lists with companion groupings
db.attendees.aggregate([
  {
    $match: {
      functionId: "gp-2025",
      "accommodation.roomId": { $exists: true }
    }
  },
  {
    $group: {
      _id: "$accommodation.roomId",
      roomType: { $first: "$accommodation.roomType" },
      checkIn: { $first: "$accommodation.checkIn" },
      checkOut: { $first: "$accommodation.checkOut" },
      occupants: {
        $push: {
          attendeeId: "$_id",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          dietary: "$requirements.dietary",
          accessibility: "$requirements.accessibility"
        }
      }
    }
  },
  {
    $project: {
      roomNumber: "$_id",
      roomType: 1,
      stayDates: {
        checkIn: "$checkIn",
        checkOut: "$checkOut",
        nights: {
          $divide: [
            { $subtract: ["$checkOut", "$checkIn"] },
            1000 * 60 * 60 * 24
          ]
        }
      },
      occupantCount: { $size: "$occupants" },
      occupants: 1,
      specialNeeds: {
        dietary: {
          $reduce: {
            input: "$occupants.dietary",
            initialValue: [],
            in: { $concatArrays: ["$$value", { $ifNull: ["$$this", []] }] }
          }
        },
        accessibility: {
          $reduce: {
            input: "$occupants.accessibility",
            initialValue: [],
            in: { $concatArrays: ["$$value", { $ifNull: ["$$this", []] }] }
          }
        }
      }
    }
  },
  {
    $sort: { roomNumber: 1 }
  }
])
```