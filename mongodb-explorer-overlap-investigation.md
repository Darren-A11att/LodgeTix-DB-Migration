# MongoDB Explorer and Main App Overlap Investigation Report

## Executive Summary

There is significant overlap and duplication between the main Next.js application and the mongodb-explorer application. This is causing confusion during development as changes made in one location don't reflect in the other, despite both apps sharing functionality and being designed to work together.

## Key Findings

### 1. **Duplicated API Routes**

Both applications have identical API route structures in their `/src/app/api/` directories:

**Duplicated Routes:**
- `/api/collections/[name]/documents`
- `/api/functions/[functionId]`
- `/api/invoices/email`
- `/api/invoices/create`
- `/api/invoices/finalize`
- `/api/invoices/pdf`
- `/api/lookup/[name]/[id]`
- `/api/payments/check-status`
- `/api/payments/match`
- `/api/registrations/[id]/confirmation-number`

**Unique to MongoDB Explorer:**
- `/api/invoices/matches` (payment matching functionality)
- `/api/payment-imports/*` (Square payment import routes)
- `/api/matches/unified`
- `/api/reports/*` (various reporting endpoints)
- `/api/tools/*` (admin tools)
- `/api/import-queue/*`

**Unique to Main App:**
- `/api/test-invoice-generation`

### 2. **Server Configuration Overlap**

Both applications contain nearly identical Express server files:
- Main app: `/src/server.ts` (2051 lines)
- MongoDB Explorer: `/src/server.ts` (1963 lines)

Both servers:
- Default to port 3006
- Use the same port discovery mechanism
- Write to `.port-config.json`
- Contain the same API endpoints

### 3. **Duplicated Services**

**Completely Duplicated Services:**
- `email-service.ts` - Email sending functionality
- `invoice-preview-generator.ts` - Invoice preview generation
- `transaction-service.ts` - Transaction management
- `pdf-storage.ts` - PDF storage functionality
- `field-mapping-storage.ts` - Field mapping storage
- `migration-service.ts` - Data migration services
- `payment-registration-matcher.ts` - Payment matching logic

**Services Unique to MongoDB Explorer:**
- `unified-matching-service.ts` - Unified payment matching
- `strict-payment-matcher.ts` - Strict payment matching rules
- `transaction-service-atomic.ts` - Atomic transaction operations
- `clean-invoice-data.ts` - Invoice data cleaning utility

**Services Unique to Main App:**
- `data-transformation.ts`
- `import-validation.ts`
- `invoice-line-items.ts`
- `mongodb-confirmation-number.ts`
- `payment-imports-cleanup.ts`
- `square-payment-reconciliation.ts`

### 4. **Duplicated Utilities**

**Completely Duplicated:**
- `invoice-helpers.ts` - Invoice helper functions
- `invoice-sequence.ts` - Invoice numbering sequence
- `confirmation-number.ts` - Confirmation number generation
- `monetary.ts` - Money handling utilities
- `pdf-generator.ts` - PDF generation
- `json-utils.ts` - JSON utilities
- `match-analyzer.ts` - Payment match analysis

**Utilities Unique to MongoDB Explorer:**
- `clean-invoice-data.ts` - Data cleaning utilities

**Utilities Unique to Main App:**
- `number-helpers.ts` - Number formatting helpers

### 5. **Repository Pattern Duplication**

Both applications have identical repository files for all database collections:
- 30+ repository files duplicated exactly
- Same TypeScript and JavaScript versions in both locations
- Examples: `registrations.repository.ts`, `invoices.repository.ts`, etc.

### 6. **Configuration and Dependencies**

**Shared Dependencies:**
- MongoDB driver
- Express
- Next.js (different versions)
- Square SDK
- Supabase client
- Various utility libraries

**Configuration Files:**
- Both use `.env` files
- Both reference the same MongoDB connection
- Both use the same API port configuration

### 7. **Frontend Components**

**Duplicated Components:**
- `Invoice.tsx` - Invoice display component
- `JsonViewer.tsx` - JSON viewing component
- `RegistrationEditModal.tsx` - Registration editing
- `ManualMatchModal.tsx` - Manual payment matching
- Various other UI components

### 8. **Cross-Application References**

The MongoDB Explorer app is designed to:
1. Run a Next.js frontend (port 3005)
2. Connect to the main app's API server (port 3006)
3. Use the `.port-config.json` to find the API

However, both apps contain the same server code, leading to confusion about which one should be running.

## Architecture Issues

### Current State:
```
Main App (/)
├── src/
│   ├── app/api/          (Next.js API routes)
│   ├── server.ts         (Express API server)
│   ├── services/         (Business logic)
│   └── utils/            (Utilities)
│
MongoDB Explorer (/mongodb-explorer/)
├── src/
│   ├── app/api/          (Duplicate Next.js API routes + extras)
│   ├── server.ts         (Duplicate Express server)
│   ├── services/         (Duplicate services + extras)
│   └── utils/            (Duplicate utilities)
```

### Problems:
1. **Unclear separation of concerns** - Both apps have overlapping responsibilities
2. **Duplicate code maintenance** - Same code exists in two places
3. **Confusion about which app handles what** - No clear boundaries
4. **Port conflicts** - Both try to use port 3006
5. **Inconsistent updates** - Changes in one location don't reflect in the other

## Recommendations

### Short-term (Immediate fixes):
1. **Clarify which server should run** - Only one Express server should be active
2. **Document the intended architecture** - Clear explanation of each app's purpose
3. **Remove duplicate server files** - Keep only one server.ts
4. **Update import paths** - Ensure apps reference the correct services

### Medium-term (Refactoring):
1. **Extract shared code to a common package** - Create a shared library
2. **Separate concerns clearly**:
   - Main app: Core API and business logic
   - MongoDB Explorer: UI-only with no duplicate API routes
3. **Use consistent service locations** - All services in one place
4. **Implement proper module boundaries**

### Long-term (Architecture):
1. **Consider monorepo structure** - Better code sharing
2. **Implement microservices** - Clear service boundaries
3. **Use API gateway pattern** - Single entry point for all APIs
4. **Implement proper dependency injection**

## Impact on Development

This overlap is causing several issues:
1. **Wasted development time** - Developers updating wrong files
2. **Bugs from inconsistent code** - Same logic implemented differently
3. **Confusion about app boundaries** - Unclear where to add new features
4. **Maintenance overhead** - Need to update code in multiple places
5. **Testing complexity** - Need to test duplicate implementations

## Specific Examples of Confusion

### Example 1: Invoice Email Functionality
Both apps have `/api/invoices/email/route.ts` but with slight differences:

**Main App Version:**
```typescript
// Includes functionName parameter handling
const functionName = formData.get('functionName') as string | null;
console.log('📮 Email API: Form data received:', {
  hasPdf: !!pdfFile,
  hasInvoice: !!invoiceData,
  recipientEmail,
  recipientName,
  functionName,
  functionNameType: typeof functionName
});
```

**MongoDB Explorer Version:**
```typescript
// Missing functionName parameter
// No detailed logging
if (!pdfFile || !invoiceData || !recipientEmail || !recipientName) {
  return NextResponse.json(
    { error: 'Missing required fields' },
    { status: 400 }
  );
}
```

### Example 2: API Client Configuration
Both apps have `src/lib/api.ts` with identical content:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api';
```

This means both apps expect to connect to an API on port 3006, but both also try to start their own server on that port.

### Example 3: Invoice Matching Routes
- Main app: No `/api/invoices/matches` route
- MongoDB Explorer: Has this route for payment matching
- When accessed from main app UI, it fails because the route doesn't exist there

## Script Duplication

Both applications also have duplicate scripts in their respective scripts directories:

**Duplicated Scripts:**
- Invoice generation scripts
- Payment import scripts
- Database setup scripts
- Index creation scripts
- Data migration scripts

This leads to confusion about which script to run for a given task.

## How This Affects Daily Development

### Scenario 1: Adding a New Feature
Developer wants to add a new invoice feature:
1. Updates code in main app
2. Tests locally - doesn't work
3. Realizes the UI is actually using mongodb-explorer
4. Has to duplicate changes there
5. Now has to maintain two versions

### Scenario 2: Fixing a Bug
Bug reported in email service:
1. Developer fixes in `/src/services/email-service.ts`
2. Bug persists
3. Discovers mongodb-explorer has its own copy
4. Has to fix in both places
5. Risk of fixes diverging over time

### Scenario 3: Running the Applications
Current package.json scripts:
```json
// Main app
"dev": "node scripts/start-dev.js",
"server": "ts-node --project tsconfig.server.json src/server.ts",
"mongodb-explorer": "cd mongodb-explorer && npm run dev",

// MongoDB Explorer
"dev": "npx tsx server.ts",  // Runs Express server
"dev:next": "next dev -p 3005",  // Runs Next.js
```

Confusion about which combination to run.

## File Organization Issues

### Duplicate Data Exports
Both apps contain:
```
Database-Export/
├── attendees_rows.csv
├── contacts_rows.csv
├── customers_rows.csv
└── ... (same files in both locations)
```

### Duplicate Documentation
Both apps contain:
```
docs/
├── PRD-LodgeTix-Data-Model.md
├── PRD-Contacts-Users.md
└── ... (some overlap, some unique)
```

## Environment Configuration

Both apps use environment variables but it's unclear:
- Should they share the same `.env` file?
- Should they have separate configurations?
- Which app should handle which database operations?

## Actual vs. Intended Architecture

### What Seems to be Intended:
1. **Main App**: Backend API server + business logic
2. **MongoDB Explorer**: Frontend UI for database exploration

### What Actually Exists:
1. **Main App**: Full Next.js app with API + UI + Express server
2. **MongoDB Explorer**: Another full Next.js app with API + UI + Express server

## Migration Path Recommendation

### Phase 1: Immediate Clarification (1-2 days)
1. Document current architecture clearly
2. Decide which server.ts to use
3. Remove duplicate server file
4. Update all references

### Phase 2: Consolidate Services (1 week)
1. Move all services to main app
2. Update mongodb-explorer to use main app services
3. Remove duplicate service files
4. Test thoroughly

### Phase 3: Separate Concerns (2-3 weeks)
1. MongoDB Explorer becomes pure frontend
2. All API routes move to main app
3. Clear import boundaries
4. Shared types package

### Phase 4: Long-term Architecture (1-2 months)
1. Evaluate if two apps are needed
2. Consider consolidating into one app with role-based features
3. Or clearly separate into API server + multiple frontend apps

## Conclusion

The significant overlap between the main app and MongoDB Explorer is creating development friction. The applications share ~70% of their code, including critical business logic, API routes, and server configurations. This duplication needs to be addressed to improve development efficiency and reduce bugs.

The MongoDB Explorer appears to have started as a simple UI for exploring MongoDB data but has evolved to duplicate much of the main application's functionality. A clear architectural decision needs to be made about the separation of concerns between these applications.

## Next Steps

1. **Immediate**: Team meeting to decide on architecture
2. **This Week**: Remove obvious duplications
3. **This Month**: Implement proper separation
4. **Ongoing**: Maintain clear boundaries

The current situation is unsustainable and needs urgent attention to prevent further development confusion and potential bugs from diverging implementations.