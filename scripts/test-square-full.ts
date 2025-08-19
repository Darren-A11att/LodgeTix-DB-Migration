#!/usr/bin/env tsx

import { SquareClient, SquareEnvironment } from 'square';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Production
});

async function getAllSquarePayments() {
  console.log('Fetching ALL Square payments...\n');
  
  let allPayments: any[] = [];
  let response = await client.payments.list({ limit: 100 });
  
  // Process first page
  if (response.data) {
    allPayments = allPayments.concat(response.data);
    console.log(`Page 1: ${response.data.length} payments`);
  }
  
  // Process remaining pages using SDK's built-in pagination
  let pageNum = 2;
  try {
    while ((response as any).loadNextPage && typeof (response as any).loadNextPage === 'function') {
      const nextResponse = await (response as any).loadNextPage();
      if (nextResponse && nextResponse.data && nextResponse.data.length > 0) {
        allPayments = allPayments.concat(nextResponse.data);
        console.log(`Page ${pageNum}: ${nextResponse.data.length} payments`);
        pageNum++;
        response = nextResponse;
      } else {
        break; // No more data
      }
    }
  } catch (error) {
    console.log('No more pages available');
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total payments found: ${allPayments.length}`);
  
  // Analyze payments
  const completed = allPayments.filter(p => p.status === 'COMPLETED').length;
  const failed = allPayments.filter(p => p.status === 'FAILED').length;
  const canceled = allPayments.filter(p => p.status === 'CANCELED').length;
  
  console.log(`  Completed: ${completed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Canceled: ${canceled}`);
  
  // Check for refunds
  const refunded = allPayments.filter(p => 
    p.refundedMoney && p.refundedMoney.amount > 0
  ).length;
  console.log(`  Refunded: ${refunded}`);
  
  // Sample first few payments
  console.log('\nFirst 3 payments:');
  allPayments.slice(0, 3).forEach(p => {
    console.log(`  - ${p.id}: ${p.status}, ${p.totalMoney?.amount}${p.totalMoney?.currency}`);
  });
  
  return allPayments;
}

getAllSquarePayments().catch(console.error);