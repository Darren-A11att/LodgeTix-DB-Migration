# Import/Production Sync Test Script

## Overview
This script tests the two-stage import/production sync workflow to ensure:

1. **Import Collections** are populated with raw data (snake_case fields)
2. **Production Collections** receive transformed data (camelCase fields) 
3. **Field Transformation** works correctly (snake_case → camelCase)
4. **Selective Sync** only updates changed records based on timestamps
5. **Production Meta Tracking** records sync metadata properly

## Usage

```bash
# Run the test
npm run tsx scripts/test-import-production-sync.ts

# Or directly with tsx
npx tsx scripts/test-import-production-sync.ts
```

## Prerequisites

1. **Environment Variables** (.env.local):
   ```
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DATABASE=payment-reconciliation
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_key
   ```

2. **Existing Data**: The script expects some data in import collections to test with

## What the Script Tests

### 1. Collection Verification
- Checks if all import collections exist (`import_payments`, `import_attendees`, `import_tickets`, `import_contacts`)
- Checks if all production collections exist (`payments`, `attendees`, `tickets`, `contacts`)
- Counts documents before and after sync

### 2. Limited Sync Test
- Runs the enhanced payment sync for 30 seconds
- Measures sync performance and completion
- Captures any errors or warnings

### 3. Field Transformation Verification
- **Snake to Camel Case**: Confirms fields are transformed from `snake_case` to `camelCase`
- **Production Meta Tracking**: Verifies `_productionMeta` objects are created with:
  - `lastImportedAt`: Timestamp of last sync
  - `source`: Data source (stripe/square)
  - `productionObjectId`: Reference to production collection document

### 4. Selective Sync Verification
- Confirms production collections contain fewer or equal records than import collections
- Validates that only changed records are updated based on timestamps

## Output

The script provides:

1. **Real-time Console Output**: Progress updates and results
2. **Detailed Log File**: Complete test log saved to `sync-logs/import-production-sync-test-[timestamp].log`
3. **Summary Report**: 
   - Collection counts before/after
   - Field transformation status (PASS/FAIL)
   - Performance metrics
   - Warnings and errors

## Sample Output

```
================================================================================
                    IMPORT/PRODUCTION SYNC WORKFLOW TEST
================================================================================
Started: 2025-08-13T10:30:00.000Z

=== Verifying Import Collections ===
✓ import_payments: 150 documents
✓ import_attendees: 45 documents  
✓ import_tickets: 67 documents
✓ import_contacts: 89 documents

=== Verifying Production Collections ===
✓ payments: 140 documents
✓ attendees: 40 documents
✓ tickets: 60 documents
✓ contacts: 85 documents

=== Running Limited Sync (5 records) ===
✓ Limited sync completed in 30000ms

=== Verifying Field Transformations ===
✓ Snake case to camelCase: PASS
✓ Production meta tracking: PASS  
✓ Selective sync: PASS

================================================================================
                           SYNC TEST SUMMARY
================================================================================
Test Duration: 35000ms
✓ All collections verified
✓ Field transformations working
✓ Selective sync operational
✓ Production meta tracking active
================================================================================
```

## Troubleshooting

### Common Issues

1. **"Collection does not exist"** warnings:
   - Run a full sync first to create import collections
   - Check database name in MONGODB_DATABASE env var

2. **"No _productionMeta tracking found"**:
   - Run the enhanced sync service at least once
   - Check that import collections have recent data

3. **Connection errors**:
   - Verify MONGODB_URI is correct
   - Ensure database is accessible
   - Check firewall/network settings

### Running a Full Sync First

If import collections are empty, run a full sync first:

```bash
# Run enhanced sync to populate import collections
npm run tsx scripts/run-enhanced-sync.ts

# Then run the test
npm run tsx scripts/test-import-production-sync.ts
```

## Integration with CI/CD

This test can be integrated into automated testing pipelines:

```yaml
# Example GitHub Actions step
- name: Test Import/Production Sync
  run: |
    npm run tsx scripts/test-import-production-sync.ts
  env:
    MONGODB_URI: ${{ secrets.MONGODB_URI }}
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

The script exits with code 0 on success and 1 on failure, making it suitable for automated testing.