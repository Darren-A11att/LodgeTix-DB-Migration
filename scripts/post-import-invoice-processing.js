#!/usr/bin/env node

/**
 * Post-Import Invoice Processing
 * 
 * This script runs after the sync-all-data.js import process
 * to automatically generate invoices for newly matched payments
 * 
 * Uses the unified invoice service for consistency with UI
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const path = require('path');

// Import the JavaScript invoice service wrapper
const InvoiceServiceWrapper = require('./invoice-service-wrapper');

async function processNewInvoices() {
  console.log('=== POST-IMPORT INVOICE PROCESSING ===\n');
  
  let client = null;
  
  try {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI;
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
    
    // Initialize the invoice service wrapper
    const invoiceService = new InvoiceServiceWrapper(db);
    
    // Process invoices for payments imported in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    console.log(`Processing invoices for payments imported after: ${oneHourAgo.toISOString()}\n`);
    
    // Use batch processing
    const result = await invoiceService.batchProcessInvoices({
      dateFrom: oneHourAgo,
      limit: 1000,
      regenerate: false
    });
    
    console.log('\n✅ Invoice processing complete');
    console.log(`Generated ${result.processed} invoices`);
    
    if (result.failed > 0) {
      console.log(`⚠️  ${result.failed} invoices failed to generate`);
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
        if (result.errors.length > 10) {
          console.log(`  ... and ${result.errors.length - 10} more errors`);
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Invoice processing failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Export for use in sync-all-data.js
module.exports = { processNewInvoices };

// Run if called directly
if (require.main === module) {
  processNewInvoices()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}