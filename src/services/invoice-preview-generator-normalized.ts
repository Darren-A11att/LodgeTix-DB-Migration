import { Db, ObjectId } from 'mongodb';
import { Invoice, InvoiceItem } from '../types/invoice';
import { DEFAULT_INVOICE_SUPPLIER } from '../constants/invoice';
import { InvoiceSequence } from '../utils/invoice-sequence';
import { MatchResult } from './payment-registration-matcher';

export interface InvoicePreview extends Invoice {
  matchDetails: {
    confidence: number;
    method: string;
    issues: string[];
  };
  paymentDetails: {
    source: string;
    originalPaymentId: string;
    timestamp: Date;
  };
  registrationDetails: {
    registrationId: string;
    confirmationNumber: string;
    functionName: string;
    attendeeCount: number;
  };
}

export class NormalizedInvoicePreviewGenerator {
  private db: Db;
  private invoiceSequence: InvoiceSequence;

  constructor(db: Db) {
    this.db = db;
    this.invoiceSequence = new InvoiceSequence(db);
  }

  /**
   * Generate invoice preview from payment-registration match using normalized collections
   */
  async generatePreview(matchResult: MatchResult): Promise<InvoicePreview | null> {
    if (!matchResult.registration) {
      return null;
    }

    const { payment, registration } = matchResult;

    // Fetch attendees from normalized collection
    const attendees = await this.db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();

    // Fetch tickets from normalized collection
    const tickets = await this.db.collection('tickets').find({
      'details.registrationId': registration.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();

    // Generate line items
    const lineItems = await this.createLineItems(attendees, tickets);
    
    // Calculate totals
    const subtotal = this.calculateSubtotal(lineItems);
    const processingFees = registration.processingFees || this.calculateProcessingFees(subtotal, payment.source);
    const gstIncluded = this.calculateGST(subtotal + processingFees);
    const total = subtotal + processingFees;

    // Generate preview invoice number (not final)
    const previewInvoiceNumber = await this.generatePreviewInvoiceNumber();

    // Extract billing information
    const billTo = this.extractBillToInfo(registration);

    // Create invoice preview
    const preview: InvoicePreview = {
      invoiceNumber: previewInvoiceNumber,
      date: new Date(),
      status: 'paid',
      supplier: DEFAULT_INVOICE_SUPPLIER,
      billTo,
      items: lineItems,
      subtotal,
      processingFees,
      gstIncluded,
      total,
      payment: {
        method: this.mapPaymentMethod(payment.source),
        transactionId: payment.transactionId,
        paidDate: payment.timestamp,
        amount: payment.amount,
        currency: 'AUD',
        status: 'completed',
        source: payment.source
      },
      paymentId: payment._id?.toString(),
      registrationId: registration._id?.toString(),
      matchDetails: {
        confidence: matchResult.matchConfidence,
        method: matchResult.matchMethod,
        issues: matchResult.issues
      },
      paymentDetails: {
        source: payment.source,
        originalPaymentId: payment.paymentId || payment.transactionId,
        timestamp: payment.timestamp
      },
      registrationDetails: {
        registrationId: registration.registrationId,
        confirmationNumber: registration.confirmationNumber,
        functionName: registration.functionName || registration.registrationData?.functionName || 'Event',
        attendeeCount: attendees.length
      }
    };

    return preview;
  }

  /**
   * Create line items from normalized attendees and tickets
   */
  private async createLineItems(attendees: any[], tickets: any[]): Promise<InvoiceItem[]> {
    const lineItems: InvoiceItem[] = [];
    
    // Group tickets by attendee
    const ticketsByAttendee = new Map<string, any[]>();
    tickets.forEach(ticket => {
      if (ticket.ownerType === 'attendee' && ticket.ownerOId) {
        const attendeeId = ticket.ownerOId.toString();
        if (!ticketsByAttendee.has(attendeeId)) {
          ticketsByAttendee.set(attendeeId, []);
        }
        ticketsByAttendee.get(attendeeId)!.push(ticket);
      }
    });

    // Create line items for each attendee
    for (const attendee of attendees) {
      const attendeeTickets = ticketsByAttendee.get(attendee._id.toString()) || [];
      
      if (attendeeTickets.length > 0) {
        // Main line item: Attendee name (no price)
        const attendeeItem: InvoiceItem = {
          description: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Unknown Attendee',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          type: 'attendee',
          subItems: []
        };

        // Sub-items: Their tickets
        for (const ticket of attendeeTickets) {
          const quantity = ticket.quantity || 1;
          const price = ticket.price || 0;
          
          attendeeItem.subItems!.push({
            description: ticket.eventName || 'Event Ticket',
            quantity,
            unitPrice: price,
            amount: quantity * price,
            type: 'ticket'
          });
        }

        lineItems.push(attendeeItem);
      }
    }

    // Add any unassigned tickets (lodge or registration level)
    const unassignedTickets = tickets.filter(ticket => 
      ticket.ownerType === 'lodge' || ticket.ownerType === 'registration'
    );

    if (unassignedTickets.length > 0) {
      const additionalTicketsItem: InvoiceItem = {
        description: 'Additional Tickets',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        type: 'section',
        subItems: []
      };

      for (const ticket of unassignedTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        
        additionalTicketsItem.subItems!.push({
          description: ticket.eventName || 'Event Ticket',
          quantity,
          unitPrice: price,
          amount: quantity * price,
          type: 'ticket'
        });
      }

      lineItems.push(additionalTicketsItem);
    }

    return lineItems;
  }

  /**
   * Calculate subtotal from line items
   */
  private calculateSubtotal(lineItems: InvoiceItem[]): number {
    let subtotal = 0;
    
    lineItems.forEach(item => {
      subtotal += item.amount || 0;
      
      if (item.subItems) {
        item.subItems.forEach(subItem => {
          subtotal += subItem.amount || 0;
        });
      }
    });

    return subtotal;
  }

  /**
   * Calculate processing fees based on payment method
   */
  private calculateProcessingFees(amount: number, paymentSource: string): number {
    // Stripe: 2.2% + $0.30
    // Square: 2.9% + $0.30
    const isStripe = paymentSource?.toLowerCase().includes('stripe');
    const percentageFee = isStripe ? 0.022 : 0.029;
    const fixedFee = 0.30;
    
    return (amount * percentageFee) + fixedFee;
  }

  /**
   * Calculate GST (10% included in total)
   */
  private calculateGST(total: number): number {
    return total * 0.10;
  }

  /**
   * Generate a preview invoice number
   */
  private async generatePreviewInvoiceNumber(): Promise<string> {
    const timestamp = Date.now();
    return `PREVIEW-${timestamp}`;
  }

  /**
   * Extract billing information from registration
   */
  private extractBillToInfo(registration: any): any {
    const bookingContact = registration.registrationData?.bookingContact || {};
    const billingDetails = registration.registrationData?.billingDetails || {};
    
    // Use booking contact first, fall back to billing details
    const contact = Object.keys(bookingContact).length > 0 ? bookingContact : billingDetails;

    return {
      businessName: contact.businessName || contact.company || '',
      businessNumber: contact.businessNumber || contact.abn || '',
      firstName: contact.firstName || 'Unknown',
      lastName: contact.lastName || 'Name',
      email: contact.email || registration.customerEmail || 'no-email@lodgetix.io',
      addressLine1: contact.addressLine1 || contact.address || 'Address not provided',
      city: contact.city || 'Sydney',
      postalCode: contact.postalCode || contact.postcode || '2000',
      stateProvince: contact.stateProvince || contact.state || 'NSW',
      country: contact.country || 'AU'
    };
  }

  /**
   * Map payment source to payment method
   */
  private mapPaymentMethod(source: string): string {
    const sourceLower = source?.toLowerCase() || '';
    
    if (sourceLower.includes('stripe')) return 'Credit Card';
    if (sourceLower.includes('square')) return 'Credit Card';
    if (sourceLower.includes('paypal')) return 'PayPal';
    if (sourceLower.includes('bank')) return 'Bank Transfer';
    if (sourceLower.includes('cash')) return 'Cash';
    
    return 'Other';
  }

  /**
   * Generate multiple invoice previews (for compatibility)
   */
  async generatePreviews(matchResults: MatchResult[]): Promise<(InvoicePreview | null)[]> {
    return Promise.all(matchResults.map(result => this.generatePreview(result)));
  }
}