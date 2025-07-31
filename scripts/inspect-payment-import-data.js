require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function inspectPaymentImportData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== INSPECTING PAYMENT_IMPORTS DATA STRUCTURE ===\n');
    
    // Get the specific Troy Quimpo payment
    const paymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    const importRecord = await db.collection('payment_imports').findOne({
      squarePaymentId: paymentId
    });
    
    if (importRecord) {
      console.log('Found payment import record for ID:', paymentId);
      console.log('\nTop-level fields:');
      Object.keys(importRecord).forEach(key => {
        if (key !== 'originalData' && key !== 'rawSquareData') {
          console.log(`  ${key}:`, importRecord[key]);
        }
      });
      
      // Check originalData
      if (importRecord.originalData) {
        console.log('\noriginalData fields:');
        Object.keys(importRecord.originalData).forEach(key => {
          const value = importRecord.originalData[key];
          if (typeof value === 'object' && value !== null) {
            console.log(`  ${key}: [object with ${Object.keys(value).length} fields]`);
          } else {
            console.log(`  ${key}:`, value);
          }
        });
        
        // Look for customer info in originalData
        if (importRecord.originalData['Customer Name']) {
          console.log('\n✅ Found Customer Name in originalData:', importRecord.originalData['Customer Name']);
        }
        if (importRecord.originalData['Customer Email']) {
          console.log('✅ Found Customer Email in originalData:', importRecord.originalData['Customer Email']);
        }
        
        // Check nested structures
        if (importRecord.originalData.customer) {
          console.log('\noriginalData.customer:', importRecord.originalData.customer);
        }
        if (importRecord.originalData.shippingAddress) {
          console.log('\noriginalData.shippingAddress:', importRecord.originalData.shippingAddress);
        }
      }
      
      // Check rawSquareData
      if (importRecord.rawSquareData) {
        console.log('\nrawSquareData fields:');
        Object.keys(importRecord.rawSquareData).forEach(key => {
          const value = importRecord.rawSquareData[key];
          if (typeof value === 'object' && value !== null) {
            console.log(`  ${key}: [object]`);
          } else {
            console.log(`  ${key}:`, value);
          }
        });
        
        if (importRecord.rawSquareData.buyerEmailAddress) {
          console.log('\n✅ Found buyerEmailAddress in rawSquareData:', importRecord.rawSquareData.buyerEmailAddress);
        }
        if (importRecord.rawSquareData.shippingAddress?.name) {
          console.log('✅ Found name in shippingAddress:', importRecord.rawSquareData.shippingAddress.name);
        }
      }
    }
    
    // Now let's check a few more payment_imports to understand the pattern
    console.log('\n\n=== CHECKING OTHER PAYMENT_IMPORTS FOR CUSTOMER DATA ===\n');
    
    const sampleImports = await db.collection('payment_imports').find({}).limit(10).toArray();
    
    let withCustomerName = 0;
    let withCustomerEmail = 0;
    let withOriginalData = 0;
    let withRawSquareData = 0;
    
    sampleImports.forEach((imp, idx) => {
      console.log(`\n${idx + 1}. Payment ${imp.squarePaymentId}:`);
      
      // Check various places for customer data
      const customerName = imp.customerName || 
                          imp.originalData?.['Customer Name'] || 
                          imp.rawSquareData?.shippingAddress?.name ||
                          imp.rawSquareData?.customer?.name;
                          
      const customerEmail = imp.customerEmail || 
                           imp.originalData?.['Customer Email'] || 
                           imp.rawSquareData?.buyerEmailAddress ||
                           imp.rawSquareData?.customer?.email;
      
      console.log(`  Customer Name: ${customerName || 'NOT FOUND'}`);
      console.log(`  Customer Email: ${customerEmail || 'NOT FOUND'}`);
      console.log(`  Has originalData: ${!!imp.originalData}`);
      console.log(`  Has rawSquareData: ${!!imp.rawSquareData}`);
      
      if (customerName) withCustomerName++;
      if (customerEmail) withCustomerEmail++;
      if (imp.originalData) withOriginalData++;
      if (imp.rawSquareData) withRawSquareData++;
      
      // Show where the data was found
      if (imp.originalData?.['Customer Name']) {
        console.log(`  ✓ Name found in: originalData['Customer Name']`);
      }
      if (imp.rawSquareData?.shippingAddress?.name) {
        console.log(`  ✓ Name found in: rawSquareData.shippingAddress.name`);
      }
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Records with customer name: ${withCustomerName}/${sampleImports.length}`);
    console.log(`Records with customer email: ${withCustomerEmail}/${sampleImports.length}`);
    console.log(`Records with originalData: ${withOriginalData}/${sampleImports.length}`);
    console.log(`Records with rawSquareData: ${withRawSquareData}/${sampleImports.length}`);
    
  } finally {
    await client.close();
  }
}

inspectPaymentImportData().catch(console.error);