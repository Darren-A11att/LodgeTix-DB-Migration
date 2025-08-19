# MongoDB Database Setup Scripts

This directory contains scripts to set up the LodgeTix MongoDB database with all collections, indexes, validation rules, and computed fields.

## Prerequisites

- Node.js installed
- MongoDB Node.js driver (`npm install mongodb`)
- Access to the MongoDB cluster

## Scripts Overview

### 1. `01-create-collections.js`
Creates the core collections with validation rules:
- `attendees` - Event attendees with QR codes and check-in data
- `contacts` - Central contact management
- `financialTransactions` - Financial transaction records
- `functions` - Major events (parent of individual events)

### 2. `02-create-remaining-collections.js`
Creates additional collections:
- `invoices` - Invoice management
- `jurisdictions` - Masonic jurisdictions hierarchy
- `organisations` - Lodges and other organisations
- `products` - Tickets, merchandise, and packages
- `registrations` - Event registrations
- `tickets` - Individual tickets with QR codes
- `users` - User accounts

### 3. `03-create-indexes.js`
Creates indexes for:
- Unique constraints (e.g., attendeeNumber, ticketNumber)
- Query optimization (e.g., functionId + status)
- Text search capabilities
- Relationship lookups

### 4. `04-create-computed-fields.js`
Creates MongoDB views with computed fields:
- `attendees_with_computed` - Adds fullName, currentlyCheckedIn, etc.
- `contacts_with_computed` - Adds displayName, profileComplete, etc.
- `functions_with_dates` - Computes start/end dates from events
- `registrations_with_totals` - Adds payment calculations
- `tickets_with_status` - Computes validity and usage status
- `transactions_with_calculations` - Adds reconciliation flags

Also creates scheduled aggregation functions for:
- Updating function dates
- Marking expired tickets
- Flagging overdue invoices

## Running the Setup

### Option 1: Run All Scripts (Recommended)
```bash
cd scripts/mongodb-setup
node setup-database.js
```

### Option 2: Run Individual Scripts
```bash
cd scripts/mongodb-setup
node 01-create-collections.js
node 02-create-remaining-collections.js
node 03-create-indexes.js
node 04-create-computed-fields.js
```

## Connection Details

The scripts connect to:
- **URI**: `mongodb+srv://darrenallatt:<password>@lodgetix.0u7ogxj.mongodb.net/`
- **Database**: `LodgeTix`

## Computed Fields

The database uses MongoDB views to provide computed fields without storing redundant data:

### Attendees Computed Fields
- `fullName` - Combines title, first name, last name, suffix
- `displayName` - Simple first + last name for badges
- `currentlyCheckedIn` - Boolean if currently checked into any event
- `eventsAttended` - Count of events attended
- `hasSpecialRequirements` - Boolean flag for dietary/accessibility needs
- `ticketCount` - Number of tickets assigned

### Contacts Computed Fields
- `fullName` - First + last name
- `displayName` - Uses preferred name if available
- `profileComplete` - Boolean if has email, phone, and address
- `isMason` - Boolean if has Masonic profile
- `lodgeNameNumber` - Formatted lodge name and number

### Functions Computed Fields
- `dates.computedStartDate` - Earliest event start date
- `dates.computedEndDate` - Latest event end date
- `eventCount` - Number of events in function
- `isActive` - Currently running
- `isUpcoming` - Starts in future
- `durationDays` - Length of function in days

## Scheduled Aggregations

The following aggregations should be run on schedule:

1. **Update Function Dates** (every 6 hours)
   - Updates function start/end dates based on event dates

2. **Update Ticket Expiry** (daily at midnight)
   - Marks tickets as expired based on validity dates

3. **Update Invoice Overdue** (daily at 1 AM)
   - Marks invoices as overdue based on due dates

Use a job scheduler like node-cron to run these aggregations.

## Validation Rules

Each collection has strict validation rules enforcing:
- Required fields
- Data types (string, number, date, etc.)
- Format patterns (emails, phone numbers, IDs)
- Enum values for status fields
- Referential integrity through ObjectId types

## Performance Considerations

- Indexes are created for all foreign key relationships
- Compound indexes optimize common query patterns
- Text indexes enable full-text search on names
- Sparse indexes used for optional unique fields
- Views are lightweight and computed on-demand

## Troubleshooting

If scripts fail:
1. Check MongoDB connection string and credentials
2. Ensure database user has appropriate permissions
3. Check if collections already exist (scripts are idempotent)
4. Review validation rules if documents fail to insert

## Next Steps

After setup:
1. Run data migration scripts to populate collections
2. Set up cron jobs for scheduled aggregations
3. Test computed views with sample queries
4. Monitor index usage and query performance