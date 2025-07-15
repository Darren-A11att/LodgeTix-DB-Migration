/**
 * Base abstract class for all invoice generators
 * Provides common functionality and defines the contract for invoice generation
 */

import { Invoice, InvoiceGeneratorOptions, InvoiceItem, InvoiceBillTo } from '../types';
import { DEFAULT_INVOICE_SUPPLIER } from '../../../constants/invoice';

export abstract class BaseInvoiceGenerator {
  /**
   * Generate an invoice based on the provided options
   * This is the main method that subclasses must implement
   */
  abstract generateInvoice(options: InvoiceGeneratorOptions): Promise<Invoice>;

  /**
   * Generate line items for the invoice
   * Subclasses must implement this based on their specific requirements
   */
  protected abstract generateLineItems(options: InvoiceGeneratorOptions): InvoiceItem[];

  /**
   * Extract billing information from the registration
   * Subclasses can override this if they have specific billing extraction logic
   */
  protected abstract extractBillTo(options: InvoiceGeneratorOptions): InvoiceBillTo;

  /**
   * Get the invoice type (customer or supplier)
   * Subclasses can override if needed
   */
  protected getInvoiceType(): 'customer' | 'supplier' {
    return 'customer';
  }

  /**
   * Get the default supplier information
   * Can be overridden by subclasses if they use different suppliers
   */
  protected getSupplier() {
    return DEFAULT_INVOICE_SUPPLIER;
  }

  /**
   * Generate invoice number
   * Uses provided invoice numbers or generates a temporary one
   */
  protected getInvoiceNumber(options: InvoiceGeneratorOptions): string {
    if (this.getInvoiceType() === 'customer') {
      return options.invoiceNumbers?.customerInvoiceNumber || this.generateTemporaryInvoiceNumber('LTIV');
    } else {
      return options.invoiceNumbers?.supplierInvoiceNumber || this.generateTemporaryInvoiceNumber('LTSP');
    }
  }

  /**
   * Generate a temporary invoice number for previews
   */
  protected generateTemporaryInvoiceNumber(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}-TEMP-${timestamp}`;
  }

  /**
   * Get invoice date from payment
   */
  protected getInvoiceDate(options: InvoiceGeneratorOptions): Date {
    const { payment } = options;
    
    // Try various date fields
    const dateValue = payment.paymentDate || 
                     payment.timestamp || 
                     payment.createdAt || 
                     new Date();
    
    // Ensure it's a Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Try to parse string date
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Calculate due date (default: 30 days from invoice date)
   */
  protected calculateDueDate(invoiceDate: Date, daysUntilDue: number = 30): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + daysUntilDue);
    return dueDate;
  }

  /**
   * Get invoice status based on payment status
   */
  protected getInvoiceStatus(paymentStatus?: string): 'paid' | 'pending' | 'cancelled' {
    const normalized = (paymentStatus || '').toLowerCase();
    
    if (['paid', 'completed', 'succeeded', 'success'].includes(normalized)) {
      return 'paid';
    }
    
    if (['cancelled', 'canceled', 'failed', 'refunded'].includes(normalized)) {
      return 'cancelled';
    }
    
    return 'pending';
  }

  /**
   * Validate required options
   */
  protected validateOptions(options: InvoiceGeneratorOptions): void {
    if (!options.payment) {
      throw new Error('Payment data is required for invoice generation');
    }
    
    if (!options.registration) {
      throw new Error('Registration data is required for invoice generation');
    }
  }

  /**
   * Get function name with fallback
   */
  protected getFunctionName(options: InvoiceGeneratorOptions): string {
    return options.functionName || 
           options.registration.functionName || 
           options.relatedDocuments?.functionDetails?.name ||
           'Event';
  }

  /**
   * Format currency amount for display
   */
  protected formatCurrency(amount: number, currency: string = 'AUD'): string {
    const formatter = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return formatter.format(amount);
  }

  /**
   * Check if this is a lodge registration
   */
  protected isLodgeRegistration(options: InvoiceGeneratorOptions): boolean {
    const registrationType = options.registration.registrationType || 
                           options.registration.type ||
                           '';
    
    return registrationType.toLowerCase() === 'lodge';
  }

  /**
   * Check if this is an individuals registration
   */
  protected isIndividualsRegistration(options: InvoiceGeneratorOptions): boolean {
    const registrationType = options.registration.registrationType || 
                           options.registration.type ||
                           '';
    
    return registrationType.toLowerCase() === 'individuals';
  }

  /**
   * Get confirmation number with fallback
   */
  protected getConfirmationNumber(options: InvoiceGeneratorOptions): string {
    return options.registration.confirmationNumber || 'N/A';
  }
}