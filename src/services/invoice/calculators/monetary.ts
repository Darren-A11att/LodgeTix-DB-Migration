/**
 * Monetary calculation utilities for invoice generation
 * Provides consistent handling of monetary values, calculations, and formatting
 */

/**
 * Safely extracts a numeric value from MongoDB Decimal128 or regular number
 * @param value - The value that might be a number, Decimal128, or undefined
 * @returns A number that can be safely used in calculations
 */
export function getMonetaryValue(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Handle MongoDB Decimal128
  if (value && typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal) || 0;
  }
  
  // Handle regular numbers
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}

/**
 * Rounds a monetary value to 2 decimal places
 * This prevents floating point precision issues
 * @param value - The numeric value to round
 * @returns Value rounded to 2 decimal places
 */
export function roundToMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formats a monetary value for display with currency symbol
 * @param value - The value that might be a number, Decimal128, or undefined
 * @param currency - Currency symbol (default: '$')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string for display
 */
export function formatMoney(value: any, currency: string = '$', decimals: number = 2): string {
  const numericValue = getMonetaryValue(value);
  return `${currency}${numericValue.toFixed(decimals)}`;
}

/**
 * Adds two monetary values with proper rounding
 * @param a - First value
 * @param b - Second value
 * @returns Sum rounded to 2 decimal places
 */
export function addMoney(a: number, b: number): number {
  return roundToMoney(a + b);
}

/**
 * Subtracts two monetary values with proper rounding
 * @param a - Value to subtract from
 * @param b - Value to subtract
 * @returns Difference rounded to 2 decimal places
 */
export function subtractMoney(a: number, b: number): number {
  return roundToMoney(a - b);
}

/**
 * Multiplies two values with proper rounding
 * Useful for calculating percentages or quantities
 * @param a - First value
 * @param b - Second value
 * @returns Product rounded to 2 decimal places
 */
export function multiplyMoney(a: number, b: number): number {
  return roundToMoney(a * b);
}

/**
 * Calculates a percentage of an amount
 * @param amount - Base amount
 * @param percentage - Percentage as decimal (e.g., 0.025 for 2.5%)
 * @returns Calculated percentage rounded to 2 decimal places
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return multiplyMoney(amount, percentage);
}

/**
 * Calculates GST from a total amount (Australian tax calculation)
 * GST is calculated as amount / 11 for GST-inclusive amounts
 * @param totalIncludingGST - Total amount including GST
 * @returns GST amount rounded to 2 decimal places
 */
export function calculateGSTFromTotal(totalIncludingGST: number): number {
  return roundToMoney(totalIncludingGST / 11);
}

