/**
 * Invoice generator for individuals registrations
 * Updated to use normalized attendees and tickets collections
 */

import { BaseInvoiceGenerator } from './base-invoice-generator';
import { 
  Invoice, 
  InvoiceGeneratorOptions, 
  InvoiceItem, 
  InvoiceBillTo 
} from '../types';
import { NormalizedRegistrationProcessor } from '../processors/registration-processor-normalized';
import { PaymentProcessor } from '../processors/payment-processor';
import { LineItemBuilder } from '../builders/line-item-builder';
import { 
  calculateCustomerInvoiceTotals, 
  calculateCustomerInvoiceTotalsFromTotal 
} from '../calculators/fee-calculator';
import { getMonetaryValue } from '../calculators/monetary';

export class NormalizedIndividualsInvoiceGenerator extends BaseInvoiceGenerator {
  private registrationProcessor: NormalizedRegistrationProcessor;
  private paymentProcessor: PaymentProcessor;

  constructor() {
    super();
    this.registrationProcessor = new NormalizedRegistrationProcessor();
    this.paymentProcessor = new PaymentProcessor();
  }

  /**
   * Generate an invoice for individuals registration using normalized data
   */
  async generateInvoice(options: InvoiceGeneratorOptions): Promise<Invoice> {
    // Validate options
    this.validateOptions(options);

    const { payment, registration } = options;
    
    // Process registration data from normalized collections
    const processedData = await this.registrationProcessor.process(registration);
    
    // Process payment data
    const paymentInfo = this.paymentProcessor.process(payment);
    
    // Generate line items with attendees and their tickets
    const items = await this.generateLineItems(options, processedData);
    
    // Calculate totals
    const paymentAmount = getMonetaryValue(payment.grossAmount || payment.amount || 0);
    const itemsSubtotal = this.calculateItemsSubtotal(items);
    
    // Use payment amount to calculate fees if we have it, otherwise calculate from items
    let totals;
    if (paymentAmount > 0 && paymentAmount >= itemsSubtotal) {
      // We have the full payment amount, work backwards to get fees
      totals = calculateCustomerInvoiceTotalsFromTotal(paymentAmount, paymentInfo.source);
    } else {
      // Calculate fees from subtotal
      totals = calculateCustomerInvoiceTotals(itemsSubtotal, paymentInfo.source);
    }
    
    // Extract billing details
    const billTo = this.extractBillTo(options);
    
    // Get dates
    const invoiceDate = this.getInvoiceDate(options);
    const dueDate = this.calculateDueDate(invoiceDate);
    
    // Build the invoice
    const invoice: Invoice = {
      invoiceType: 'customer',
      invoiceNumber: this.getInvoiceNumber(options),
      paymentId: payment._id?.toString() || payment.paymentId,
      registrationId: registration._id?.toString() || registration.registrationId,
      date: invoiceDate,
      dueDate: dueDate,
      billTo: billTo,
      supplier: this.getSupplier(),
      items: items,
      subtotal: totals.subtotal,
      processingFees: totals.processingFees,
      gstIncluded: totals.gstIncluded,
      totalBeforeGST: totals.totalBeforeGST,
      total: totals.total,
      payment: paymentInfo,
      status: this.getInvoiceStatus(payment.status),
      notes: this.generateNotes(processedData)
    };
    
    return invoice;
  }

  /**
   * Generate line items using normalized data structure
   */
  protected async generateLineItems(
    options: InvoiceGeneratorOptions,
    processedData: any
  ): Promise<InvoiceItem[]> {
    const { registration } = options;
    const { attendees, tickets, confirmationNumber } = processedData;
    
    // Get function name
    const functionName = this.getFunctionName(options);
    
    // Build line items
    const builder = new LineItemBuilder();
    
    // Add confirmation header
    builder.addConfirmationHeader(confirmationNumber || 'N/A', functionName);
    
    // Add attendees with their tickets as sub-items
    if (attendees && attendees.length > 0) {
      builder.addAttendees(attendees);
    }
    
    // Add any unassigned tickets (tickets not assigned to attendees)
    const unassignedTickets = tickets.filter((ticket: any) => 
      !ticket.attendeeId || 
      ticket.ownerType === 'registration' || 
      ticket.ownerType === 'lodge'
    );
    
    if (unassignedTickets.length > 0) {
      builder.addUnassignedTickets(unassignedTickets);
    }
    
    return builder.build();
  }

  /**
   * Extract billing information for individuals registration
   */
  protected extractBillTo(options: InvoiceGeneratorOptions): InvoiceBillTo {
    const { registration } = options;
    
    // Use registration processor to extract billing details
    const billingDetails = this.registrationProcessor.extractBillingDetails(registration);
    
    // Convert to InvoiceBillTo format
    return {
      businessName: billingDetails.businessName,
      businessNumber: billingDetails.businessNumber,
      title: billingDetails.title,
      firstName: billingDetails.firstName || 'Unknown',
      lastName: billingDetails.lastName || 'Customer',
      email: billingDetails.email || 'no-email@lodgetix.io',
      phone: billingDetails.phone,
      mobileNumber: billingDetails.mobileNumber,
      addressLine1: billingDetails.addressLine1,
      addressLine2: billingDetails.addressLine2,
      city: billingDetails.city,
      postalCode: billingDetails.postalCode,
      stateProvince: billingDetails.stateProvince,
      country: billingDetails.country
    };
  }

  /**
   * Calculate subtotal from line items
   */
  private calculateItemsSubtotal(items: InvoiceItem[]): number {
    let subtotal = 0;
    
    items.forEach(item => {
      // Add main item total if it has one
      if (item.total) {
        subtotal += item.total;
      }
      
      // Add sub-item totals (ticket prices)
      if (item.subItems) {
        item.subItems.forEach(subItem => {
          const itemTotal = (subItem.quantity || 0) * (subItem.price || 0);
          subtotal += itemTotal;
        });
      }
    });
    
    return subtotal;
  }

  /**
   * Generate notes about the invoice
   */
  private generateNotes(processedData: any): string {
    const notes: string[] = [];
    
    // Add note about number of attendees
    if (processedData.attendees && processedData.attendees.length > 0) {
      notes.push(`${processedData.attendees.length} attendee(s) registered`);
    }
    
    // Add note about total tickets
    const totalTickets = processedData.attendees.reduce((sum: number, attendee: any) => 
      sum + (attendee.tickets?.length || 0), 0
    );
    
    if (totalTickets > 0) {
      notes.push(`${totalTickets} ticket(s) included`);
    }
    
    return notes.join(' | ');
  }
}