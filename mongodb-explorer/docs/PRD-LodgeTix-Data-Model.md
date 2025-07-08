# LodgeTix Data Model - Product Requirements Document (PRD)

## Version 1.0 - January 2025

## Executive Summary

LodgeTix is an event management system designed for Masonic organizations to manage functions, events, registrations, and attendees. This document defines the core data model and business rules that govern the system.

## Core Entities and Relationships

### 1. Users
- **Purpose**: System accounts that can create and manage functions
- **Key Attributes**:
  - Email (unique identifier)
  - Profile information
  - Roles and permissions
  - Can be linked to a Contact

### 2. Functions
- **Purpose**: Major multi-day events (e.g., "Grand Proclamation 2025")
- **Key Attributes**:
  - Created by a User
  - Owned by an Organiser (Organisation or Contact)
  - Contains multiple Events
  - Has a unique slug for URL access
- **Relationships**:
  - User (creator) → Function (1:many)
  - Organiser → Function (1:many)
  - Function → Events (1:many, embedded)

### 3. Organisers
- **Purpose**: The entity responsible for a Function
- **Types**:
  - Organisation (e.g., Grand Lodge)
  - Contact (individual organizer)
- **Key Rule**: Every Function must have exactly one Organiser

### 4. Events
- **Purpose**: Individual activities within a Function (e.g., "Banquet", "Ceremony")
- **Key Attributes**:
  - Belong to exactly one Function
  - Have multiple Event Tickets
  - Have dates, location, and details
- **Relationships**:
  - Function → Events (1:many, embedded)
  - Event → Event Tickets (1:many, embedded)

### 5. Event Tickets
- **Purpose**: Sellable items for an Event with inventory tracking
- **Key Attributes**:
  - Name (e.g., "Standard Ticket", "VIP Table")
  - Type (ticket, package, etc.)
  - Price
  - Capacity (maximum that can be sold)
  - Sold Count (tracked in real-time)
  - Available Count (computed: capacity - sold)
- **Critical Rules**:
  - Belongs to exactly ONE Event
  - Cannot be sold beyond capacity
  - Must track sold vs available in real-time
- **Relationships**:
  - Event → Event Tickets (1:many, embedded)

### 6. Registrations
- **Purpose**: The process of registering for a Function
- **Types**:
  - **Individuals**: Must specify all attendees at registration time
  - **Lodges**: Can specify attendees later or buy tickets in bulk
  - **Delegations**: Can specify attendees later or buy tickets in bulk
- **Key Attributes**:
  - Registration type
  - Function ID (one registration per function)
  - Registrant information
  - Payment status
- **Relationships**:
  - User → Registrations (1:many)
  - Function → Registrations (1:many)
  - Registration → Attendees (1:many)

### 7. Attendees
- **Purpose**: People attending events
- **Key Rules**:
  - For Individual registrations: Must be specified at registration
  - For Lodge/Delegation registrations: Can be added after registration
  - Each attendee can have multiple event tickets
  - Each attendee can only have ONE of each specific event ticket
- **Valid Examples**:
  ```
  ✓ John Smith: Banquet, Ceremony, Cocktail Party
  ✓ Jane Doe: Banquet, Workshop A, Workshop B
  ```
- **Invalid Examples**:
  ```
  ✗ John Smith: Banquet, Banquet (duplicate)
  ✗ John Smith: Banquet x2 (multiple quantity)
  ```

### 8. Tickets
- **Purpose**: The actual tickets created after successful registration and payment
- **Creation Rules**:
  - Created AFTER payment is processed
  - One ticket per event ticket selected
  - Assigned to attendee (for individuals) or owned by lodge/delegation
  - Contains QR code for check-in
- **Ownership**:
  - Individual registration: Ticket assigned to attendee immediately
  - Lodge/Delegation: Tickets owned by organization until assigned

### 9. Contacts
- **Purpose**: Centralized contact management for all people in the system
- **Key Attributes**:
  - Personal information
  - Masonic affiliations
  - Can be linked to User account
  - Can be an Organiser
  - Can be linked to Attendees

### 10. Organisations
- **Purpose**: Lodges, Grand Lodges, and other organizations
- **Key Attributes**:
  - Organisation details
  - Can be an Organiser
  - Can make Lodge/Delegation registrations

## Critical Business Rules

### Inventory Management
1. **Real-time Tracking**: Must track `soldCount` and `availableCount` for each Event Ticket
2. **Capacity Enforcement**: Cannot sell tickets beyond capacity
3. **Atomic Operations**: Ticket creation must be atomic with inventory update

### Registration Flow
1. **Payment First**: Tickets are only created after successful payment
2. **Inventory Check**: Must verify availability before accepting registration
3. **Type-Specific Rules**:
   - Individuals: All attendees required upfront
   - Lodges/Delegations: Can buy bulk tickets for later assignment

### Ticket Assignment
1. **Individual Registration**: Tickets assigned to attendees immediately
2. **Lodge/Delegation Registration**: 
   - Tickets initially owned by organization
   - Can be assigned to attendees later
   - Unassigned tickets remain with organization

### Data Integrity
1. **One Function per Registration**: A registration cannot span multiple functions
2. **One Ticket per Event per Attendee**: No duplicate event tickets for same attendee
3. **Ticket-Event Binding**: A ticket is bound to exactly one event

## MongoDB Data Model Structure

Based on these requirements, the optimal structure embeds products within events:

```javascript
{
  // FUNCTIONS COLLECTION
  _id: ObjectId,
  functionId: "gp-2025",
  name: "Grand Proclamation 2025",
  organiser: {
    type: "organisation", // or "contact"
    id: ObjectId,
    name: "Grand Lodge"
  },
  createdBy: ObjectId, // User ID
  events: [
    {
      event_id: "banquet-2025",
      name: "Grand Banquet",
      type: "dinner",
      dates: { eventStart: Date, eventEnd: Date },
      location: { ... },
      eventTickets: [  // EMBEDDED - NOT SEPARATE COLLECTION
        {
          ticketId: "uuid",
          name: "Standard Ticket",
          type: "ticket",
          price: { amount: 150.00, currency: "AUD" },
          capacity: 500,
          soldCount: 127,      // Updated atomically
          reservedCount: 23,   // For carts/pending
          availableCount: 350  // Computed: capacity - soldCount - reservedCount
        }
      ]
    }
  ],
  dates: {
    startDate: Date,  // Computed from events
    endDate: Date     // Computed from events
  }
}
```

## Computed Fields Requirements

### Function Level
- `totalCapacity`: Sum of all event ticket capacities
- `totalSold`: Sum of all event ticket sold counts
- `totalAvailable`: Sum of all event ticket available counts
- `totalRevenue`: Sum of (price × soldCount) for all event tickets

### Event Level
- `eventCapacity`: Sum of event ticket capacities
- `eventSold`: Sum of event ticket sold counts
- `eventAvailable`: Sum of event ticket available counts
- `eventRevenue`: Sum of (price × soldCount) for event tickets

### Real-time Updates
- When a ticket is created: Increment `soldCount`, decrement `availableCount`
- When a ticket is cancelled: Decrement `soldCount`, increment `availableCount`
- All updates must be atomic to prevent overselling

## Migration Impact

The current separate `products` collection must be:
1. Migrated into the events array within functions
2. Renamed to `eventTickets` for clarity
3. Enhanced with real-time inventory tracking fields

## Success Criteria

1. **No Overselling**: System prevents selling beyond capacity
2. **Real-time Availability**: Users see accurate availability
3. **Atomic Operations**: No race conditions in ticket creation
4. **Clear Ownership**: Every ticket has clear ownership chain
5. **Flexible Assignment**: Lodges can assign tickets post-registration

## Future Considerations

1. **Waitlists**: When tickets sell out
2. **Group Discounts**: For bulk purchases
3. **Early Bird Pricing**: Time-based pricing tiers
4. **Seat Selection**: For venues with assigned seating
5. **Transfer Rules**: Allowing ticket transfers between attendees