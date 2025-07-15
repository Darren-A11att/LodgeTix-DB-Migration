/**
 * Main invoice service that provides a simple API for invoice generation
 * This is the primary interface for using the invoice generation system
 */

import { InvoiceGeneratorFactory } from './invoice-generator-factory';
import { 
  Invoice, 
  PaymentData, 
  RegistrationData, 
  InvoiceGeneratorOptions 
} from './types';

export interface InvoiceServiceOptions {
  payment: PaymentData;
  registration: RegistrationData;
  invoiceNumbers?: {
    customerInvoiceNumber?: string;
    supplierInvoiceNumber?: string;
  };
  functionName?: string;
  relatedDocuments?: any;
}

export class InvoiceService {
  /**
   * Generate a customer invoice based on registration type
   */
  static async generateCustomerInvoice(options: InvoiceServiceOptions): Promise<Invoice> {
    const { registration } = options;
    
    // Create appropriate generator based on registration type
    const generator = InvoiceGeneratorFactory.createFromRegistration(registration);
    
    // Generate the invoice
    const generatorOptions: InvoiceGeneratorOptions = {
      payment: options.payment,
      registration: options.registration,
      invoiceNumbers: options.invoiceNumbers,
      functionName: options.functionName,
      relatedDocuments: options.relatedDocuments
    };
    
    return generator.generateInvoice(generatorOptions);
  }

  /**
   * Generate a supplier invoice from a customer invoice
   */
  static async generateSupplierInvoice(
    customerInvoice: Invoice, 
    options: InvoiceServiceOptions
  ): Promise<Invoice> {
    // Create supplier invoice generator
    const generator = InvoiceGeneratorFactory.createSupplierGenerator();
    
    // Generate the supplier invoice
    const generatorOptions: InvoiceGeneratorOptions = {
      payment: options.payment,
      registration: options.registration,
      invoiceNumbers: options.invoiceNumbers,
      functionName: options.functionName,
      relatedDocuments: options.relatedDocuments,
      customerInvoice: customerInvoice
    };
    
    return generator.generateInvoice(generatorOptions);
  }

  /**
   * Generate both customer and supplier invoices
   */
  static async generateInvoicePair(options: InvoiceServiceOptions): Promise<{
    customerInvoice: Invoice;
    supplierInvoice: Invoice;
  }> {
    // Generate customer invoice first
    const customerInvoice = await this.generateCustomerInvoice(options);
    
    // Generate supplier invoice based on customer invoice
    const supplierInvoice = await this.generateSupplierInvoice(customerInvoice, options);
    
    return {
      customerInvoice,
      supplierInvoice
    };
  }

  /**
   * Generate an invoice for a specific type
   */
  static async generateInvoice(
    type: 'customer' | 'supplier',
    options: InvoiceServiceOptions,
    customerInvoice?: Invoice
  ): Promise<Invoice> {
    if (type === 'customer') {
      return this.generateCustomerInvoice(options);
    } else {
      if (!customerInvoice) {
        throw new Error('Customer invoice is required for supplier invoice generation');
      }
      return this.generateSupplierInvoice(customerInvoice, options);
    }
  }

  /**
   * Validate if payment and registration data is sufficient for invoice generation
   */
  static validateInvoiceData(payment: PaymentData, registration: RegistrationData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Validate payment
    if (!payment) {
      errors.push('Payment data is required');
    } else {
      if (!payment.amount && !payment.grossAmount) {
        errors.push('Payment amount is required');
      }
      if (!payment.paymentDate && !payment.timestamp && !payment.createdAt) {
        errors.push('Payment date is required');
      }
    }
    
    // Validate registration
    if (!registration) {
      errors.push('Registration data is required');
    } else {
      if (!registration.confirmationNumber) {
        errors.push('Registration confirmation number is recommended');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get the registration type display name
   */
  static getRegistrationType(registration: RegistrationData): string {
    return InvoiceGeneratorFactory.getRegistrationTypeDisplay(registration);
  }

  /**
   * Check if a registration is for individuals
   */
  static isIndividualsRegistration(registration: RegistrationData): boolean {
    return InvoiceGeneratorFactory.isIndividualsRegistration(registration);
  }

  /**
   * Check if a registration is for a lodge
   */
  static isLodgeRegistration(registration: RegistrationData): boolean {
    return InvoiceGeneratorFactory.isLodgeRegistration(registration);
  }
}