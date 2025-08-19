/**
 * Fee calculation utilities for invoice generation
 * Handles processing fees, software utilization fees, and GST calculations
 */

import { roundToMoney, calculatePercentage } from './monetary';

/**
 * Standard processing fee rates for different payment sources
 */
export const PROCESSING_FEE_RATES = {
  stripe: {
    percentage: 0.025,  // 2.5%
    fixed: 0.30         // $0.30 AUD
  },
  square: {
    percentage: 0.025,  // 2.5%
    fixed: 0.30         // $0.30 AUD
  },
  default: {
    percentage: 0.025,  // 2.5%
    fixed: 0.30         // $0.30 AUD
  }
};

/**
 * Software utilization fee rates for supplier invoices
 */
export const SOFTWARE_UTILIZATION_RATES = {
  stripe: 0.033,  // 3.3%
  square: 0.028,  // 2.8%
  default: 0.020  // 2.0% (fallback)
};

/**
 * Calculate processing fees for a given amount and payment source
 * Standard formula: 2.5% + $0.30
 * @param subtotal - The subtotal amount before fees
 * @param source - Payment source (stripe, square, etc.)
 * @param actualFees - Optional actual fees from payment data
 * @returns Processing fees rounded to 2 decimal places
 */
export function calculateProcessingFees(subtotal: number, source: string = 'default', actualFees?: number): number {
  // If actual fees are provided, use them
  if (actualFees !== undefined && actualFees > 0) {
    return roundToMoney(actualFees);
  }
  
  // Otherwise calculate using standard rates
  const rates = PROCESSING_FEE_RATES[source.toLowerCase() as keyof typeof PROCESSING_FEE_RATES] || PROCESSING_FEE_RATES.default;
  const percentageFee = subtotal * rates.percentage;
  const totalFee = percentageFee + rates.fixed;
  return roundToMoney(totalFee);
}

/**
 * Calculate processing fees from total and subtotal (reverse calculation)
 * Used when we have the total payment amount and need to determine fees
 * @param total - Total amount paid
 * @param subtotal - Subtotal before fees
 * @returns Processing fees as the difference
 */
export function calculateProcessingFeesFromTotal(total: number, subtotal: number): number {
  return roundToMoney(total - subtotal);
}

/**
 * Calculate software utilization fee for supplier invoices
 * Rate varies by payment source: 3.3% for Stripe, 2.8% for Square
 * @param amount - Base amount to calculate fee from
 * @param source - Payment source (stripe, square, etc.)
 * @returns Software utilization fee rounded to 2 decimal places
 */
export function calculateSoftwareUtilizationFee(amount: number, source: string = 'default'): number {
  const rate = SOFTWARE_UTILIZATION_RATES[source.toLowerCase() as keyof typeof SOFTWARE_UTILIZATION_RATES] || SOFTWARE_UTILIZATION_RATES.default;
  return calculatePercentage(amount, rate);
}

/**
 * Calculate GST (Goods and Services Tax) from a GST-inclusive amount
 * Australian GST calculation: GST = Total / 11
 * @param totalIncludingGST - Total amount including GST
 * @returns GST amount rounded to 2 decimal places
 */
export function calculateGSTIncluded(totalIncludingGST: number): number {
  return roundToMoney(totalIncludingGST / 11);
}

/**
 * Calculate GST to add to a base amount
 * @param baseAmount - Amount before GST
 * @param gstRate - GST rate as decimal (default: 0.10 for 10%)
 * @returns GST amount to add
 */
export function calculateGSTToAdd(baseAmount: number, gstRate: number = 0.10): number {
  return calculatePercentage(baseAmount, gstRate);
}

/**
 * Calculate all fees for a customer invoice
 * @param subtotal - Base amount before fees
 * @param paymentSource - Payment source for fee calculation
 * @param actualFees - Optional actual fees from payment data
 * @returns Object containing all calculated amounts
 */
export function calculateCustomerInvoiceTotals(subtotal: number, paymentSource: string = 'default', actualFees?: number) {
  const processingFees = calculateProcessingFees(subtotal, paymentSource, actualFees);
  const totalBeforeGST = subtotal + processingFees;
  const gstIncluded = calculateGSTIncluded(totalBeforeGST);
  const total = totalBeforeGST; // GST is included in the total
  
  return {
    subtotal: roundToMoney(subtotal),
    processingFees,
    totalBeforeGST: roundToMoney(totalBeforeGST),
    gstIncluded,
    total: roundToMoney(total)
  };
}

/**
 * Calculate fees from a known total amount (reverse calculation)
 * Used when we have the payment amount and need to work backwards
 * @param totalAmount - Total amount paid
 * @param paymentSource - Payment source for fee calculation
 * @returns Object containing all calculated amounts
 */
export function calculateCustomerInvoiceTotalsFromTotal(totalAmount: number, paymentSource: string = 'default') {
  // Work backwards from total
  // Total = Subtotal + Processing Fees
  // Processing Fees = Subtotal * rate + fixed
  // So: Total = Subtotal + (Subtotal * rate) + fixed
  // Total - fixed = Subtotal * (1 + rate)
  // Subtotal = (Total - fixed) / (1 + rate)
  
  const rates = PROCESSING_FEE_RATES[paymentSource.toLowerCase() as keyof typeof PROCESSING_FEE_RATES] || PROCESSING_FEE_RATES.default;
  const subtotal = (totalAmount - rates.fixed) / (1 + rates.percentage);
  const processingFees = totalAmount - subtotal;
  const gstIncluded = calculateGSTIncluded(totalAmount);
  
  return {
    subtotal: roundToMoney(subtotal),
    processingFees: roundToMoney(processingFees),
    totalBeforeGST: roundToMoney(totalAmount),
    gstIncluded,
    total: roundToMoney(totalAmount)
  };
}

/**
 * Calculate totals for a supplier invoice
 * @param customerInvoiceTotal - Total from the customer invoice
 * @param processingFeesReimbursement - Processing fees to reimburse
 * @param paymentSource - Payment source for software utilization fee
 * @returns Object containing supplier invoice totals
 */
export function calculateSupplierInvoiceTotals(
  customerInvoiceTotal: number, 
  processingFeesReimbursement: number,
  paymentSource: string = 'default'
) {
  const softwareUtilizationFee = calculateSoftwareUtilizationFee(customerInvoiceTotal, paymentSource);
  const subtotal = processingFeesReimbursement + softwareUtilizationFee;
  const gstIncluded = calculateGSTIncluded(subtotal);
  
  return {
    processingFeesReimbursement: roundToMoney(processingFeesReimbursement),
    softwareUtilizationFee: roundToMoney(softwareUtilizationFee),
    subtotal: roundToMoney(subtotal),
    gstIncluded,
    total: roundToMoney(subtotal)
  };
}