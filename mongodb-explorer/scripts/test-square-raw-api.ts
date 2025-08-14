#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRawSquareAPI() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  
  console.log('Testing raw Square API...');
  
  const response = await fetch('https://connect.squareup.com/v2/payments?limit=100', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Square-Version': '2025-06-18',
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json() as any;
  
  console.log('\nResponse status:', response.status);
  console.log('Payments found:', data.payments?.length);
  console.log('Has cursor:', Boolean(data.cursor));
  
  if (data.cursor) {
    console.log('Cursor (first 50 chars):', data.cursor.substring(0, 50) + '...');
    
    // Try page 2
    console.log('\nFetching page 2...');
    const page2Response = await fetch(`https://connect.squareup.com/v2/payments?limit=100&cursor=${encodeURIComponent(data.cursor)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2025-06-18',
        'Content-Type': 'application/json'
      }
    });
    
    const page2Data = await page2Response.json() as any;
    console.log('Page 2 payments:', page2Data.payments?.length);
    console.log('Page 2 has cursor:', Boolean(page2Data.cursor));
    
    // Count all pages
    let totalPayments = data.payments?.length || 0;
    let cursor = data.cursor;
    let pages = 1;
    
    while (cursor && pages < 10) {
      const pageResponse = await fetch(`https://connect.squareup.com/v2/payments?limit=100&cursor=${encodeURIComponent(cursor)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Square-Version': '2025-06-18',
          'Content-Type': 'application/json'
        }
      });
      
      const pageData = await pageResponse.json() as any;
      if (pageData.payments) {
        totalPayments += pageData.payments.length;
        pages++;
        console.log(`Page ${pages}: ${pageData.payments.length} payments`);
      }
      cursor = pageData.cursor;
    }
    
    console.log('\nTotal payments found:', totalPayments);
    console.log('Total pages:', pages);
  }
}

testRawSquareAPI().catch(console.error);