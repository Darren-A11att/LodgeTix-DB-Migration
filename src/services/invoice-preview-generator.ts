import { Db } from 'mongodb';
import { Invoice, InvoiceItem } from '../types/invoice';
import { DEFAULT_INVOICE_SUPPLIER } from '../constants/invoice';
import { InvoiceSequence } from '../utils/invoice-sequence';
import { InvoiceLineItemService, RegistrationData as LineItemRegistrationData } from './invoice-line-items';
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

export class InvoicePreviewGenerator {
  private db: Db;
  private lineItemService: InvoiceLineItemService;
  private invoiceSequence: InvoiceSequence;

  constructor(db: Db) {
    this.db = db;
    this.lineItemService = new InvoiceLineItemService();
    this.invoiceSequence = new InvoiceSequence(db);
  }

  /**
   * Generate invoice preview from payment-registration match
   */
  async generatePreview(matchResult: MatchResult): Promise<InvoicePreview | null> {
    if (!matchResult.registration) {
      return null;
    }

    const { payment, registration } = matchResult;

    // Extract registration data for line items
    const registrationData = this.extractRegistrationData(registration);
    
    // Generate line items
    const lineItems = this.lineItemService.createLineItems(registrationData);
    
    // Calculate totals
    const subtotal = this.calculateSubtotal(lineItems);
    const processingFees = registrationData.processingFees || this.lineItemService.calculateProcessingFees(subtotal);
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
        functionName: registrationData.functionName,
        attendeeCount: registrationData.attendees.length
      }
    };

    return preview;
  }

  /**
   * Generate multiple previews for batch processing
   */
  async generatePreviews(matchResults: MatchResult[]): Promise<InvoicePreview[]> {
    const previews: InvoicePreview[] = [];

    for (const matchResult of matchResults) {
      const preview = await this.generatePreview(matchResult);
      if (preview) {
        previews.push(preview);
      }
    }

    return previews;
  }

  private extractRegistrationData(registration: any): LineItemRegistrationData {
    // Extract function name from nested data
    const functionName = registration.functionName || 
                        registration.registrationData?.functionName ||
                        registration.registrationData?.function?.name ||
                        'Unknown Function';

    // Extract attendees
    const attendees = this.extractAttendees(registration);

    // Determine registration type
    const registrationType = this.determineRegistrationType(registration);

    return {
      registrationType,
      confirmationNumber: registration.confirmationNumber || '',
      functionName,
      attendees,
      lodgeName: registration.lodgeName || registration.registrationData?.lodge?.name,
      delegationName: registration.delegationName || registration.registrationData?.delegation?.name,
      totalAmount: registration.totalAmount || 0,
      processingFees: registration.processingFees || registration.registrationData?.fees || 0
    };
  }

  private extractAttendees(registration: any): any[] {
    const attendees: any[] = [];
    
    if (registration.registrationData?.attendees) {
      registration.registrationData.attendees.forEach((attendee: any) => {
        const tickets = this.extractAttendeeTickets(attendee, registration);
        
        attendees.push({
          name: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim(),
          type: attendee.attendeeType || attendee.type || 'guest',
          isPrimary: attendee.isPrimary || false,
          title: attendee.title,
          rank: attendee.rank,
          tickets
        });
      });
    }

    return attendees;
  }

  private extractAttendeeTickets(attendee: any, registration: any): any[] {
    const tickets: any[] = [];
    
    if (registration.registrationData?.selectedTickets) {
      registration.registrationData.selectedTickets
        .filter((ticket: any) => ticket.attendeeId === attendee.attendeeId)
        .forEach((ticket: any) => {
          tickets.push({
            ticketName: ticket.name || ticket.ticketName || ticket.eventName || '',
            price: ticket.price || ticket.amount || 0,
            quantity: ticket.quantity || 1
          });
        });
    }

    return tickets;
  }

  private extractBillToInfo(registration: any): any {
    const bookingContact = registration.registrationData?.bookingContact || {};
    const primaryAttendee = registration.registrationData?.attendees?.find((a: any) => a.isPrimary) || {};

    // Extract first and last name
    let firstName = bookingContact.firstName || primaryAttendee.firstName || '';
    let lastName = bookingContact.lastName || primaryAttendee.lastName || '';
    
    // If only full name is available, try to split it
    if (!firstName && !lastName && (bookingContact.name || primaryAttendee.name)) {
      const fullName = (bookingContact.name || primaryAttendee.name).trim();
      const nameParts = fullName.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    // Set defaults if still empty
    if (!firstName) firstName = 'Unknown';
    if (!lastName) lastName = 'Name';

    return {
      businessName: bookingContact.businessName || bookingContact.company || '',
      businessNumber: bookingContact.businessNumber || bookingContact.abn || '',
      firstName: firstName,
      lastName: lastName,
      email: bookingContact.email || 
             primaryAttendee.email || 
             registration.customerEmail || 
             'no-email@lodgetix.io',
      addressLine1: bookingContact.addressLine1 || 
                    bookingContact.address || 
                    primaryAttendee.address || 
                    'Address not provided',
      city: bookingContact.city || 'Sydney',
      postalCode: bookingContact.postalCode || bookingContact.postcode || '2000',
      stateProvince: bookingContact.stateProvince || bookingContact.state || 'NSW',
      country: bookingContact.country || 'AU'
    };
  }

  private determineRegistrationType(registration: any): 'Individual' | 'Lodge' | 'Delegation' {
    const regType = registration.registrationType || 
                   registration.registrationData?.type ||
                   registration.type;

    if (regType?.toLowerCase().includes('lodge')) return 'Lodge';
    if (regType?.toLowerCase().includes('delegation')) return 'Delegation';
    return 'Individual';
  }

  private calculateSubtotal(items: InvoiceItem[]): number {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  private calculateGST(totalBeforeGST: number): number {
    return Math.round(totalBeforeGST * 0.10 * 100) / 100;
  }

  private mapPaymentMethod(source: string): any {
    return source === 'square' ? 'credit_card' : 'credit_card';
  }

  private async generatePreviewInvoiceNumber(): Promise<string> {
    // Generate a preview number that shows it's not final
    const current = await this.invoiceSequence.getCurrentSequenceNumber();
    const next = current + 1;
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `PREVIEW-LTIV-${yy}${mm}${next.toString().padStart(4, '0')}`;
  }
}