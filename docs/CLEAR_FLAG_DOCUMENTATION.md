# --clear Flag Documentation

## Overview
The `--clear` flag clears **MongoDB variable collections only** in the `lodgetix` database before running sync operations. This ensures a clean slate for testing and debugging.

## Important Notes
- **This clears MongoDB data, NOT Supabase data**
- **Only affects the `lodgetix` database in MongoDB**
- **Preserves all reference/master data**

## What Gets Cleared (Variable Collections)

### Main Data Collections
- `attendees` - Event attendee records
- `contacts` - Contact information
- `customers` - Customer records
- `payments` - Payment transactions
- `registrations` - Event registrations
- `tickets` - Ticket purchases

### Import Staging Collections
- `import_attendees` - Temporary attendee imports
- `import_contacts` - Temporary contact imports
- `import_customers` - Temporary customer imports
- `import_payments` - Temporary payment imports
- `import_registrations` - Temporary registration imports
- `import_tickets` - Temporary ticket imports

### Error Tracking Collections
- `error_attendees` - Failed attendee syncs
- `error_contacts` - Failed contact syncs
- `error_customers` - Failed customer syncs
- `error_log` - General error log
- `error_payments` - Failed payment syncs
- `error_registrations` - Failed registration syncs
- `error_tickets` - Failed ticket syncs

### Test Collections (Deleted)
- `test_refund_scenario` - Test data
- `test_version_control` - Test data

## What Gets Preserved (Constant Collections)

These reference/master data collections are **NEVER** cleared:

- `eventTickets` - Ticket type definitions
- `eventTickets_computed` - Computed ticket data
- `events` - Event master data
- `functions` - Lodge functions/positions
- `grandLodges` - Grand Lodge reference data
- `locations` - Location reference data
- `lodges` - Lodge master data (252 lodges)
- `organisations` - Organisation master data (455 orgs)
- `packages` - Package definitions

## Usage Examples

### Clear and Run Full Sync
```bash
npm run sync:enhanced -- --clear
```

### Clear and Start Dev Server
```bash
npm run dev:clear
# or
npm run dev -- --clear
```

### Clear with Limited Sync (for testing)
```bash
npm run sync:enhanced -- --clear --limit=5
```

### Just Clear Collections (no sync)
```bash
npm run clear:variables:force
```

## What Happens During Clear

1. **Connects to MongoDB** using `.env.explorer` settings
2. **Lists all variable collections** showing document counts
3. **Lists all constant collections** marking them as PRESERVED
4. **Deletes all documents** from variable collections
5. **Shows summary** with total documents deleted
6. **Proceeds with sync** (if part of sync command)

## Sample Output

```
🗑️  CLEARING VARIABLE COLLECTIONS
==================================================

📊 Checking variable collections...
----------------------------------------
  payments: 1,234 documents
  registrations: 1,234 documents
  import_payments: 456 documents
  error_payments: 78 documents
  ...

🔒 Preserving constant collections...
----------------------------------------
  events: 6 documents (PRESERVED)
  eventTickets: 10 documents (PRESERVED)
  lodges: 252 documents (PRESERVED)
  organisations: 455 documents (PRESERVED)
  ...

🗑️  Clearing variable collections...
----------------------------------------
  ✓ Cleared payments: 1,234 documents deleted
  ✓ Cleared registrations: 1,234 documents deleted
  ...

================================================================================
SUMMARY REPORT
================================================================================
✅ Collections Cleared: 21
📊 Total Documents Deleted: 5,678

✅ Variable collections cleared successfully
```

## When to Use --clear

### ✅ Good Use Cases
- Starting fresh test of sync process
- Debugging sync issues
- Testing with different date ranges
- Resetting after failed sync attempts
- Testing error recovery

### ⚠️  Be Careful When
- You have unsaved work in progress
- Running in production (though this should be dev only)
- You need to preserve error logs for debugging

## Technical Details

### Environment
- Database: `lodgetix` (MongoDB)
- Cluster: `LodgeTix-migration-test-1`
- Connection: Uses `.env.explorer` configuration

### Safety Features
- Force flag automatically applied in scripts
- Shows preview before deletion
- Preserves all reference data
- Non-destructive to Supabase
- Clear operation is logged

## Related Commands

```bash
# View what would be cleared (dry run)
npm run clear:variables

# Clear with confirmation prompt
npm run clear:variables

# Clear without confirmation
npm run clear:variables:force

# Sync commands with clear
npm run sync:clear
npm run sync:enhanced:clear
npm run dev:clear
```

## Notes

- The clear operation is **MongoDB only** - Supabase data remains untouched
- This is designed for the development/test environment
- Always preserves master/reference data needed for the application to function
- Test collections (`test_refund_scenario`, `test_version_control`) are deleted entirely