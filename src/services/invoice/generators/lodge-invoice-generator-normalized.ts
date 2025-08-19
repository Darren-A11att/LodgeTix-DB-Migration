/**
 * Lodge invoice generator that creates invoices for lodge registrations
 * Updated to use normalized attendees and tickets collections
 */

import { BaseInvoiceGenerator } from './base-invoice-generator';
import { 
  Invoice, 
  InvoiceItem, 
  InvoiceGeneratorOptions,
  PaymentData,
  RegistrationData 
} from '../types';
import { DEFAULT_INVOICE_SUPPLIER } from '../../../constants/invoice';
import { NormalizedRegistrationProcessor } from '../processors/registration-processor-normalized';

export class NormalizedLodgeInvoiceGenerator extends BaseInvoiceGenerator {
  private processor: NormalizedRegistrationProcessor;

  constructor() {
    super();
    this.processor = new NormalizedRegistrationProcessor();
  }

  /**
   * Generate line items for lodge invoices
   */
  protected generateLineItems(options: InvoiceGeneratorOptions): InvoiceItem[] {
    const { registration } = options;
    const attendees = registration.attendees || [];
    const tickets = registration.tickets || [];
    const lodgeName = registration.lodgeName || 'Lodge';
    
    return this.createLineItems(attendees, tickets, lodgeName);
  }

  /**
   * Extract billing information for lodge invoices
   */
  protected extractBillTo(options: InvoiceGeneratorOptions): any {
    const { registration } = options;
    return {
      businessName: registration.lodgeName || '',
      firstName: registration.firstName || 'Lodge',
      lastName: registration.lastName || 'Registration',
      email: registration.email || '',
      phone: registration.phone || '',
      address: registration.address || {}
    };
  }

  private calculateSubtotal(lineItems: InvoiceItem[]): number {
    return lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  }

  private calculateProcessingFees(subtotal: number, payment: any): number {
    // Simple calculation - can be customized
    return payment.processingFees || (subtotal * 0.03); // 3% default
  }

  private calculateGST(amount: number): number {
    return amount * 0.1; // 10% GST
  }


  private generateInvoiceNumber(): string {
    return `INV-${Date.now()}`;
  }

  private mapPaymentMethod(payment: any): string {
    return payment.paymentMethod || payment.method || 'card';
  }

  /**
   * Generate an invoice for a lodge registration
   */
  async generateInvoice(options: InvoiceGeneratorOptions): Promise<Invoice> {
    const { payment, registration, invoiceNumbers, functionName } = options;
    
    if (!payment) {
      throw new Error('Payment data is required for invoice generation');
    }

    if (!registration) {
      throw new Error('Registration data is required for lodge invoice generation');
    }

    // Process registration to get normalized data
    const processedData = await this.processor.process(registration);
    const { attendees, tickets } = processedData;
    const lodgeName = registration.lodgeName || 'Lodge';
    const registrationType = registration.registrationType || 'lodge';

    // Create line items
    const lineItems = this.createLineItems(attendees, tickets, lodgeName);
    
    // Calculate totals
    const subtotal = this.calculateSubtotal(lineItems);
    const processingFees = this.calculateProcessingFees(subtotal, payment);
    const gstIncluded = this.calculateGST(subtotal + processingFees);
    const total = subtotal + processingFees;

    // Generate invoice
    const invoice: Invoice = {
      invoiceType: 'customer',
      invoiceNumber: invoiceNumbers?.customerInvoiceNumber || this.generateInvoiceNumber(),
      date: new Date(),
      status: 'paid',
      supplier: DEFAULT_INVOICE_SUPPLIER,
      billTo: this.extractBillTo(options),
      items: lineItems,
      subtotal,
      processingFees,
      gstIncluded,
      total,
      payment: {
        method: this.mapPaymentMethod(payment),
        transactionId: payment.id || payment.sourcePaymentId || payment.transactionId || payment.paymentId || '',
        paidDate: payment.createdAt || payment.timestamp || new Date(),
        amount: payment.amount || payment.grossAmount || total,
        currency: payment.currency || 'AUD',
        status: payment.status === 'completed' ? 'completed' : 'paid',
        source: payment.source || payment.paymentSource || '',
        sourcePaymentId: payment.sourcePaymentId
      },
      paymentId: payment.id || payment._id?.toString() || payment.paymentId,
      registrationId: registration._id?.toString() || registration.registrationId,
      notes: this.generateNotes(registration, functionName)
    };

    return invoice;
  }

  /**
   * Create line items for lodge invoice
   */
  protected createLineItems(attendees: any[], tickets: any[], lodgeName?: string): InvoiceItem[] {
    const lineItems: InvoiceItem[] = [];
    
    // Group tickets by type
    const ticketsByType = new Map<string, { tickets: any[], attendees: string[] }>();
    
    // Process attendee tickets
    for (const attendee of attendees) {
      const attendeeName = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim();
      
      for (const ticket of attendee.tickets || []) {
        const key = `${ticket.eventName}_${ticket.price}`;
        
        if (!ticketsByType.has(key)) {
          ticketsByType.set(key, { tickets: [], attendees: [] });
        }
        
        const group = ticketsByType.get(key)!;
        group.tickets.push(ticket);
        group.attendees.push(attendeeName);
      }
    }
    
    // Process unassigned tickets
    const unassignedTickets = tickets.filter(t => 
      t.ownerType === 'lodge' || t.ownerType === 'registration'
    );
    
    for (const ticket of unassignedTickets) {
      const key = `${ticket.eventName}_${ticket.price}_unassigned`;
      
      if (!ticketsByType.has(key)) {
        ticketsByType.set(key, { tickets: [], attendees: [] });
      }
      
      ticketsByType.get(key)!.tickets.push(ticket);
    }
    
    // Create line items from grouped tickets
    for (const [key, group] of ticketsByType) {
      const firstTicket = group.tickets[0];
      const totalQuantity = group.tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      const unitPrice = firstTicket.price || 0;
      const attendeeList = group.attendees.length > 0 
        ? ` (${group.attendees.join(', ')})` 
        : '';
      
      lineItems.push({
        description: `${firstTicket.eventName}${attendeeList}`,
        quantity: totalQuantity,
        price: unitPrice,
        total: totalQuantity * unitPrice,
        type: 'ticket'
      });
    }
    
    // Sort line items by description
    lineItems.sort((a, b) => a.description.localeCompare(b.description));
    
    return lineItems;
  }

  /**
   * Generate invoice notes
   */
  protected generateNotes(registration: RegistrationData, functionName?: string): string {
    const notes: string[] = [];
    
    if (registration.confirmationNumber) {
      notes.push(`Confirmation: ${registration.confirmationNumber}`);
    }
    
    if (registration.lodgeName || registration.registrationData?.lodge?.name) {
      const lodgeName = registration.lodgeName || registration.registrationData?.lodge?.name;
      notes.push(`Lodge: ${lodgeName}`);
    }
    
    if (functionName || registration.functionName) {
      notes.push(`Event: ${functionName || registration.functionName}`);
    }
    
    return notes.join(' | ');
  }
}