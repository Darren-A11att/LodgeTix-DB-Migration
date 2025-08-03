/**
 * Tests for invoice generation service
 * Validates that the new implementation produces expected results
 */

import { InvoiceService } from '../invoice-service';
import { 
  PaymentData, 
  RegistrationData,
  ProcessedAttendee,
  ProcessedTicket
} from '../types';

describe('Invoice Generation Tests', () => {
  // Mock payment data similar to what we see in the system
  const mockPayment: PaymentData = {
    _id: 'payment123',
    paymentId: 'pi_test123',
    transactionId: 'pi_test123',
    amount: 97.50, // Net amount
    grossAmount: 100.00, // Total including fees
    fees: 2.50,
    currency: 'AUD',
    paymentMethod: 'credit_card',
    paymentDate: new Date('2024-12-01'),
    customerEmail: 'john.doe@example.com',
    customerName: 'John Doe',
    cardLast4: '4242',
    cardBrand: 'visa',
    status: 'paid',
    source: 'stripe',
    sourceFile: 'Stripe - LodgeTix Darren Export.csv'
  };

  // Mock individuals registration
  const mockIndividualsRegistration: RegistrationData = {
    _id: 'reg123',
    registrationId: 'reg123',
    confirmationNumber: 'IND-123456',
    registrationType: 'individuals',
    functionId: 'func123',
    functionName: 'Grand Proclamation 2025',
    registrationData: {
      attendees: [
        {
          attendeeId: 'att1',
          firstName: 'John',
          lastName: 'Doe',
          title: 'Mr',
          lodgeNameNumber: 'Test Lodge 123',
          isPrimary: true
        },
        {
          attendeeId: 'att2',
          firstName: 'Jane',
          lastName: 'Smith',
          lodgeNameNumber: 'Test Lodge 456'
        }
      ],
      selectedTickets: [
        {
          attendeeId: 'att1',
          name: 'Dinner Ticket',
          price: 50,
          quantity: 1,
          event_ticket_id: 'ticket1'
        },
        {
          attendeeId: 'att2',
          name: 'Lunch Ticket',
          price: 30,
          quantity: 1,
          event_ticket_id: 'ticket2'
        }
      ],
      bookingContact: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        businessName: 'Test Business',
        businessNumber: 'ABN123456',
        addressLine1: '123 Test St',
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'Australia'
      }
    }
  };

  // Mock lodge registration
  const mockLodgeRegistration: RegistrationData = {
    _id: 'reg456',
    registrationId: 'reg456',
    confirmationNumber: 'LDG-789012',
    registrationType: 'lodge',
    functionId: 'func123',
    functionName: 'Grand Proclamation 2025',
    lodgeName: 'Test Lodge 999',
    metadata: {
      billingDetails: {
        businessName: 'Test Lodge 999',
        businessNumber: '12 345 678 901',
        firstName: 'Lodge',
        lastName: 'Secretary',
        email: 'secretary@testlodge999.org',
        addressLine1: 'Test Lodge 999', // Should be skipped as it duplicates business name
        addressLine2: '456 Lodge St',
        city: 'Melbourne',
        postalCode: '3000',
        stateProvince: 'VIC',
        country: 'Australia'
      }
    },
    registrationData: {
      attendees: [
        { attendeeId: 'lodge1', firstName: 'Member', lastName: 'One' },
        { attendeeId: 'lodge2', firstName: 'Member', lastName: 'Two' }
      ],
      selectedTickets: [
        { price: 100, quantity: 2, name: 'Lodge Registration' }
      ]
    }
  };

  describe('Individuals Invoice Generation', () => {
    it('should generate a valid customer invoice for individuals', async () => {
      const invoice = await InvoiceService.generateCustomerInvoice({
        payment: mockPayment,
        registration: mockIndividualsRegistration,
        invoiceNumbers: {
          customerInvoiceNumber: 'LTIV-2412-0001'
        }
      });

      // Check basic invoice properties
      expect(invoice.invoiceType).toBe('customer');
      expect(invoice.invoiceNumber).toBe('LTIV-2412-0001');
      expect(invoice.paymentId).toBe('payment123');
      expect(invoice.registrationId).toBe('reg123');
      
      // Check billing details
      expect(invoice.billTo.firstName).toBe('John');
      expect(invoice.billTo.lastName).toBe('Doe');
      expect(invoice.billTo.businessName).toBe('Test Business');
      expect(invoice.billTo.email).toBe('john.doe@example.com');
      
      // Check line items structure
      expect(invoice.items).toHaveLength(3); // Header + 2 attendees
      
      // Check header line
      expect(invoice.items[0].description).toBe('IND-123456 | Individuals for Grand Proclamation 2025');
      expect(invoice.items[0].quantity).toBe(0);
      expect(invoice.items[0].price).toBe(0);
      
      // Check attendee lines
      expect(invoice.items[1].description).toBe('Mr John Doe | Test Lodge 123');
      expect(invoice.items[1].subItems).toHaveLength(1);
      expect(invoice.items[1].subItems![0].description).toBe('  - Dinner Ticket');
      expect(invoice.items[1].subItems![0].price).toBe(50);
      
      expect(invoice.items[2].description).toBe('Jane Smith | Test Lodge 456');
      expect(invoice.items[2].subItems).toHaveLength(1);
      expect(invoice.items[2].subItems![0].description).toBe('  - Lunch Ticket');
      expect(invoice.items[2].subItems![0].price).toBe(30);
      
      // Check totals (working backwards from payment amount)
      expect(invoice.total).toBe(100); // Matches gross amount
      expect(invoice.subtotal).toBeLessThan(100); // Subtotal should be less than total
      expect(invoice.processingFees).toBeGreaterThan(0); // Should have processing fees
      
      // Check payment info
      expect(invoice.payment.method).toBe('Credit Card');
      expect(invoice.payment.transactionId).toBe('pi_test123');
      expect(invoice.payment.amount).toBe(100);
      expect(invoice.payment.source).toBe('stripe');
    });
  });

  describe('Lodge Invoice Generation', () => {
    it('should generate a valid customer invoice for lodge', async () => {
      const invoice = await InvoiceService.generateCustomerInvoice({
        payment: mockPayment,
        registration: mockLodgeRegistration,
        invoiceNumbers: {
          customerInvoiceNumber: 'LTIV-2412-0002'
        }
      });

      // Check basic properties
      expect(invoice.invoiceType).toBe('customer');
      expect(invoice.invoiceNumber).toBe('LTIV-2412-0002');
      
      // Check billing details from metadata
      expect(invoice.billTo.businessName).toBe('Test Lodge 999');
      expect(invoice.billTo.businessNumber).toBe('12 345 678 901');
      expect(invoice.billTo.addressLine1).toBe(''); // Should be empty as it duplicates business name
      expect(invoice.billTo.addressLine2).toBe('456 Lodge St');
      expect(invoice.billTo.city).toBe('Melbourne');
      
      // Check line items
      expect(invoice.items[0].description).toBe('LDG-789012 | Test Lodge 999 for Grand Proclamation 2025');
      
      // Check payment processing
      expect(invoice.payment.source).toBe('stripe');
      expect(invoice.supplier.name).toBe('United Grand Lodge of NSW & ACT');
    });
  });

  describe('Supplier Invoice Generation', () => {
    it('should generate a valid supplier invoice from customer invoice', async () => {
      // First generate customer invoice
      const customerInvoice = await InvoiceService.generateCustomerInvoice({
        payment: mockPayment,
        registration: mockIndividualsRegistration,
        invoiceNumbers: {
          customerInvoiceNumber: 'LTIV-2412-0003'
        }
      });

      // Then generate supplier invoice
      const supplierInvoice = await InvoiceService.generateSupplierInvoice(
        customerInvoice,
        {
          payment: mockPayment,
          registration: mockIndividualsRegistration,
          invoiceNumbers: {
            supplierInvoiceNumber: 'LTSP-2412-0003'
          }
        }
      );

      // Check basic properties
      expect(supplierInvoice.invoiceType).toBe('supplier');
      expect(supplierInvoice.invoiceNumber).toBe('LTSP-2412-0003');
      expect(supplierInvoice.relatedInvoiceId).toBe('LTIV-2412-0003');
      
      // Check bill to (should be UGLNSW)
      expect(supplierInvoice.billTo.businessName).toBe('United Grand Lodge of NSW & ACT');
      expect(supplierInvoice.billTo.businessNumber).toBe('93 230 340 687');
      
      // Check supplier (should be LodgeTix)
      expect(supplierInvoice.supplier.name).toBe('LodgeTix');
      expect(supplierInvoice.supplier.abn).toBe('21 013 997 842'); // Darren's ABN for Stripe source
      
      // Check line items
      expect(supplierInvoice.items).toHaveLength(2);
      expect(supplierInvoice.items[0].description).toBe('Processing Fees Reimbursement');
      expect(supplierInvoice.items[0].price).toBe(customerInvoice.processingFees);
      
      expect(supplierInvoice.items[1].description).toBe('Software Utilization Fee');
      // Software fee should be 3.3% for Stripe
      const expectedSoftwareFee = Math.round(customerInvoice.total * 0.033 * 100) / 100;
      expect(supplierInvoice.items[1].price).toBe(expectedSoftwareFee);
      
      // Check totals
      expect(supplierInvoice.processingFees).toBe(0); // No processing fees on supplier invoice
      expect(supplierInvoice.total).toBeGreaterThan(0);
      
      // Check payment status
      expect(supplierInvoice.payment.status).toBe('pending'); // Supplier invoices are pending
      expect(supplierInvoice.status).toBe('pending');
    });
  });

  describe('Invoice Pair Generation', () => {
    it('should generate both invoices correctly', async () => {
      const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
        payment: mockPayment,
        registration: mockIndividualsRegistration,
        invoiceNumbers: {
          customerInvoiceNumber: 'LTIV-2412-0004',
          supplierInvoiceNumber: 'LTSP-2412-0004'
        }
      });

      // Both should be generated
      expect(customerInvoice).toBeDefined();
      expect(supplierInvoice).toBeDefined();
      
      // Invoice numbers should match pattern
      expect(customerInvoice.invoiceNumber).toBe('LTIV-2412-0004');
      expect(supplierInvoice.invoiceNumber).toBe('LTSP-2412-0004');
      
      // Supplier invoice should reference customer invoice
      expect(supplierInvoice.relatedInvoiceId).toBe(customerInvoice.invoiceNumber);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing attendee tickets gracefully', async () => {
      const registrationWithoutTickets = {
        ...mockIndividualsRegistration,
        registrationData: {
          ...mockIndividualsRegistration.registrationData,
          selectedTickets: [] // No tickets
        }
      };

      const invoice = await InvoiceService.generateCustomerInvoice({
        payment: mockPayment,
        registration: registrationWithoutTickets
      });

      // Should still generate invoice
      expect(invoice).toBeDefined();
      expect(invoice.items[0].type).toBe('header');
      // Attendees should still appear even without tickets
      expect(invoice.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle missing booking contact', async () => {
      const registrationWithoutContact = {
        ...mockIndividualsRegistration,
        registrationData: {
          ...mockIndividualsRegistration.registrationData,
          bookingContact: undefined
        }
      };

      const invoice = await InvoiceService.generateCustomerInvoice({
        payment: mockPayment,
        registration: registrationWithoutContact
      });

      // Should use fallback values
      expect(invoice.billTo.firstName).toBe('John'); // From primary attendee
      expect(invoice.billTo.lastName).toBe('Doe');
      expect(invoice.billTo.email).toBe('no-email@lodgetix.io'); // Default
    });

    it('should calculate fees correctly when only payment total is available', async () => {
      const paymentWithOnlyTotal = {
        ...mockPayment,
        amount: 100, // Only total amount
        grossAmount: undefined,
        fees: undefined
      };

      const invoice = await InvoiceService.generateCustomerInvoice({
        payment: paymentWithOnlyTotal,
        registration: mockIndividualsRegistration
      });

      // Should calculate fees from items
      expect(invoice.total).toBe(100);
      expect(invoice.subtotal).toBeLessThan(100);
      expect(invoice.processingFees).toBeGreaterThan(0);
      
      // Verify calculation: subtotal + fees = total
      expect(invoice.subtotal + invoice.processingFees).toBeCloseTo(invoice.total, 2);
    });
  });

  describe('Data Validation', () => {
    it('should validate required data', () => {
      const validation = InvoiceService.validateInvoiceData(
        mockPayment,
        mockIndividualsRegistration
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing payment amount', () => {
      const invalidPayment = {
        ...mockPayment,
        amount: undefined,
        grossAmount: undefined
      };

      const validation = InvoiceService.validateInvoiceData(
        invalidPayment as any,
        mockIndividualsRegistration
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Payment amount is required');
    });
  });
});

// Run a simple test to verify calculations
describe('Fee Calculations', () => {
  it('should calculate processing fees correctly', async () => {
    const { calculateProcessingFees } = await import('../calculators/fee-calculator');
    
    // Test Stripe fees (2.5% + $0.30)
    const fees = calculateProcessingFees(100, 'stripe');
    expect(fees).toBe(2.80); // 100 * 0.025 + 0.30 = 2.80
  });

  it('should calculate software utilization fees correctly', async () => {
    const { calculateSoftwareUtilizationFee } = await import('../calculators/fee-calculator');
    
    // Test Stripe (3.3%)
    const stripeFee = calculateSoftwareUtilizationFee(100, 'stripe');
    expect(stripeFee).toBe(3.30); // 100 * 0.033 = 3.30
    
    // Test Square (2.8%)
    const squareFee = calculateSoftwareUtilizationFee(100, 'square');
    expect(squareFee).toBe(2.80); // 100 * 0.028 = 2.80
  });
});