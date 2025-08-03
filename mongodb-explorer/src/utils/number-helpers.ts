/**
 * Utility functions for number handling in imports
 */

/**
 * Rounds a number to 2 decimal places
 * Handles various input types safely
 */
export function roundToTwoDecimals(value: any): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Handle MongoDB Decimal128
  if (value.$numberDecimal !== undefined) {
    value = value.$numberDecimal;
  }
  
  // Convert to number
  const num = typeof value === 'number' ? value : parseFloat(value);
  
  // Check for valid number
  if (isNaN(num)) {
    return 0;
  }
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

/**
 * Safely parses and rounds a price value
 * @param value - The value to parse (can be number, string, Decimal128, etc.)
 * @param fallback - Fallback value if parsing fails (default: 0)
 */
export function parsePrice(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) {
    return roundToTwoDecimals(fallback);
  }
  
  // Handle MongoDB Decimal128
  if (value.$numberDecimal !== undefined) {
    return roundToTwoDecimals(value.$numberDecimal);
  }
  
  // Handle already numeric values
  if (typeof value === 'number') {
    return roundToTwoDecimals(value);
  }
  
  // Try to parse string values
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? roundToTwoDecimals(fallback) : roundToTwoDecimals(parsed);
  }
  
  return roundToTwoDecimals(fallback);
}

/**
 * Formats a number as a currency string for logging
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}