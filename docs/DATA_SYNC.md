# Data Synchronization System

This document describes the automated data synchronization system that keeps MongoDB up-to-date with payments from Square and registrations from Supabase.

## Quick Start

```bash
# Run development with automatic sync
npm run dev:sync

# Run development without sync
npm run dev:no-sync

# Manually sync all data
npm run sync

# Quick sync (last 7 days only)
npm run sync:quick

# Sync only payments
npm run sync:payments

# Sync only registrations
npm run sync:registrations
```

## How It Works

The sync system follows this workflow:

1. **Setup Collections** - Creates/updates MongoDB collections and indexes
2. **Import Payments** - Fetches payments from Square API → `payment_imports`
3. **Process Payments** - Transforms `payment_imports` → `payments`
4. **Import Registrations** - Fetches from Supabase → `registration_imports`
5. **Process Registrations** - Verifies payments and imports → `registrations`
6. **Match & Link** - Links payments to registrations
7. **Cleanup** - Marks processed imports and generates reports

## Configuration

### Using `.sync-config.json`

Edit `.sync-config.json` to customize sync behavior:

```json
{
  "sync": {
    "onStartup": true,              // Run sync when dev server starts
    "payments": {
      "daysToImport": 30,           // How many days of history to import
      "skipDuplicates": true
    },
    "registrations": {
      "daysToImport": 30,
      "includeTestData": false      // Filter out test registrations
    }
  },
  "development": {
    "quickSync": {
      "enabled": true,              // Use quick sync in dev (faster)
      "daysToImport": 7             // Only sync recent data
    },
    "autoSync": {
      "enabled": false,             // Periodic background sync
      "intervalMinutes": 60         // How often to sync
    }
  }
}
```

### Using Environment Variables

Environment variables override config file settings:

```bash
# Sync configuration
SYNC_ON_STARTUP=true          # Run sync on startup
SYNC_INTERVAL=60              # Minutes between auto-syncs (0=disabled)
SYNC_PAYMENT_DAYS=30          # Days of payments to import
SYNC_REGISTRATION_DAYS=30     # Days of registrations to import
SYNC_BATCH_SIZE=100          # Processing batch size
SYNC_MAX_RETRIES=3           # Max retries for failed imports

# Skip specific sources
SKIP_SQUARE_IMPORT=true      # Skip Square payment import
SKIP_SUPABASE_IMPORT=true    # Skip Supabase registration import

# Logging
SYNC_LOG_LEVEL=info          # Log level (debug|info|warn|error)
SYNC_LOG_FILE=sync.log       # Log file path
```

## Scripts Reference

### Main Scripts

- **`sync-all-data.js`** - Master orchestration script
  - Runs all import and processing steps in order
  - Handles errors and generates reports
  - Supports partial syncs and dry runs

- **`dev-with-sync.js`** - Development server with sync
  - Runs sync before starting dev servers
  - Optional periodic background syncs
  - Integrated logging and error handling

### Import Scripts

- **`import-square-payments-simple.js`** - Import payments from Square
- **`import-missing-registrations.js`** - Import specific missing registrations
- **`import-non-test-registrations.js`** - Import all non-test registrations

### Processing Scripts

- **`process-payment-imports.js`** - Process payment imports
- **`process-pending-imports.ts`** - Process registration imports
- **`rerun-strict-matching.ts`** - Match payments to registrations

### Utility Scripts

- **`setup-payment-import-collections.js`** - Setup MongoDB collections
- **`cleanup-payment-imports.ts`** - Clean up processed imports
- **`show-data-quality-summary.ts`** - Generate data quality reports

## Troubleshooting

### Sync Fails on Startup

1. Check MongoDB connection in `.env.local`
2. Verify Square API token is valid
3. Check Supabase credentials
4. Look at sync log file for details

### Missing Data After Sync

1. Check date ranges in config
2. Verify source APIs are returning data
3. Check for processing errors in logs
4. Run with `--dry-run` to see what would happen

### Performance Issues

1. Use quick sync for development (`npm run dev:sync`)
2. Reduce batch size in config
3. Sync specific sources only
4. Disable auto-sync if not needed

## Manual Operations

```bash
# Check what needs syncing
node scripts/sync-all-data.js --dry-run

# Force re-import everything (last 30 days)
node scripts/sync-all-data.js --force

# Import specific date range
node scripts/import-square-payments-simple.js --from 2024-01-01 --to 2024-01-31

# Process specific batch
node scripts/process-payment-imports.js --batch-id BATCH-123

# Clean up duplicates
npx tsx src/scripts/cleanup-payment-imports.ts --mark-processed
```

## Development Workflow

1. **First Time Setup**
   ```bash
   npm run sync        # Full sync of all data
   npm run dev:sync    # Start dev with sync
   ```

2. **Daily Development**
   ```bash
   npm run dev:sync    # Quick sync + dev server
   ```

3. **Testing Imports**
   ```bash
   npm run sync:payments     # Test payment import only
   npm run sync:registrations # Test registration import only
   ```

4. **Production Sync**
   ```bash
   # Run full sync with all data
   SYNC_PAYMENT_DAYS=90 SYNC_REGISTRATION_DAYS=90 npm run sync
   ```