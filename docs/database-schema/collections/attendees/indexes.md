# Attendees Collection - Indexes

## Primary Indexes

### 1. Unique Attendee Number
```javascript
db.attendees.createIndex(
  { "attendeeNumber": 1 },
  { 
    unique: true,
    name: "attendeeNumber_unique"
  }
)
```
**Purpose**: Ensure attendee number uniqueness, fast lookups

### 2. Legacy Attendee ID
```javascript
db.attendees.createIndex(
  { "attendeeId": 1 },
  { 
    unique: true,
    name: "attendeeId_unique"
  }
)
```
**Purpose**: Legacy UUID lookups from application

### 3. Contact Reference
```javascript
db.attendees.createIndex(
  { "contactId": 1 },
  { 
    sparse: true,
    name: "contact_reference"
  }
)
```
**Purpose**: Link to contact record (when matched)

### 4. Unique QR Code
```javascript
db.attendees.createIndex(
  { "qrCode.code": 1 },
  { 
    unique: true,
    name: "qr_code_unique"
  }
)
```
**Purpose**: Fast QR code scanning, ensure uniqueness

### 5. Registration Lookup
```javascript
db.attendees.createIndex(
  { "registrationId": 1, "status": 1 },
  { name: "registration_status" }
)
```
**Purpose**: Find attendees by registration

### 6. Function Attendees
```javascript
db.attendees.createIndex(
  { "functionId": 1, "status": 1, "profile.lastName": 1 },
  { name: "function_attendees_name" }
)
```
**Purpose**: List attendees for a function, sorted by name

## Check-in and Access Indexes

### 7. Active QR Codes
```javascript
db.attendees.createIndex(
  { "qrCode.code": 1, "qrCode.security.revoked": 1 },
  {
    partialFilterExpression: { 
      "qrCode.security.revoked": false 
    },
    name: "active_qr_codes"
  }
)
```
**Purpose**: Optimize QR scanning for non-revoked codes

### 8. Event Check-ins
```javascript
db.attendees.createIndex(
  { "checkIns.eventId": 1, "checkIns.checkInTime": 1 },
  { name: "event_checkins" }
)
```
**Purpose**: Track check-ins by event

### 9. Ticket Access
```javascript
db.attendees.createIndex(
  { "tickets.eventId": 1, "tickets.access.used": 1 },
  { name: "ticket_event_usage" }
)
```
**Purpose**: Find attendees with tickets for specific events

## Search and Lookup Indexes

### 10. Name Search
```javascript
db.attendees.createIndex(
  { "profile.lastName": 1, "profile.firstName": 1 },
  { name: "name_search" }
)
```
**Purpose**: Search attendees by name

### 11. Email Lookup
```javascript
db.attendees.createIndex(
  { "profile.primaryEmail": 1 },
  { 
    sparse: true,
    name: "email_lookup"
  }
)
```
**Purpose**: Find attendee by email address

### 12. Partner Relationships
```javascript
db.attendees.createIndex(
  { "partnerInfo.partner": 1 },
  { 
    sparse: true,
    name: "partner_lookup"
  }
)
```
**Purpose**: Find partner attendees

### 13. Partner Of Relationships
```javascript
db.attendees.createIndex(
  { "partnerInfo.isPartner": 1 },
  { 
    sparse: true,
    name: "partner_of_lookup"
  }
)
```
**Purpose**: Reverse partner lookup

### 14. Badge Collection
```javascript
db.attendees.createIndex(
  { "badge.printed": 1, "badge.collectedAt": 1 },
  {
    partialFilterExpression: { 
      "badge.printed": true,
      "badge.collectedAt": null
    },
    name: "uncollected_badges"
  }
)
```
**Purpose**: Find printed but uncollected badges

## Accommodation and Requirements

### 15. Room Assignment
```javascript
db.attendees.createIndex(
  { "accommodation.roomId": 1 },
  { 
    sparse: true,
    name: "room_assignments"
  }
)
```
**Purpose**: Find attendees by room assignment

### 16. Special Requirements
```javascript
db.attendees.createIndex(
  { "requirements.dietaryRequirements": 1 },
  { 
    sparse: true,
    name: "dietary_requirements"
  }
)
```
**Purpose**: Report on dietary needs

### 17. Attendee Type
```javascript
db.attendees.createIndex(
  { "attendeeType": 1, "functionId": 1 },
  { 
    name: "attendee_type_function"
  }
)
```
**Purpose**: Filter attendees by type (mason, guest, etc.)

## Analytics and Reporting

### 18. Engagement Tracking
```javascript
db.attendees.createIndex(
  { "engagement.eventsAttended": -1, "engagement.totalSpent": -1 },
  { name: "engagement_metrics" }
)
```
**Purpose**: Identify VIP attendees and engagement levels

### 19. No-shows
```javascript
db.attendees.createIndex(
  { "status": 1, "functionId": 1 },
  {
    partialFilterExpression: { 
      status: "no_show" 
    },
    name: "no_show_attendees"
  }
)
```
**Purpose**: Track no-show patterns

## Compound Text Index

### 20. Attendee Search
```javascript
db.attendees.createIndex(
  { 
    "profile.firstName": "text",
    "profile.lastName": "text",
    "profile.primaryEmail": "text",
    "attendeeNumber": "text",
    "masonicInfo.lodgeNameNumber": "text"
  },
  { name: "attendee_search" }
)
```
**Purpose**: Full-text search across attendee details

## Performance Considerations

1. **QR Scanning Optimization**: The `active_qr_codes` partial index significantly reduces scan time by excluding revoked codes
2. **Check-in Performance**: Compound indexes on event and time enable fast check-in queries
3. **Partial Indexes**: Used for status-based queries to reduce index size
4. **Sparse Indexes**: For optional fields like accommodation and special requirements

## Index Maintenance

```javascript
// Monitor QR scan performance
db.attendees.aggregate([
  { $indexStats: {} },
  { $match: { name: { $in: ["qr_code_unique", "active_qr_codes"] } } },
  { $sort: { "accesses.ops": -1 } }
])

// Analyze check-in patterns
db.attendees.aggregate([
  { $indexStats: {} },
  { $match: { name: "event_checkins" } }
])
```