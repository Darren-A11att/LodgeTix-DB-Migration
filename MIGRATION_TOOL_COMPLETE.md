# Data Migration Tool - Complete Implementation

## Overview

The data migration tool has been fully implemented with the following features:

1. **Dual Database Support**: Connects to both source (dirty) and destination (clean) MongoDB databases
2. **Default Mappings**: Loads default field mappings from `documents.json` files
3. **ACID Transactions**: Ensures data integrity during complex migrations
4. **Customizable Mappings**: Allows overriding default mappings through the UI
5. **Real-time Stats**: Shows destination database migration progress

## Architecture

### Database Connections
- **Source DB**: `MONGODB_URI` - The dirty database with existing data
- **Destination DB**: `NEW_MONGODB_URI` - The clean database with new schema

### Key Components

1. **dual-mongodb.ts**: Manages connections to both databases
2. **migration-service.ts**: Handles migration logic with ACID transactions
3. **Migration API Endpoints**: New endpoints for migration operations
4. **Enhanced UI**: Updated migration page with default mappings support

## How It Works

### 1. Default Mappings
The system loads default mappings from `/docs/database-schema/collections/*/documents.json` files:

```json
{
  "fieldName": "sourceCollection: sourceField",
  "functionId": "functions: functionId",
  "name": "functions: name",
  "description": "TODO: Add description mapping"
}
```

### 2. Migration Process

#### Simple Documents (Contacts, Organizations, etc.)
1. Load source document
2. Apply default mappings
3. Apply custom mappings (overrides defaults)
4. Insert into destination with metadata

#### Complex Documents (Functions with Events)
1. Start MongoDB transaction
2. Create function document
3. Create related product documents for tickets
4. Set proper inventory levels
5. Commit transaction or rollback on error

#### Registration with Tickets
1. Start MongoDB transaction
2. Create registration document
3. Update product inventory (atomic operation)
4. Create ticket documents
5. Set ownership (individual or lodge)
6. Create financial transaction
7. Commit transaction

### 3. Ticket Ownership Model
- **Individual Registration**: Tickets assigned to attendee immediately
- **Lodge Registration**: Tickets owned by registration (owner.attendeeId = null)
- **Later Assignment**: Lodge can assign tickets to attendees

## API Endpoints

### Migration Specific
- `GET /api/migration/mappings` - Get all default mappings
- `GET /api/migration/mappings/:collection` - Get mapping for specific collection
- `POST /api/migration/process` - Process migration with ACID transactions
- `GET /api/migration/status/:collection/:sourceId` - Check if already migrated
- `GET /api/migration/destination/stats` - Get destination database statistics

## Usage Guide

### 1. Start the Migration Tool
```bash
npm run dev
```
Navigate to: http://localhost:3005/migration

### 2. Select Source Data
- Choose primary source collection (e.g., `functions`)
- The tool loads related documents automatically

### 3. Select Destination
- Choose primary destination collection
- Add additional destinations if needed

### 4. Review Mappings
- Default mappings are loaded automatically
- Shows mapping hints under each field
- Override by selecting different source fields
- Add custom values where needed

### 5. Preview & Process
- Click "Preview Migration" to see transformed data
- Click "Process & Continue" to migrate with ACID guarantees
- Monitor progress in destination database stats

### 6. Save Successful Mappings
- Save mappings that work well for reuse
- Load saved mappings for similar documents

## Migration Examples

### Function with Events → Function + Products
```javascript
// Source: functions collection
{
  "functionId": "gp-2025",
  "name": "Grand Proclamation 2025",
  "events": [
    {
      "event_id": "gala-dinner",
      "title": "Gala Dinner",
      "capacity": 500
    }
  ]
}

// Destination: functions collection
{
  "functionId": "gp-2025",
  "name": "Grand Proclamation 2025",
  "slug": "grand-proclamation-2025",
  "events": [...],
  "metadata": {
    "migrated": true,
    "migratedAt": "2025-01-02T...",
    "sourceId": ObjectId("...")
  }
}

// Destination: products collection (auto-created)
{
  "productId": "prod-...",
  "functionId": "gp-2025",
  "eventId": "gala-dinner",
  "type": "ticket",
  "name": "Gala Dinner Ticket",
  "inventory": {
    "method": "allocated",
    "totalCapacity": 500,
    "soldCount": 0,
    "availableCount": 500
  }
}
```

### Registration → Registration + Tickets
```javascript
// Lodge registration creates unassigned tickets
{
  "registrationNumber": "REG-2025-ABC123",
  "type": "lodge",
  "registrant": {
    "type": "organisation",
    "name": "Example Lodge #123"
  },
  "purchase": {
    "items": [{
      "productType": "ticket",
      "quantity": 10
    }]
  }
}

// Creates 10 tickets with:
{
  "owner": {
    "attendeeId": null  // Owned by registration
  },
  "purchase": {
    "registrationId": ObjectId("..."),
    "purchasedBy": { ... }
  }
}
```

## Safety Features

1. **Duplicate Prevention**: Checks `metadata.sourceId` to prevent re-migration
2. **Inventory Protection**: Atomic operations prevent overselling
3. **Transaction Rollback**: All-or-nothing migrations for complex documents
4. **Validation**: Ensures required fields and relationships
5. **Audit Trail**: Complete metadata tracking of migration process

## Monitoring

The destination database stats show:
- Total documents per collection
- Number of migrated vs non-migrated documents
- Real-time updates every 10 seconds
- Database name confirmation

## Next Steps

1. **Test with Sample Data**: Start with a few documents to verify mappings
2. **Save Working Mappings**: Build a library of tested mappings
3. **Bulk Migration**: Use saved mappings for efficient bulk processing
4. **Verify Relationships**: Check that all references are maintained
5. **Validate Inventory**: Ensure ticket counts match after migration