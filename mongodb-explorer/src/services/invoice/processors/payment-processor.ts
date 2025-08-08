/**
 * Payment processor for extracting and formatting payment data
 * Handles payment method formatting, source detection, and payment details extraction
 */

import { PaymentData, InvoicePayment } from '../types';
import { getMonetaryValue } from '../calculators/monetary';

export class PaymentProcessor {
  /**
   * Process payment data and extract formatted payment information
   * Updated to use unified payment structure
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
      source: this.detectPaymentSource(payment) as 'stripe' | 'square',
      sourcePaymentId: payment.sourcePaymentId,
      receiptUrl: this.extractReceiptUrl(payment),
      fees: this.extractProcessingFees(payment)
    };
  }

  /**
   * Format payment method removing duplicates and normalizing
   */
  formatPaymentMethod(payment: PaymentData): string {
    // Check unified payment method structure first
    let method = payment.paymentMethod?.type || 
                 payment.paymentMethod || 
                 payment.method || 
                 'credit_card';
    
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
   * Updated to use unified payment structure
   */
  private extractTransactionId(payment: PaymentData): string {
    return payment.id ||                          // Unified ID
           payment.sourcePaymentId ||              // Original source ID
           payment.transactionId ||                // Legacy field
           payment.paymentId ||                    // Legacy field
           payment.rawData?.id ||                  // From rawData
           payment.originalData?.id ||             // Legacy originalData
           payment.stripePaymentIntentId ||        // Legacy Stripe field
           payment.squarePaymentId ||              // Legacy Square field
           payment._id?.toString() ||
           '';
  }

  /**
   * Extract payment date with fallbacks
   * Updated to use unified payment structure
   */
  private extractPaymentDate(payment: PaymentData): string | Date {
    const date = payment.createdAt ||              // Unified timestamp
                 payment.paymentDate ||            // Legacy field
                 payment.timestamp ||              // Legacy field
                 payment.created ||                // Legacy field
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
   * Updated to use unified payment structure
   */
  private extractLast4(payment: PaymentData): string {
    // Check unified payment method structure first
    if (payment.paymentMethod?.last4) {
      return payment.paymentMethod.last4;
    }
    
    return payment.last4 ||                       // Unified field name
           payment.cardLast4 ||                   // Legacy field
           payment.rawData?.last4 ||              // From rawData
           payment.originalData?.source?.last4 || // Legacy originalData
           payment.card?.last4 ||                 // Legacy field
           '';
  }

  /**
   * Extract card brand
   * Updated to use unified payment structure
   */
  private extractCardBrand(payment: PaymentData): string {
    // Check unified payment method structure first
    const brand = payment.paymentMethod?.brand ||    // Unified structure
                  payment.cardBrand ||              // Legacy field
                  payment.brand ||                  // Legacy field
                  payment.rawData?.cardBrand ||     // From rawData
                  payment.originalData?.source?.brand || // Legacy originalData
                  payment.card?.brand ||            // Legacy field
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
   * Updated to use unified payment structure
   */
  detectPaymentSource(payment: PaymentData): string {
    // Unified source field (primary)
    if (payment.source) {
      return payment.source.toLowerCase();
    }
    
    // Check source file (legacy)
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
    
    // Check for platform-specific fields (legacy)
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
   * Updated to use unified payment structure
   */
  extractStatementDescriptor(payment: PaymentData): string | undefined {
    return payment.statementDescriptor ||           // Legacy field
           payment.statement_descriptor ||          // Legacy field
           payment.rawData?.statement_descriptor || // From rawData
           payment.originalData?.statement_descriptor || // Legacy originalData
           payment.description;                     // Legacy field
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
    // Check unified fees first
    if (payment.fees !== undefined) {
      return getMonetaryValue(payment.fees);
    }
    
    // Check fee details structure for comprehensive fees
    if (payment.feeDetails) {
      let totalFees = 0;
      
      // Add platform fees
      if (payment.feeDetails.platformFee) {
        totalFees += getMonetaryValue(payment.feeDetails.platformFee);
      }
      
      // Add Stripe fees
      if (payment.feeDetails.stripeFee) {
        totalFees += getMonetaryValue(payment.feeDetails.stripeFee);
      }
      
      // Add Square fees
      if (payment.feeDetails.squareFee) {
        totalFees += getMonetaryValue(payment.feeDetails.squareFee);
      }
      
      // Add processing fees array (Square)
      if (payment.feeDetails.processingFees && Array.isArray(payment.feeDetails.processingFees)) {
        payment.feeDetails.processingFees.forEach(fee => {
          totalFees += getMonetaryValue(fee.amount);
        });
      }
      
      if (totalFees > 0) {
        return totalFees;
      }
    }
    
    // Calculate from gross and net if available
    if (payment.grossAmount !== undefined && payment.amount !== undefined) {
      const gross = getMonetaryValue(payment.grossAmount);
      const net = getMonetaryValue(payment.amount);
      return gross - net;
    }
    
    // Try netAmount calculation
    if (payment.amount !== undefined && payment.netAmount !== undefined) {
      const amount = getMonetaryValue(payment.amount);
      const net = getMonetaryValue(payment.netAmount);
      return amount - net;
    }
    
    return undefined;
  }

  /**
   * Extract receipt URL from payment data
   * Updated to use unified payment structure
   */
  private extractReceiptUrl(payment: PaymentData): string | undefined {
    // Check unified receipt structure
    if (payment.receipt?.url) {
      return payment.receipt.url;
    }
    
    // Legacy fields
    return payment.receiptUrl || 
           payment.receipt_url ||
           payment.rawData?.receiptUrl ||
           payment.rawData?.receipt_url ||
           payment.rawData?.stripe?.charges?.data?.[0]?.receipt_url ||
           payment.rawData?.square?.receiptUrl ||
           undefined;
  }
}