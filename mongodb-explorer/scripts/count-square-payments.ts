#!/usr/bin/env tsx

import { SquareClient, SquareEnvironment } from 'square';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment: SquareEnvironment.Production
});

async function countPayments() {
  console.log('Counting Square payments (1 at a time with cursor)...\n');
  
  let cursor: string | undefined = undefined;
  let totalPayments = 0;
  const startTime = Date.now();
  
  while (true) {
    // Fetch ONE payment at a time
    const response = await client.payments.list({
      limit: 1,
      cursor: cursor
    });
    
    const payments = response.data || [];
    
    if (payments.length === 0) {
      break;
    }
    
    totalPayments++;
    
    // Log progress every 50 payments
    if (totalPayments % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Counted ${totalPayments} payments... (${elapsed}s)`);
    }
    
    // Get cursor from response.response.cursor
    cursor = (response as any).response?.cursor;
    
    if (!cursor) {
      break;
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Total Square payments: ${totalPayments}`);
  console.log(`Time taken: ${elapsed} seconds`);
  console.log(`Average: ${(totalPayments / parseFloat(elapsed)).toFixed(1)} payments/second`);
  
  return totalPayments;
}

countPayments().catch(console.error);