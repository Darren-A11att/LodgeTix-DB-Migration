# Invoice Generation Refactoring - Product Requirements Document

## Executive Summary

The current invoice generation system has evolved organically, resulting in complex logic spread across large files (particularly `src/app/invoices/matches/page.tsx` with 3600+ lines). This PRD outlines a comprehensive refactoring plan to create a modular, reusable invoice generation system that can be used both client-side and server-side.

## Current State Analysis

### Problems
1. **Code Duplication**: Invoice generation logic is duplicated between client and server
2. **Large Files**: `page.tsx` contains 3600+ lines mixing UI logic with business logic
3. **Tight Coupling**: Business logic is tightly coupled with React components
4. **Limited Reusability**: Server-side invoice generation doesn't use the refined logic from the client
5. **Maintenance Difficulty**: Changes need to be made in multiple places
6. **Testing Challenges**: Business logic mixed with UI makes unit testing difficult

### Current Invoice Generation Logic Locations
- Client-side: `mongodb-explorer/src/app/invoices/matches/page.tsx`
  - `generateCustomIndividualsInvoice()` (lines 503-795)
  - `generateCustomLodgeInvoice()` (lines 301-490)
  - `transformToSupplierInvoice()` (lines 1040-1172)
- Server-side: `mongodb-explorer/src/services/invoice-preview-generator.ts`
- Constants: `mongodb-explorer/src/constants/invoice.ts`
- Types: `mongodb-explorer/src/types/invoice.ts`

## Proposed Architecture

### Core Services Structure
```
src/
├── services/
│   ├── invoice/
│   │   ├── generators/
│   │   │   ├── base-invoice-generator.ts
│   │   │   ├── individuals-invoice-generator.ts
│   │   │   ├── lodge-invoice-generator.ts
│   │   │   └── supplier-invoice-generator.ts
│   │   ├── processors/
│   │   │   ├── payment-processor.ts
│   │   │   ├── registration-processor.ts
│   │   │   ├── billing-details-processor.ts
│   │   │   └── line-item-processor.ts
│   │   ├── calculators/
│   │   │   ├── fee-calculator.ts
│   │   │   ├── gst-calculator.ts
│   │   │   └── total-calculator.ts
│   │   ├── formatters/
│   │   │   ├── payment-method-formatter.ts
│   │   │   ├── address-formatter.ts
│   │   │   └── date-formatter.ts
│   │   ├── validators/
│   │   │   ├── invoice-validator.ts
│   │   │   └── registration-validator.ts
│   │   └── index.ts (main export)
├── hooks/
│   ├── useInvoiceGeneration.ts
│   ├── useInvoicePreview.ts
│   └── useInvoiceValidation.ts
└── utils/
    ├── invoice/
    │   ├── invoice-helpers.ts (already exists)
    │   ├── invoice-sequence.ts (already exists)
    │   └── monetary-helpers.ts
```

## Detailed Task List

### Phase 1: Foundation Setup (Priority: High)

#### Task 1.1: Create Base Invoice Generator Interface
**File**: `src/services/invoice/generators/base-invoice-generator.ts`
```typescript
interface InvoiceGeneratorOptions {
  payment: PaymentData;
  registration: RegistrationData;
  invoiceNumbers?: InvoiceNumbers;
  relatedDocuments?: RelatedDocuments;
}

abstract class BaseInvoiceGenerator {
  abstract generateInvoice(options: InvoiceGeneratorOptions): Promise<Invoice>;
  protected abstract generateLineItems(registration: RegistrationData): InvoiceItem[];
  protected abstract extractBillTo(registration: RegistrationData): InvoiceBillTo;
}
```

#### Task 1.2: Extract Registration Processing Logic
**File**: `src/services/invoice/processors/registration-processor.ts`
- Extract attendee processing logic
- Extract ticket assignment logic (with all fallback strategies)
- Extract lodge details processing
- Extract function name fetching

#### Task 1.3: Extract Payment Processing Logic
**File**: `src/services/invoice/processors/payment-processor.ts`
- Payment method formatting (remove duplicate "card" text)
- Payment source detection
- Payment ID extraction
- Statement descriptor processing

### Phase 2: Core Generators (Priority: High)

#### Task 2.1: Implement Individuals Invoice Generator
**File**: `src/services/invoice/generators/individuals-invoice-generator.ts`
- Port `generateCustomIndividualsInvoice` logic
- Use registration processor for attendees/tickets
- Implement line item generation with proper formatting

#### Task 2.2: Implement Lodge Invoice Generator
**File**: `src/services/invoice/generators/lodge-invoice-generator.ts`
- Port `generateCustomLodgeInvoice` logic
- Use billing details from metadata
- Implement lodge-specific line items

#### Task 2.3: Implement Supplier Invoice Generator
**File**: `src/services/invoice/generators/supplier-invoice-generator.ts`
- Port `transformToSupplierInvoice` logic
- Implement software utilization fee calculation
- Handle processing fee reimbursement

### Phase 3: Business Logic Extraction (Priority: Medium)

#### Task 3.1: Create Fee Calculator
**File**: `src/services/invoice/calculators/fee-calculator.ts`
- Extract processing fee calculation logic
- Extract software utilization fee logic (3.3% for stripe, 2.8% for square)
- Implement fee rounding logic

#### Task 3.2: Create Line Item Processor
**File**: `src/services/invoice/processors/line-item-processor.ts`
- Extract ticket-to-line-item conversion
- Handle quantity/price formatting (0 for header items)
- Implement sub-item formatting (with "-" prefix)

#### Task 3.3: Create Billing Details Processor
**File**: `src/services/invoice/processors/billing-details-processor.ts`
- Extract billTo extraction logic
- Handle metadata.billingDetails for lodge registrations
- Handle bookingContact for individuals
- Implement address field mapping

### Phase 4: React Integration (Priority: Medium)

#### Task 4.1: Create Invoice Generation Hook
**File**: `src/hooks/useInvoiceGeneration.ts`
```typescript
export function useInvoiceGeneration() {
  const generateInvoice = useCallback(async (
    registration: RegistrationData,
    payment: PaymentData,
    type: 'customer' | 'supplier'
  ) => {
    // Use appropriate generator based on registration type
  }, []);
  
  return { generateInvoice };
}
```

#### Task 4.2: Refactor page.tsx to use services
- Replace inline invoice generation with service calls
- Remove business logic from component
- Keep only UI-related logic

### Phase 5: Server Integration (Priority: High)

#### Task 5.1: Update Server Invoice Generator
**File**: `src/server.ts` and `src/services/invoice-preview-generator.ts`
- Import and use the new generators
- Remove duplicate logic
- Ensure parity with client-side generation

#### Task 5.2: Create Invoice Generation API Endpoint
**File**: `src/app/api/invoices/generate/route.ts`
- Accept payment and registration IDs
- Use the shared invoice generators
- Return generated invoice data

### Phase 6: Testing & Validation (Priority: High)

#### Task 6.1: Unit Tests for Generators
- Test individuals invoice generation
- Test lodge invoice generation
- Test supplier invoice transformation
- Test edge cases (missing data, fallbacks)

#### Task 6.2: Unit Tests for Processors
- Test payment processing
- Test registration processing
- Test billing details extraction

#### Task 6.3: Integration Tests
- Test full invoice generation flow
- Test server-side generation
- Test client-side generation

### Phase 7: Migration & Cleanup (Priority: Low)

#### Task 7.1: Gradual Migration
- Update imports in existing code
- Deprecate old functions
- Add migration warnings

#### Task 7.2: Remove Old Code
- Remove inline implementations from page.tsx
- Clean up duplicate logic
- Update documentation

## Implementation Guidelines

### 1. Maintain Backward Compatibility
- Keep existing functions working during migration
- Use feature flags if needed
- Provide clear migration path

### 2. Type Safety
- Use TypeScript interfaces for all data structures
- Avoid `any` types
- Create proper type guards

### 3. Error Handling
- Implement proper error boundaries
- Log errors with context
- Provide fallback values

### 4. Performance
- Minimize database calls
- Cache function names
- Use memoization where appropriate

### 5. Documentation
- Document all public APIs
- Include usage examples
- Maintain changelog

## Success Metrics

1. **Code Reduction**: Reduce page.tsx by at least 50%
2. **Test Coverage**: Achieve 80%+ coverage for business logic
3. **Reusability**: Server and client use same generators
4. **Maintainability**: Changes in one place affect all consumers
5. **Performance**: No regression in invoice generation time

## Timeline Estimate

- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days
- Phase 5: 2-3 days
- Phase 6: 3-4 days
- Phase 7: 1-2 days

**Total**: 14-21 days

## Next Steps

1. Review and approve this PRD
2. Create GitHub issues for each task
3. Prioritize Phase 1 and 2 tasks
4. Begin implementation with base generator interface
5. Set up testing framework early

## Appendix: Current Function Signatures to Preserve

```typescript
// These signatures should be maintained for backward compatibility
generateCustomIndividualsInvoice(registration: any, payment: any, baseInvoice: any): Promise<Invoice>
generateCustomLodgeInvoice(registration: any, payment: any, baseInvoice: any): Promise<Invoice>
transformToSupplierInvoice(customerInvoice: Invoice, payment: any, registration: any): Invoice
```