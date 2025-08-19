export function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (value instanceof Date) return `"${value.toISOString()}"`;
  
  // Handle MongoDB Decimal128
  if (value && value.$numberDecimal) {
    return value.$numberDecimal;
  }
  
  // Handle MongoDB ObjectId
  if (value && value.$oid) {
    return `"${value.$oid}"`;
  }
  
  return JSON.stringify(value);
}

export function parseValue(text: string): any {
  text = text.trim();
  
  // Handle null/undefined
  if (text === 'null') return null;
  if (text === 'undefined') return undefined;
  
  // Handle booleans
  if (text === 'true') return true;
  if (text === 'false') return false;
  
  // Handle numbers
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return parseFloat(text);
  }
  
  // Handle strings (with or without quotes)
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  
  // Try to parse as JSON
  try {
    return JSON.parse(text);
  } catch {
    // If all else fails, return as string
    return text;
  }
}