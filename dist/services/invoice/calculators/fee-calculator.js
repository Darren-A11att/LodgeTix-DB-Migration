"use strict";
/**
 * Fee calculation utilities for invoice generation
 * Handles processing fees, software utilization fees, and GST calculations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOFTWARE_UTILIZATION_RATES = exports.PROCESSING_FEE_RATES = void 0;
exports.calculateProcessingFees = calculateProcessingFees;
exports.calculateProcessingFeesFromTotal = calculateProcessingFeesFromTotal;
exports.calculateSoftwareUtilizationFee = calculateSoftwareUtilizationFee;
exports.calculateGSTIncluded = calculateGSTIncluded;
exports.calculateGSTToAdd = calculateGSTToAdd;
exports.calculateCustomerInvoiceTotals = calculateCustomerInvoiceTotals;
exports.calculateCustomerInvoiceTotalsFromTotal = calculateCustomerInvoiceTotalsFromTotal;
exports.calculateSupplierInvoiceTotals = calculateSupplierInvoiceTotals;
const monetary_1 = require("./monetary");
/**
 * Standard processing fee rates for different payment sources
 */
exports.PROCESSING_FEE_RATES = {
    stripe: {
        percentage: 0.025, // 2.5%
        fixed: 0.30 // $0.30 AUD
    },
    square: {
        percentage: 0.025, // 2.5%
        fixed: 0.30 // $0.30 AUD
    },
    default: {
        percentage: 0.025, // 2.5%
        fixed: 0.30 // $0.30 AUD
    }
};
/**
 * Software utilization fee rates for supplier invoices
 */
exports.SOFTWARE_UTILIZATION_RATES = {
    stripe: 0.033, // 3.3%
    square: 0.028, // 2.8%
    default: 0.020 // 2.0% (fallback)
};
/**
 * Calculate processing fees for a given amount and payment source
 * Standard formula: 2.5% + $0.30
 * @param subtotal - The subtotal amount before fees
 * @param source - Payment source (stripe, square, etc.)
 * @returns Processing fees rounded to 2 decimal places
 */
function calculateProcessingFees(subtotal, source = 'default') {
    const rates = exports.PROCESSING_FEE_RATES[source.toLowerCase()] || exports.PROCESSING_FEE_RATES.default;
    const percentageFee = subtotal * rates.percentage;
    const totalFee = percentageFee + rates.fixed;
    return (0, monetary_1.roundToMoney)(totalFee);
}
/**
 * Calculate processing fees from total and subtotal (reverse calculation)
 * Used when we have the total payment amount and need to determine fees
 * @param total - Total amount paid
 * @param subtotal - Subtotal before fees
 * @returns Processing fees as the difference
 */
function calculateProcessingFeesFromTotal(total, subtotal) {
    return (0, monetary_1.roundToMoney)(total - subtotal);
}
/**
 * Calculate software utilization fee for supplier invoices
 * Rate varies by payment source: 3.3% for Stripe, 2.8% for Square
 * @param amount - Base amount to calculate fee from
 * @param source - Payment source (stripe, square, etc.)
 * @returns Software utilization fee rounded to 2 decimal places
 */
function calculateSoftwareUtilizationFee(amount, source = 'default') {
    const rate = exports.SOFTWARE_UTILIZATION_RATES[source.toLowerCase()] || exports.SOFTWARE_UTILIZATION_RATES.default;
    return (0, monetary_1.calculatePercentage)(amount, rate);
}
/**
 * Calculate GST (Goods and Services Tax) from a GST-inclusive amount
 * Australian GST calculation: GST = Total / 11
 * @param totalIncludingGST - Total amount including GST
 * @returns GST amount rounded to 2 decimal places
 */
function calculateGSTIncluded(totalIncludingGST) {
    return (0, monetary_1.roundToMoney)(totalIncludingGST / 11);
}
/**
 * Calculate GST to add to a base amount
 * @param baseAmount - Amount before GST
 * @param gstRate - GST rate as decimal (default: 0.10 for 10%)
 * @returns GST amount to add
 */
function calculateGSTToAdd(baseAmount, gstRate = 0.10) {
    return (0, monetary_1.calculatePercentage)(baseAmount, gstRate);
}
/**
 * Calculate all fees for a customer invoice
 * @param subtotal - Base amount before fees
 * @param paymentSource - Payment source for fee calculation
 * @returns Object containing all calculated amounts
 */
function calculateCustomerInvoiceTotals(subtotal, paymentSource = 'default') {
    const processingFees = calculateProcessingFees(subtotal, paymentSource);
    const totalBeforeGST = subtotal + processingFees;
    const gstIncluded = calculateGSTIncluded(totalBeforeGST);
    const total = totalBeforeGST; // GST is included in the total
    return {
        subtotal: (0, monetary_1.roundToMoney)(subtotal),
        processingFees,
        totalBeforeGST: (0, monetary_1.roundToMoney)(totalBeforeGST),
        gstIncluded,
        total: (0, monetary_1.roundToMoney)(total)
    };
}
/**
 * Calculate fees from a known total amount (reverse calculation)
 * Used when we have the payment amount and need to work backwards
 * @param totalAmount - Total amount paid
 * @param paymentSource - Payment source for fee calculation
 * @returns Object containing all calculated amounts
 */
function calculateCustomerInvoiceTotalsFromTotal(totalAmount, paymentSource = 'default') {
    // Work backwards from total
    // Total = Subtotal + Processing Fees
    // Processing Fees = Subtotal * rate + fixed
    // So: Total = Subtotal + (Subtotal * rate) + fixed
    // Total - fixed = Subtotal * (1 + rate)
    // Subtotal = (Total - fixed) / (1 + rate)
    const rates = exports.PROCESSING_FEE_RATES[paymentSource.toLowerCase()] || exports.PROCESSING_FEE_RATES.default;
    const subtotal = (totalAmount - rates.fixed) / (1 + rates.percentage);
    const processingFees = totalAmount - subtotal;
    const gstIncluded = calculateGSTIncluded(totalAmount);
    return {
        subtotal: (0, monetary_1.roundToMoney)(subtotal),
        processingFees: (0, monetary_1.roundToMoney)(processingFees),
        totalBeforeGST: (0, monetary_1.roundToMoney)(totalAmount),
        gstIncluded,
        total: (0, monetary_1.roundToMoney)(totalAmount)
    };
}
/**
 * Calculate totals for a supplier invoice
 * @param customerInvoiceTotal - Total from the customer invoice
 * @param processingFeesReimbursement - Processing fees to reimburse
 * @param paymentSource - Payment source for software utilization fee
 * @returns Object containing supplier invoice totals
 */
function calculateSupplierInvoiceTotals(customerInvoiceTotal, processingFeesReimbursement, paymentSource = 'default') {
    const softwareUtilizationFee = calculateSoftwareUtilizationFee(customerInvoiceTotal, paymentSource);
    const subtotal = processingFeesReimbursement + softwareUtilizationFee;
    const gstIncluded = calculateGSTIncluded(subtotal);
    return {
        processingFeesReimbursement: (0, monetary_1.roundToMoney)(processingFeesReimbursement),
        softwareUtilizationFee: (0, monetary_1.roundToMoney)(softwareUtilizationFee),
        subtotal: (0, monetary_1.roundToMoney)(subtotal),
        gstIncluded,
        total: (0, monetary_1.roundToMoney)(subtotal)
    };
}
