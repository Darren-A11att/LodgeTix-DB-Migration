# Invoice Generation Service - Usage Examples

This document demonstrates how to use the new invoice generation service in both client and server contexts.

## Quick Start

### Basic Usage - Generate Both Invoices

```typescript
import { InvoiceService } from '@/services/invoice';

// Generate both customer and supplier invoices
const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
  payment: paymentData,
  registration: registrationData,
  invoiceNumbers: {
    customerInvoiceNumber: 'LTIV-2412-0001',
    supplierInvoiceNumber: 'LTSP-2412-0001'
  }
});
```

### Generate Customer Invoice Only

```typescript
const customerInvoice = await InvoiceService.generateCustomerInvoice({
  payment: paymentData,
  registration: registrationData
});
```

### Generate Supplier Invoice from Existing Customer Invoice

```typescript
const supplierInvoice = await InvoiceService.generateSupplierInvoice(
  customerInvoice,
  {
    payment: paymentData,
    registration: registrationData
  }
);
```

## Server-Side Usage

### In Express Server (server.ts)

```typescript
import { InvoiceService } from '@/services/invoice';

app.post('/api/invoices/create', async (req, res) => {
  try {
    const { paymentId, registrationId } = req.body;
    
    // Fetch data from database
    const payment = await db.collection('payments').findOne({ _id: paymentId });
    const registration = await db.collection('registrations').findOne({ _id: registrationId });
    
    // Validate data
    const validation = InvoiceService.validateInvoiceData(payment, registration);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }
    
    // Generate invoice numbers
    const invoiceNumbers = await InvoiceSequence.generateNumbers(payment.timestamp);
    
    // Generate invoices
    const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
      payment,
      registration,
      invoiceNumbers
    });
    
    // Save to database
    await db.collection('invoices').insertMany([customerInvoice, supplierInvoice]);
    
    res.json({ customerInvoice, supplierInvoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### In Batch Processing Script

```typescript
import { InvoiceService } from '@/services/invoice';

async function processUnmatchedPayments() {
  const unmatchedPayments = await db.collection('payments')
    .find({ invoiceId: { $exists: false } })
    .toArray();
  
  for (const payment of unmatchedPayments) {
    try {
      // Find matching registration
      const registration = await findMatchingRegistration(payment);
      
      if (!registration) {
        console.log(`No registration found for payment ${payment._id}`);
        continue;
      }
      
      // Generate invoices
      const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
        payment,
        registration
      });
      
      // Save invoices
      await saveInvoices(customerInvoice, supplierInvoice);
      
      console.log(`Generated invoices for payment ${payment._id}`);
    } catch (error) {
      console.error(`Failed to process payment ${payment._id}:`, error);
    }
  }
}
```

## Client-Side Usage

### React Hook Implementation

```typescript
// hooks/useInvoiceGeneration.ts
import { useState, useCallback } from 'react';
import { InvoiceService } from '@/services/invoice';
import apiService from '@/lib/api';

export function useInvoiceGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const generateInvoice = useCallback(async (
    payment: any,
    registration: any,
    type: 'customer' | 'supplier' | 'both' = 'both'
  ) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Generate invoice numbers via API
      const invoiceNumbers = await apiService.generateInvoiceNumbers(payment.timestamp);
      
      if (type === 'both') {
        const result = await InvoiceService.generateInvoicePair({
          payment,
          registration,
          invoiceNumbers
        });
        return result;
      } else if (type === 'customer') {
        const customerInvoice = await InvoiceService.generateCustomerInvoice({
          payment,
          registration,
          invoiceNumbers
        });
        return { customerInvoice };
      } else {
        // For supplier only, we need the customer invoice first
        const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
          payment,
          registration,
          invoiceNumbers
        });
        return { supplierInvoice };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);
  
  return {
    generateInvoice,
    isGenerating,
    error
  };
}
```

### In React Component

```typescript
import { useInvoiceGeneration } from '@/hooks/useInvoiceGeneration';

export function InvoicePreview({ payment, registration }) {
  const { generateInvoice, isGenerating } = useInvoiceGeneration();
  const [invoices, setInvoices] = useState(null);
  
  const handleGenerateInvoices = async () => {
    try {
      const result = await generateInvoice(payment, registration, 'both');
      setInvoices(result);
    } catch (error) {
      console.error('Failed to generate invoices:', error);
    }
  };
  
  return (
    <div>
      <button 
        onClick={handleGenerateInvoices}
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate Invoices'}
      </button>
      
      {invoices && (
        <>
          <InvoiceDisplay invoice={invoices.customerInvoice} />
          <InvoiceDisplay invoice={invoices.supplierInvoice} />
        </>
      )}
    </div>
  );
}
```

## Advanced Usage

### Custom Fee Rates

```typescript
import { calculateCustomerInvoiceTotals } from '@/services/invoice';

// Calculate with custom payment source
const totals = calculateCustomerInvoiceTotals(subtotal, 'stripe');
```

### Direct Generator Usage

```typescript
import { InvoiceGeneratorFactory } from '@/services/invoice';

// Create specific generator
const generator = InvoiceGeneratorFactory.create('individuals');

// Or from registration
const generator = InvoiceGeneratorFactory.createFromRegistration(registration);

// Generate invoice
const invoice = await generator.generateInvoice({
  payment,
  registration,
  invoiceNumbers
});
```

### Processing Registration Data

```typescript
import { RegistrationProcessor } from '@/services/invoice';

const processor = new RegistrationProcessor();
const processedData = processor.process(registration);

console.log('Attendees:', processedData.attendees);
console.log('Tickets:', processedData.tickets);
console.log('Billing:', processedData.billingDetails);
```

### Building Custom Line Items

```typescript
import { LineItemBuilder } from '@/services/invoice';

const builder = new LineItemBuilder();

builder
  .addHeader('Custom Event Registration')
  .addLineItem('VIP Ticket', 2, 150.00)
  .addLineItem('Merchandise', 1, 25.00)
  .addProcessingFeesReimbursement(10.50);

const items = builder.build();
```

## Migration from Old System

### Before (Old System)

```typescript
// In page.tsx
const customerInvoice = await generateCustomIndividualsInvoice(
  registration,
  payment,
  baseInvoice
);

const supplierInvoice = transformToSupplierInvoice(
  customerInvoice,
  payment
);
```

### After (New System)

```typescript
// Using new service
const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
  payment,
  registration,
  invoiceNumbers
});
```

## Testing

### Unit Test Example

```typescript
import { InvoiceService } from '@/services/invoice';

describe('InvoiceService', () => {
  it('should generate customer invoice for individuals', async () => {
    const mockPayment = {
      _id: '123',
      amount: 100,
      paymentDate: new Date(),
      source: 'stripe'
    };
    
    const mockRegistration = {
      _id: '456',
      registrationType: 'individuals',
      confirmationNumber: 'IND-123456',
      registrationData: {
        attendees: [{ /* ... */ }],
        selectedTickets: [{ /* ... */ }]
      }
    };
    
    const invoice = await InvoiceService.generateCustomerInvoice({
      payment: mockPayment,
      registration: mockRegistration
    });
    
    expect(invoice.invoiceType).toBe('customer');
    expect(invoice.total).toBeGreaterThan(0);
  });
});
```

## Error Handling

```typescript
try {
  const result = await InvoiceService.generateInvoicePair({
    payment,
    registration
  });
} catch (error) {
  if (error.message.includes('required')) {
    // Handle validation errors
    console.error('Validation error:', error.message);
  } else {
    // Handle other errors
    console.error('Invoice generation failed:', error);
  }
}
```

## Benefits of the New System

1. **Single Source of Truth**: All invoice logic in one place
2. **Type Safety**: Full TypeScript support throughout
3. **Testable**: Each component can be tested independently
4. **Reusable**: Same code works on client and server
5. **Maintainable**: Changes in one place affect all consumers
6. **Extensible**: Easy to add new registration types or fee structures