# Registration Cross-System Trace Report

## Request Summary
Traced registration with MongoDB `_id: 6886bd91bc34c2425617c25e` across all systems to determine sync status.

## Key Findings

### 🔑 Registration Details
- **Source Location**: `LodgeTix-migration-test-1.registrations` 
- **MongoDB _id**: `6886bd91bc34c2425617c25e`
- **UUIDv4 registrationId**: `49cd6734-a145-4f7e-9c63-fe976d414cad`
- **Status**: `completed`
- **Customer ID**: `2854b785-d69d-46ef-b6b6-61d623bab368`
- **Registration Date**: `2025-06-17T03:14:09.211544Z`

### 🔍 Cross-System Search Results

| System | Collection/Table | Status | Details |
|--------|-----------------|---------|---------|
| **MongoDB lodgetix** | `error_registrations` | ❌ **NOT FOUND** | Registration was not logged as an error |
| **MongoDB lodgetix** | `import_registrations` | ❌ **NOT FOUND** | Registration was not staged for import |
| **MongoDB lodgetix** | `registrations` (production) | ❌ **NOT FOUND** | Registration not imported to production MongoDB |
| **Supabase** | `registrations` table | ❌ **NOT FOUND** | Registration not synced to Supabase |

### 📊 Sync Status Summary

**CRITICAL FINDING**: Registration exists in test database but has **NOT been migrated/synced to ANY target system**.

- ✅ **Found in**: NONE of the target systems
- ❌ **Missing from**: error_registrations, import_registrations, production_registrations, supabase_registrations

### 🎯 Analysis

This registration with UUIDv4 `49cd6734-a145-4f7e-9c63-fe976d414cad`:

1. **Exists only in source**: Present in `LodgeTix-migration-test-1.registrations`
2. **No error tracking**: Not found in `error_registrations` (wasn't logged as failed)
3. **No import staging**: Not found in `import_registrations` (wasn't staged for migration)
4. **No production sync**: Not found in production `registrations` collection
5. **No Supabase sync**: Not found in Supabase `registrations` table

### 💡 Recommendations

1. **Investigate sync process**: Determine why this registration was not included in any migration/sync operations
2. **Check sync criteria**: Verify if this registration meets the criteria for migration (date range, status, etc.)
3. **Manual sync consideration**: May need to manually sync this registration if it should be included
4. **Data integrity**: Review other registrations from the same time period for similar issues

### 🔧 Technical Details

- **Connection used**: MongoDB URI from `.env.explorer`
- **Supabase**: Used service role key for comprehensive access
- **Search method**: Exact match on `registrationId` field across all collections
- **Database scope**: Searched across all relevant MongoDB databases and Supabase

---

*Report generated on: 2025-08-17*  
*Registration ID traced: 49cd6734-a145-4f7e-9c63-fe976d414cad*