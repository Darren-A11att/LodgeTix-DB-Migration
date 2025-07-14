# Invoice Generation Refactoring - Code Examples

This document shows how the refactored code will look and be used.

## Example: Using the New Invoice Generators

### Client-Side Usage (React Component)

```typescript
// In a React component
import { useInvoiceGeneration } from '@/hooks/useInvoiceGeneration';

export function InvoicePreviewModal({ payment, registration }) {
  const { generateInvoice, isGenerating, error } = useInvoiceGeneration();
  
  const handleGenerateInvoice = async () => {
    try {
      // Generate customer invoice
      const customerInvoice = await generateInvoice({
        payment,
        registration,
        type: 'customer'
      });
      
      // Generate supplier invoice
      const supplierInvoice = await generateInvoice({
        payment,
        registration,
        type: 'supplier',
        customerInvoice // Pass customer invoice for transformation
      });
      
      console.log('Invoices generated:', { customerInvoice, supplierInvoice });
    } catch (error) {
      console.error('Failed to generate invoice:', error);
    }
  };
  
  return (
    <button onClick={handleGenerateInvoice} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Invoice'}
    </button>
  );
}
```

### Server-Side Usage

```typescript
// In server.ts or API route
import { InvoiceGeneratorFactory } from '@/services/invoice';

app.post('/api/invoices/generate', async (req, res) => {
  const { paymentId, registrationId } = req.body;
  
  try {
    // Fetch data
    const payment = await db.collection('payments').findOne({ _id: paymentId });
    const registration = await db.collection('registrations').findOne({ _id: registrationId });
    
    // Generate invoice numbers
    const invoiceNumbers = await InvoiceSequence.generateNumbers(payment.timestamp);
    
    // Create appropriate generator
    const generator = InvoiceGeneratorFactory.create(registration.registrationType);
    
    // Generate customer invoice
    const customerInvoice = await generator.generateInvoice({
      payment,
      registration,
      invoiceNumbers
    });
    
    // Generate supplier invoice
    const supplierGenerator = InvoiceGeneratorFactory.create('supplier');
    const supplierInvoice = await supplierGenerator.generateInvoice({
      payment,
      registration,
      customerInvoice,
      invoiceNumbers
    });
    
    res.json({ customerInvoice, supplierInvoice });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Example: New Service Structure

### Invoice Generator Factory

```typescript
// services/invoice/invoice-generator-factory.ts
export class InvoiceGeneratorFactory {
  static create(type: string): BaseInvoiceGenerator {
    switch (type) {
      case 'individuals':
        return new IndividualsInvoiceGenerator();
      case 'lodge':
        return new LodgeInvoiceGenerator();
      case 'supplier':
        return new SupplierInvoiceGenerator();
      default:
        throw new Error(`Unknown invoice type: ${type}`);
    }
  }
}
```

### Individuals Invoice Generator

```typescript
// services/invoice/generators/individuals-invoice-generator.ts
export class IndividualsInvoiceGenerator extends BaseInvoiceGenerator {
  async generateInvoice(options: InvoiceGeneratorOptions): Promise<Invoice> {
    const { payment, registration, invoiceNumbers } = options;
    
    // Process registration data
    const processor = new RegistrationProcessor();
    const { attendees, tickets, billingDetails } = processor.process(registration);
    
    // Get function name
    const functionName = await this.functionNameService.getFunctionName(
      registration.functionId
    );
    
    // Build line items
    const lineItemBuilder = new LineItemBuilder();
    const items = lineItemBuilder
      .addHeader(`${registration.confirmationNumber} | Individuals for ${functionName}`)
      .addAttendees(attendees, tickets)
      .build();
    
    // Calculate totals
    const calculator = new InvoiceCalculator();
    const totals = calculator.calculate(items, payment.amount);
    
    // Format payment info
    const paymentFormatter = new PaymentMethodFormatter();
    const paymentInfo = paymentFormatter.format(payment);
    
    // Build invoice
    return {
      invoiceNumber: invoiceNumbers.customerInvoiceNumber,
      invoiceType: 'customer',
      status: 'paid',
      date: payment.timestamp,
      supplier: DEFAULT_INVOICE_SUPPLIER,
      billTo: billingDetails,
      items,
      ...totals,
      payment: paymentInfo
    };
  }
}
```

### Registration Processor

```typescript
// services/invoice/processors/registration-processor.ts
export class RegistrationProcessor {
  process(registration: RegistrationData) {
    const attendees = this.extractAttendees(registration);
    const tickets = this.extractTickets(registration);
    const billingDetails = this.extractBillingDetails(registration);
    
    // Apply ticket assignment logic with fallbacks
    this.assignTicketsToAttendees(attendees, tickets, registration);
    
    return { attendees, tickets, billingDetails };
  }
  
  private extractAttendees(registration: RegistrationData): ProcessedAttendee[] {
    const attendees = registration.registrationData?.attendees || [];
    
    return attendees.map(attendee => ({
      id: attendee.attendeeId,
      name: `${attendee.firstName} ${attendee.lastName}`.trim(),
      lodgeInfo: attendee.lodgeNameNumber || '',
      tickets: []
    }));
  }
  
  private assignTicketsToAttendees(
    attendees: ProcessedAttendee[], 
    tickets: ProcessedTicket[],
    registration: RegistrationData
  ) {
    // Implement all the fallback logic here
    // 1. Try exact match by attendeeId
    // 2. Try string comparison
    // 3. Try registration-owned tickets for primary attendee
    // 4. Final fallback strategies
  }
}
```

### Line Item Builder

```typescript
// services/invoice/builders/line-item-builder.ts
export class LineItemBuilder {
  private items: InvoiceItem[] = [];
  
  addHeader(description: string): this {
    this.items.push({
      description,
      quantity: 0,
      price: 0,
      total: 0
    });
    return this;
  }
  
  addAttendees(attendees: ProcessedAttendee[], tickets: ProcessedTicket[]): this {
    attendees.forEach(attendee => {
      // Add attendee line
      this.items.push({
        description: `${attendee.name} | ${attendee.lodgeInfo}`,
        quantity: 0,
        price: 0,
        total: 0
      });
      
      // Add attendee's tickets
      const attendeeTickets = tickets.filter(t => t.ownerId === attendee.id);
      attendeeTickets.forEach(ticket => {
        this.items.push({
          description: `  - ${ticket.name}`,
          quantity: ticket.quantity,
          price: ticket.price,
          total: ticket.quantity * ticket.price
        });
      });
    });
    
    return this;
  }
  
  build(): InvoiceItem[] {
    return this.items;
  }
}
```

## Example: Testing

### Unit Test for Individuals Generator

```typescript
// services/invoice/generators/__tests__/individuals-invoice-generator.test.ts
describe('IndividualsInvoiceGenerator', () => {
  let generator: IndividualsInvoiceGenerator;
  
  beforeEach(() => {
    generator = new IndividualsInvoiceGenerator();
  });
  
  it('should generate invoice with correct line items', async () => {
    const mockPayment = {
      _id: '123',
      paymentId: 'pi_test',
      amount: 100,
      timestamp: new Date()
    };
    
    const mockRegistration = {
      _id: '456',
      confirmationNumber: 'IND-123456',
      registrationType: 'individuals',
      functionId: 'func-123',
      registrationData: {
        attendees: [{
          attendeeId: 'att1',
          firstName: 'John',
          lastName: 'Doe',
          lodgeNameNumber: 'Lodge 123'
        }],
        tickets: [{
          ownerId: 'att1',
          ownerType: 'attendee',
          name: 'Dinner Ticket',
          price: 50,
          quantity: 1
        }]
      }
    };
    
    const invoice = await generator.generateInvoice({
      payment: mockPayment,
      registration: mockRegistration,
      invoiceNumbers: {
        customerInvoiceNumber: 'LTIV-123456',
        supplierInvoiceNumber: 'LTSP-123456'
      }
    });
    
    expect(invoice.items).toHaveLength(3);
    expect(invoice.items[0].description).toBe('IND-123456 | Individuals for Test Function');
    expect(invoice.items[1].description).toBe('John Doe | Lodge 123');
    expect(invoice.items[2].description).toBe('  - Dinner Ticket');
  });
});
```

## Benefits of This Approach

1. **Testability**: Each component can be unit tested in isolation
2. **Reusability**: Same logic used on client and server
3. **Maintainability**: Changes in one place affect all consumers
4. **Scalability**: Easy to add new registration types
5. **Type Safety**: Full TypeScript support throughout
6. **Performance**: Can optimize individual components
7. **Debugging**: Clear separation makes issues easier to trace

## Migration Strategy

1. **Phase 1**: Build new system alongside existing
2. **Phase 2**: Add feature flag to switch between old/new
3. **Phase 3**: Gradually migrate components to use new system
4. **Phase 4**: Remove old system once stable

This approach ensures zero downtime and ability to rollback if issues arise.