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
    
    // Extract cursor from response.response.cursor
    cursor = (response as any).response?.cursor;
    
    if (!cursor) {
      console.log(`\nNo cursor after ${totalPayments} payments - END`);
      break;
    }
  }
  
  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total Square payments fetched: ${totalPayments}`);
  
  // Analyze payment statuses
  console.log('\nFetching all to analyze...');
  let allPayments: any[] = [];
  cursor = undefined;
  
  for (let i = 0; i < totalPayments; i++) {
    const r = await client.payments.list({ limit: 1, cursor });
    if (r.data && r.data.length > 0) {
      allPayments.push(r.data[0]);
    }
    cursor = (r as any).response?.cursor;
    if (!cursor) break;
  }
  
  const byStatus: any = {};
  allPayments.forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });
  
  console.log('\nPayments by status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  return totalPayments;
}

testCursorPagination().catch(console.error);