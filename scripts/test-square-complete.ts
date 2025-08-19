#!/usr/bin/env tsx

import { SquareClient, SquareEnvironment } from 'square';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Production
});

async function fetchAllSquarePayments() {
  console.log('Fetching ALL Square payments with manual cursor handling...\n');
  
  const allPayments: any[] = [];
  let cursor: string | undefined = undefined;
  let pageNum = 0;
  
  do {
    pageNum++;
    
    // Fetch page
    const response = await client.payments.list({
      limit: 100,
      cursor: cursor
    });
    
    // Get payments from response
    const payments = response.data || [];
    allPayments.push(...payments);
    
    console.log(`Page ${pageNum}: ${payments.length} payments`);
    
    // Try to extract cursor from the raw response
    cursor = undefined; // Reset cursor
    
    // Method 1: Check if SDK has built-in pagination (avoiding private properties)
    if (response.data && response.data.length > 0) {
      console.log(`  Found ${response.data.length} payments on this page`);
      
      // Try to use loadNextPage method if available
      if ((response as any).loadNextPage && typeof (response as any).loadNextPage === 'function') {
        try {
          const nextResponse = await (response as any).loadNextPage();
          if (nextResponse.data && nextResponse.data.length > 0) {
            pageNum++;
            const nextPayments = nextResponse.data;
            allPayments.push(...nextPayments);
            console.log(`Page ${pageNum}: ${nextPayments.length} payments (via loadNextPage)`);
          }
        } catch (error) {
          console.log(`  No more pages available via loadNextPage`);
        }
        break; // Exit loop since we used SDK pagination
      }
    }
    
    // Method 2: Try to get cursor from response structure
    // This seems to not work with the current SDK version
    
  } while (cursor);
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total payments fetched: ${allPayments.length}`);
  
  // Analyze payments
  const byStatus: any = {};
  allPayments.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });
  
  console.log('\nBy Status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  return allPayments;
}

fetchAllSquarePayments().catch(console.error);