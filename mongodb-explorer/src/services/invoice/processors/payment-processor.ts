/**
 * Payment processor for extracting and formatting payment data
 * Handles payment method formatting, source detection, and payment details extraction
 */

import { PaymentData, InvoicePayment } from '../types';
import { getMonetaryValue } from '../calculators/monetary';

export class PaymentProcessor {
  /**
   * Process payment data and extract formatted payment information
   */
  process(payment: PaymentData): InvoicePayment {
    return {
      method: this.formatPaymentMethod(payment),
      transactionId: this.extractTransactionId(payment),
      paidDate: this.extractPaymentDate(payment),
      amount: this.extractPaymentAmount(payment),
      currency: payment.currency || 'AUD',
      last4: this.extractLast4(payment),
      cardBrand: this.extractCardBrand(payment),
      status: this.normalizePaymentStatus(payment),
      source: this.detectPaymentSource(payment)
    };
  }

  /**
   * Format payment method removing duplicates and normalizing
   */
  formatPaymentMethod(payment: PaymentData): string {
    let method = payment.paymentMethod || payment.method || 'credit_card';
    
    // Normalize method string
    method = method.toLowerCase().replace(/_/g, ' ');
    
    // Remove duplicate "card" text
    if (method === 'card card' || method === 'credit card card') {
      method = 'credit card';
    }
    
    // Handle common payment methods
    const methodMap: { [key: string]: string } = {
      'card': 'credit card',
      'credit': 'credit card',
      'debit': 'debit card',
      'bank': 'bank transfer',
      'transfer': 'bank transfer',
      'cash': 'cash',
      'cheque': 'cheque',
      'check': 'cheque',
      'paypal': 'PayPal',
      'stripe': 'credit card',
      'square': 'credit card'
    };
    
    // Apply mapping if exists
    const normalized = methodMap[method] || method;
    
    // Capitalize first letter of each word
    return normalized.replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Extract transaction ID with fallbacks
   */
  private extractTransactionId(payment: PaymentData): string {
    return payment.transactionId || 
           payment.paymentId || 
           payment.originalData?.id || 
           payment.stripePaymentIntentId ||
           payment.squarePaymentId ||
           payment._id?.toString() ||
           '';
  }

  /**
   * Extract payment date with fallbacks
   */
  private extractPaymentDate(payment: PaymentData): string | Date {
    const date = payment.paymentDate || 
                 payment.timestamp || 
                 payment.createdAt || 
                 payment.created ||
                 new Date();
    
    // Ensure it's a valid date
    if (date instanceof Date) {
      return date;
    }
    
    // Try to parse string date
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Extract payment amount with proper handling of fees
   */
  private extractPaymentAmount(payment: PaymentData): number {
    // Priority: grossAmount (includes fees) > amount
    const amount = payment.grossAmount || payment.amount || 0;
    return getMonetaryValue(amount);
  }

  /**
   * Extract last 4 digits of card
   */
  private extractLast4(payment: PaymentData): string {
    return payment.cardLast4 || 
           payment.last4 || 
           payment.originalData?.source?.last4 ||
           payment.card?.last4 ||
           '';
  }

  /**
   * Extract card brand
   */
  private extractCardBrand(payment: PaymentData): string {
    const brand = payment.cardBrand || 
                  payment.brand || 
                  payment.originalData?.source?.brand ||
                  payment.card?.brand ||
                  '';
    
    // Normalize common brand names
    const brandMap: { [key: string]: string } = {
      'visa': 'Visa',
      'mastercard': 'Mastercard',
      'master': 'Mastercard',
      'amex': 'American Express',
      'american_express': 'American Express',
      'discover': 'Discover',
      'diners': 'Diners Club',
      'diners_club': 'Diners Club',
      'jcb': 'JCB',
      'unionpay': 'UnionPay',
      'union_pay': 'UnionPay'
    };
    
    const normalized = brand.toLowerCase().replace(/[^a-z]/g, '');
    return brandMap[normalized] || brand;
  }

  /**
   * Normalize payment status
   */
  private normalizePaymentStatus(payment: PaymentData): string {
    const status = payment.status || 'completed';
    
    // Normalize to lowercase
    const normalized = status.toLowerCase();
    
    // Map common statuses
    const statusMap: { [key: string]: string } = {
      'paid': 'completed',
      'succeeded': 'completed',
      'success': 'completed',
      'complete': 'completed',
      'completed': 'completed',
      'pending': 'pending',
      'processing': 'pending',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'refunded': 'refunded'
    };
    
    return statusMap[normalized] || 'completed';
  }

  /**
   * Detect payment source from various fields
   */
  detectPaymentSource(payment: PaymentData): string {
    // Explicit source field
    if (payment.source) {
      return payment.source.toLowerCase();
    }
    
    // Check source file
    if (payment.sourceFile) {
      const sourceFile = payment.sourceFile.toLowerCase();
      if (sourceFile.includes('stripe')) return 'stripe';
      if (sourceFile.includes('square')) return 'square';
      if (sourceFile.includes('paypal')) return 'paypal';
    }
    
    // Check transaction ID patterns
    const transactionId = this.extractTransactionId(payment);
    if (transactionId.startsWith('pi_') || transactionId.startsWith('ch_')) {
      return 'stripe';
    }
    if (transactionId.length === 32 && /^[A-Z0-9]+$/.test(transactionId)) {
      return 'square';
    }
    
    // Check for platform-specific fields
    if (payment.stripePaymentIntentId || payment.stripeChargeId) {
      return 'stripe';
    }
    if (payment.squarePaymentId || payment.squareOrderId) {
      return 'square';
    }
    
    // Default
    return 'unknown';
  }

  /**
   * Extract statement descriptor for display
   */
  extractStatementDescriptor(payment: PaymentData): string | undefined {
    return payment.statementDescriptor || 
           payment.statement_descriptor ||
           payment.originalData?.statement_descriptor ||
           payment.description;
  }

  /**
   * Get payment source display name
   */
  getPaymentSourceDisplayName(source: string): string {
    const displayNames: { [key: string]: string } = {
      'stripe': 'Stripe',
      'square': 'Square',
      'paypal': 'PayPal',
      'manual': 'Manual Entry',
      'unknown': 'Payment Processor'
    };
    
    return displayNames[source.toLowerCase()] || source;
  }

  /**
   * Check if payment is from a specific source
   */
  isPaymentFromSource(payment: PaymentData, source: string): boolean {
    const detectedSource = this.detectPaymentSource(payment);
    return detectedSource.toLowerCase() === source.toLowerCase();
  }

  /**
   * Extract processing fees if available
   */
  extractProcessingFees(payment: PaymentData): number | undefined {
    if (payment.fees !== undefined) {
      return getMonetaryValue(payment.fees);
    }
    
    // Calculate from gross and net if available
    if (payment.grossAmount !== undefined && payment.amount !== undefined) {
      const gross = getMonetaryValue(payment.grossAmount);
      const net = getMonetaryValue(payment.amount);
      return gross - net;
    }
    
    return undefined;
  }
}