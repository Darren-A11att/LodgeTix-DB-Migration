#!/usr/bin/env node

/**
 * Final test to reprocess the original invoice using our findings
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Original IDs from the user's request
const PAYMENT_ID = '685c0b9df861ce10c3124785';
const REGISTRATION_ID = '685beba0b2fa6b693adabc1e';
const CUSTOMER_INVOICE_NUMBER = 'LTIV-250625032';
const SUPPLIER_INVOICE_NUMBER = 'LTSP-250625032';

async function reprocessOriginalInvoice() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('REPROCESSING ORIGINAL INVOICE');
    console.log('========================================\n');
    console.log('Target Invoice Numbers:');
    console.log('- Customer:', CUSTOMER_INVOICE_NUMBER);
    console.log('- Supplier:', SUPPLIER_INVOICE_NUMBER);
    
    // Call our reprocess script
    const { spawn } = require('child_process');
    const reprocess = spawn('node', ['scripts/reprocess-invoice.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    reprocess.on('close', async (code) => {
      if (code === 0) {
        console.log('\n✅ Reprocessing completed successfully!');
        
        // Verify the results
        console.log('\nVerifying results...');
        
        const payment = await db.collection('payments').findOne({ 
          _id: new ObjectId(PAYMENT_ID) 
        });
        console.log('- Payment.customerInvoiceNumber:', payment?.customerInvoiceNumber);
        
        const registration = await db.collection('registrations').findOne({ 
          _id: new ObjectId(REGISTRATION_ID) 
        });
        console.log('- Registration.customerInvoiceNumber:', registration?.customerInvoiceNumber);
        
        const invoice = await db.collection('invoices').findOne({
          'customerInvoice.invoiceNumber': CUSTOMER_INVOICE_NUMBER
        });
        console.log('- Invoice found:', invoice ? 'Yes' : 'No');
        
        const transactions = await db.collection('transactions').find({
          invoiceNumber: { $in: [CUSTOMER_INVOICE_NUMBER, SUPPLIER_INVOICE_NUMBER] }
        }).toArray();
        console.log('- Transactions found:', transactions.length);
        
        console.log('\n✅ Original invoice has been successfully reprocessed!');
      } else {
        console.log('\n❌ Reprocessing failed with code:', code);
      }
      
      await client.close();
    });
    
  } catch (error) {
    console.error('Error:', error);
    if (client) {
      await client.close();
    }
  }
}

console.log('Starting final reprocessing of original invoice...');
reprocessOriginalInvoice().catch(console.error);