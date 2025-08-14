import { SquareClient } from 'square';

/**
 * Workaround for Square SDK pagination issue
 * The SDK's _hasNextPage() incorrectly returns false even when there are more pages
 * This function extracts the cursor from the raw API response
 */
export async function fetchAllSquarePayments(client: SquareClient): Promise<any[]> {
  const allPayments: any[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  
  // Use raw API calls for reliable pagination
  const token = (client as any).config?.accessToken || process.env.SQUARE_ACCESS_TOKEN;
  const environment = (client as any).config?.environment || 'production';
  const baseUrl = environment === 'production' 
    ? 'https://connect.squareup.com' 
    : 'https://connect.squareupsandbox.com';
  
  do {
    pageCount++;
    
    // Build URL with cursor if available
    let url = `${baseUrl}/v2/payments?limit=100`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    
    // Make raw API call
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2025-06-18',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Square API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (data.payments && data.payments.length > 0) {
      // Convert to SDK format (camelCase)
      const sdkPayments = data.payments.map((p: any) => convertToCamelCase(p));
      allPayments.push(...sdkPayments);
    }
    
    // Get cursor for next page
    cursor = data.cursor;
    
  } while (cursor);
  
  return allPayments;
}

/**
 * Convert snake_case API response to camelCase SDK format
 */
function convertToCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(convertToCamelCase);
  
  const converted: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    converted[camelKey] = convertToCamelCase(obj[key]);
  }
  return converted;
}

/**
 * Process Square payments in batches with proper pagination
 */
export async function* iterateSquarePayments(client: SquareClient, batchSize: number = 100): AsyncGenerator<any[]> {
  const token = (client as any).config?.accessToken || process.env.SQUARE_ACCESS_TOKEN;
  const environment = (client as any).config?.environment || 'production';
  const baseUrl = environment === 'production' 
    ? 'https://connect.squareup.com' 
    : 'https://connect.squareupsandbox.com';
  
  let cursor: string | undefined = undefined;
  
  do {
    let url = `${baseUrl}/v2/payments?limit=${batchSize}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2025-06-18',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Square API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    if (data.payments && data.payments.length > 0) {
      // Convert to SDK format
      const sdkPayments = data.payments.map((p: any) => convertToCamelCase(p));
      yield sdkPayments;
    }
    
    cursor = data.cursor;
    
  } while (cursor);
}