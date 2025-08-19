# MongoDB Index Creation Scripts

## Overview
This directory contains scripts for creating and managing MongoDB indexes for the LodgeTix reconciliation system.

## create-mongodb-indexes.js

This script creates optimized indexes for both the `registrations` and `payments` collections in MongoDB.

### Usage

```bash
# Using environment variables
MONGODB_URI="mongodb://your-connection-string" DATABASE_NAME="your-database" node scripts/create-mongodb-indexes.js

# Using defaults (localhost:27017/lodgetix)
node scripts/create-mongodb-indexes.js
```

### Index Strategy

#### Registration Collection Indexes
- **Single field indexes** for direct lookups on common search fields
- **Unique indexes** on `registrationId` and `confirmationNumber` for data integrity
- **Compound indexes** for common query patterns like:
  - Lodge + Date queries
  - Grand Lodge + Date queries
  - Email + Date queries
  - Payment intent + Registration lookups

#### Payments Collection Indexes
- **Single field indexes** on payment identifiers and metadata fields
- **Unique index** on charge ID to prevent duplicates
- **Compound indexes** for reconciliation queries:
  - Email + Registration ID
  - Organization + Amount sorting
  - Payment Intent + Registration lookups

### Features
- Background index creation to avoid blocking operations
- Automatic handling of existing indexes
- Comprehensive error handling
- Index verification and summary reporting

### Performance Considerations
- All indexes are created with `background: true` to minimize impact on production
- Compound indexes are ordered to support prefix queries
- Date fields use descending order (-1) for recent-first queries
- Careful selection of compound indexes based on expected query patterns