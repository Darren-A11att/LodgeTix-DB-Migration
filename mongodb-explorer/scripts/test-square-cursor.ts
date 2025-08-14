#!/usr/bin/env tsx

import { SquareClient, SquareEnvironment } from 'square';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Production
});

async function testCursorPagination() {
  console.log('Testing Square cursor pagination (1 payment at a time)...\n');
  
  let cursor: string | undefined = undefined;
  let totalPayments = 0;
  const maxPages = 300; // Safety limit
  
  for (let page = 1; page <= maxPages; page++) {
    // Fetch ONE payment at a time
    const response = await client.payments.list({
      limit: 1,
      cursor: cursor
    });
    
    const payments = response.data || [];
    
    if (payments.length === 0) {
      console.log(`Page ${page}: No payments returned - END`);
      break;
    }
    
    totalPayments += payments.length;
    
    // Log progress every 10 payments
    if (totalPayments % 10 === 0 || totalPayments <= 5) {
      const payment = payments[0];
      console.log(`Payment ${totalPayments}: ${payment.id} - ${payment.status} - ${payment.createdAt}`);
    }
    
    // Extract cursor from response
    cursor = undefined;
    
    // Method 1: Try to get from response body
    try {
      const rawBody = (response as any).response?.body;
      if (rawBody) {
        const parsed = JSON.parse(rawBody);
        cursor = parsed.cursor;
        
        if (!cursor) {
          console.log(`\nNo cursor after ${totalPayments} payments - END`);
          break;
        }
      } else {
        console.log('No raw body available in response');
        break;
      }
    } catch (e) {
      console.log('Error extracting cursor:', e);
      break;
    }
  }
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total Square payments fetched: ${totalPayments}`);
  
  return totalPayments;
}

testCursorPagination().catch(console.error);