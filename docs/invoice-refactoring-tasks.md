# Invoice Generation Refactoring - Task List

This document provides specific, actionable tasks for refactoring the invoice generation system. Each task includes acceptance criteria and implementation notes.

## Phase 1: Foundation Setup

### Task 1.1: Create Base Invoice Generator Interface and Types
**Priority**: High  
**Estimated Time**: 4 hours  
**Dependencies**: None

**Implementation**:
1. Create directory structure: `src/services/invoice/`
2. Create `types/invoice-generation.ts` with all shared types
3. Create `generators/base-invoice-generator.ts`

**Acceptance Criteria**:
- [ ] Directory structure created
- [ ] All invoice generation types defined
- [ ] Base abstract class with required methods
- [ ] JSDoc documentation for all public methods

```typescript
// Example structure
export interface InvoiceGeneratorOptions {
  payment: PaymentData;
  registration: RegistrationData;
  invoiceNumbers?: {
    customerInvoiceNumber: string;
    supplierInvoiceNumber: string;
  };
  functionName?: string;
  relatedDocuments?: any;
}
```

---

### Task 1.2: Extract Function Name Service
**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: Task 1.1

**Implementation**:
1. Create `services/invoice/services/function-name-service.ts`
2. Extract `fetchFunctionName` logic from page.tsx
3. Add caching mechanism
4. Handle errors gracefully

**Acceptance Criteria**:
- [ ] Function name fetching works independently
- [ ] Caching implemented (5-minute TTL)
- [ ] Proper error handling with fallback
- [ ] Unit tests written

---

### Task 1.3: Extract Monetary Calculations
**Priority**: High  
**Estimated Time**: 3 hours  
**Dependencies**: None

**Implementation**:
1. Move `getMonetaryValue`, `formatMoney`, `roundToMoney` to `utils/monetary.ts`
2. Create comprehensive tests
3. Handle edge cases (null, undefined, Decimal128)

**Acceptance Criteria**:
- [ ] All monetary functions in one place
- [ ] 100% test coverage
- [ ] Handles MongoDB Decimal128 properly
- [ ] TypeScript types for all functions

---

## Phase 2: Core Generators

### Task 2.1: Implement Registration Data Processor
**Priority**: High  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.1, 1.3

**Implementation**:
1. Create `processors/registration-processor.ts`
2. Extract all registration data extraction logic
3. Handle all registration types (individuals, lodge, delegation)
4. Implement attendee and ticket processing

**Key Functions**:
```typescript
extractAttendees(registration: RegistrationData): ProcessedAttendee[]
extractTickets(registration: RegistrationData): ProcessedTicket[]
extractBillingDetails(registration: RegistrationData): BillingDetails
extractLodgeInfo(registration: RegistrationData): LodgeInfo
assignTicketsToAttendees(attendees: ProcessedAttendee[], tickets: ProcessedTicket[]): void
```

**Acceptance Criteria**:
- [ ] All ticket assignment logic preserved (including fallbacks)
- [ ] Lodge name/number extraction working
- [ ] Billing details properly extracted from metadata
- [ ] Unit tests for each extraction function

---

### Task 2.2: Implement Individuals Invoice Generator
**Priority**: High  
**Estimated Time**: 8 hours  
**Dependencies**: Task 1.1, 2.1

**Implementation**:
1. Create `generators/individuals-invoice-generator.ts`
2. Port all logic from `generateCustomIndividualsInvoice`
3. Use registration processor for data extraction
4. Maintain exact same output format

**Acceptance Criteria**:
- [ ] Generates identical invoices to current implementation
- [ ] Proper line item formatting (confirmation | Individuals for Function)
- [ ] Attendee lines with no qty/price
- [ ] Ticket sub-items with dash prefix
- [ ] All fallback strategies working

---

### Task 2.3: Implement Lodge Invoice Generator
**Priority**: High  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.1, 2.1

**Implementation**:
1. Create `generators/lodge-invoice-generator.ts`
2. Port all logic from `generateCustomLodgeInvoice`
3. Use metadata.billingDetails for billTo
4. Skip addressLine1 (as it duplicates business name)

**Acceptance Criteria**:
- [ ] Generates identical invoices to current implementation
- [ ] Uses billing details from metadata
- [ ] Proper line item formatting (confirmation | Lodge for Function)
- [ ] No addressLine1 in billTo section
- [ ] Function name properly fetched

---

### Task 2.4: Implement Supplier Invoice Generator
**Priority**: High  
**Estimated Time**: 6 hours  
**Dependencies**: Task 1.1, 2.2, 2.3

**Implementation**:
1. Create `generators/supplier-invoice-generator.ts`
2. Port all logic from `transformToSupplierInvoice`
3. Implement fee calculations (3.3% stripe, 2.8% square)
4. Generate proper line items

**Acceptance Criteria**:
- [ ] Transforms customer invoice correctly
- [ ] Proper fee calculations
- [ ] Correct supplier details based on payment source
- [ ] Line items formatted correctly (no quotes)
- [ ] Matches exact current output

---

## Phase 3: Business Logic Extraction

### Task 3.1: Create Payment Method Formatter
**Priority**: Medium  
**Estimated Time**: 3 hours  
**Dependencies**: None

**Implementation**:
1. Create `formatters/payment-method-formatter.ts`
2. Extract payment method formatting logic
3. Remove duplicate "card" text
4. Handle all payment sources

**Acceptance Criteria**:
- [ ] No duplicate "card" in output
- [ ] Handles all payment types
- [ ] Proper capitalization
- [ ] Unit tests for edge cases

---

### Task 3.2: Create Line Item Builder
**Priority**: Medium  
**Estimated Time**: 4 hours  
**Dependencies**: Task 1.3

**Implementation**:
1. Create `builders/line-item-builder.ts`
2. Standardize line item creation
3. Handle header items (qty/price = 0)
4. Handle sub-items with proper indentation

**Acceptance Criteria**:
- [ ] Consistent line item format
- [ ] Proper handling of zero qty/price
- [ ] Sub-item indentation with dash
- [ ] Builder pattern implementation

---

### Task 3.3: Extract Fee Calculators
**Priority**: Medium  
**Estimated Time**: 3 hours  
**Dependencies**: Task 1.3

**Implementation**:
1. Create `calculators/fee-calculator.ts`
2. Extract all fee calculation logic
3. Handle different payment sources
4. Implement GST calculations

**Key Functions**:
```typescript
calculateProcessingFees(amount: number, source: string): number
calculateSoftwareUtilizationFee(amount: number, source: string): number
calculateGST(amount: number): number
```

**Acceptance Criteria**:
- [ ] Accurate fee calculations
- [ ] Proper rounding (2 decimal places)
- [ ] Source-specific fee rates
- [ ] GST calculation (amount / 11)

---

## Phase 4: React Integration

### Task 4.1: Create useInvoiceGeneration Hook
**Priority**: Medium  
**Estimated Time**: 4 hours  
**Dependencies**: Tasks 2.1-2.4

**Implementation**:
1. Create `hooks/useInvoiceGeneration.ts`
2. Wrap invoice generators for React use
3. Handle loading states
4. Handle errors

**Acceptance Criteria**:
- [ ] Simple API for components
- [ ] Loading states
- [ ] Error handling
- [ ] TypeScript support

---

### Task 4.2: Refactor Invoice Preview Modal
**Priority**: Low  
**Estimated Time**: 6 hours  
**Dependencies**: Task 4.1

**Implementation**:
1. Extract invoice preview logic to separate component
2. Use new hooks
3. Remove business logic
4. Keep only UI concerns

**Acceptance Criteria**:
- [ ] Cleaner component code
- [ ] Business logic in services
- [ ] Maintains current functionality
- [ ] Better separation of concerns

---

## Phase 5: Server Integration

### Task 5.1: Update Server Invoice Generator
**Priority**: High  
**Estimated Time**: 4 hours  
**Dependencies**: Tasks 2.1-2.4

**Implementation**:
1. Update `invoice-preview-generator.ts`
2. Use new generators instead of custom logic
3. Ensure server/client parity

**Acceptance Criteria**:
- [ ] Server generates identical invoices to client
- [ ] Uses same business logic
- [ ] No code duplication
- [ ] Proper error handling

---

### Task 5.2: Create Batch Invoice Generation Endpoint
**Priority**: Medium  
**Estimated Time**: 6 hours  
**Dependencies**: Task 5.1

**Implementation**:
1. Create `/api/invoices/generate-batch` endpoint
2. Process multiple payments
3. Generate both customer and supplier invoices
4. Handle errors gracefully

**Acceptance Criteria**:
- [ ] Can process multiple payments
- [ ] Generates all invoice types
- [ ] Transaction support
- [ ] Progress reporting

---

## Phase 6: Testing

### Task 6.1: Unit Tests for Generators
**Priority**: High  
**Estimated Time**: 8 hours  
**Dependencies**: Tasks 2.1-2.4

**Test Coverage**:
1. Individuals invoice generator
2. Lodge invoice generator  
3. Supplier invoice generator
4. Edge cases and error scenarios

**Acceptance Criteria**:
- [ ] 90%+ code coverage
- [ ] Tests for all edge cases
- [ ] Tests for error scenarios
- [ ] Snapshot tests for invoice output

---

### Task 6.2: Integration Tests
**Priority**: Medium  
**Estimated Time**: 6 hours  
**Dependencies**: Task 6.1

**Test Scenarios**:
1. Full invoice generation flow
2. Server-side generation
3. Client-side generation
4. Error handling

**Acceptance Criteria**:
- [ ] End-to-end tests passing
- [ ] Performance benchmarks
- [ ] Memory leak tests
- [ ] Concurrent generation tests

---

## Quick Start Tasks

If you want to start immediately, here are the first 3 tasks to tackle:

1. **Extract Monetary Helpers** (Task 1.3)
   - Self-contained
   - Immediately useful
   - Low risk

2. **Create Base Types** (Task 1.1)
   - Foundation for everything else
   - Defines the contracts
   - No business logic

3. **Extract Function Name Service** (Task 1.2)
   - Simple extraction
   - Adds caching benefit
   - Used everywhere

## Progress Tracking

Use this checklist to track overall progress:

- [ ] Phase 1: Foundation Setup (0/3 tasks)
- [ ] Phase 2: Core Generators (0/4 tasks)
- [ ] Phase 3: Business Logic Extraction (0/3 tasks)
- [ ] Phase 4: React Integration (0/2 tasks)
- [ ] Phase 5: Server Integration (0/2 tasks)
- [ ] Phase 6: Testing (0/2 tasks)

Total: 0/16 tasks completed