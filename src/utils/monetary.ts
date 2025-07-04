/**
 * Utility functions for handling monetary values from MongoDB
 */

/**
 * Safely extracts a numeric value from MongoDB Decimal128 or regular number
 * @param value - The value that might be a number, Decimal128, or undefined
 * @returns A number that can be safely rendered in React
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
 * Formats a monetary value for display with currency symbol
 * @param value - The value that might be a number, Decimal128, or undefined
 * @param currency - Currency symbol (default: '$')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string safe for React rendering
 */
export function formatMoney(value: any, currency: string = '$', decimals: number = 2): string {
  const numericValue = getMonetaryValue(value);
  return `${currency}${numericValue.toFixed(decimals)}`;
}

/**
 * Gets a monetary value from a nested path in an object
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., 'payment.amount')
 * @returns The numeric value or 0
 */
export function getMonetaryValueByPath(obj: any, path: string): number {
  if (!obj || !path) return 0;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return 0;
    }
    current = current[part];
  }
  
  return getMonetaryValue(current);
}