const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findCorrectRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SEARCHING FOR CORRECT REGISTRATION ===\n');
    
    // Payment and order details
    const paymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    const orderId = '5tWjXWyJxsbn5JveUp0NB5EmhCYZY';
    const amount = 2351.74;
    const functionId = 'eebddef5-6833-43e3-8d32-700508b1c089';
    const lodgeName = 'Lodge Jose Rizal No. 1045';
    const customerEmail = 'troyquimpo@yahoo.com';
    const customerName = 'Troy Quimpo';
    
    console.log('Order Details:');
    console.log(`  Function ID: ${functionId}`);
    console.log(`  Lodge Name: ${lodgeName}`);
    console.log(`  Customer: ${customerName} (${customerEmail})`);
    console.log(`  Amount: $${amount}`);
    console.log(`  Square Payment ID: ${paymentId}`);
    console.log(`  Square Order ID: ${orderId}`);
    
    // Search criteria based on order metadata
    const searchQueries = [
      // Function ID match
      { functionId: functionId },
      { 'registrationData.functionId': functionId },
      
      // Customer email match
      { 'registrationData.bookingContact.emailAddress': customerEmail },
      { 'registrationData.billingDetails.emailAddress': customerEmail },
      
      // Lodge name match
      { 'registrationData.lodgeDetails.lodgeName': lodgeName },
      { 'registrationData.lodgeName': lodgeName },
      { organisationName: lodgeName },
      
      // Amount and type match
      { 
        totalAmountPaid: amount,
        registrationType: 'lodge'
      },
      
      // Customer name match
      {
        'registrationData.bookingContact.firstName': 'Troy',
        'registrationData.bookingContact.lastName': 'Quimpo'
      }
    ];
    
    console.log('\n=== SEARCH RESULTS ===\n');
    
    const registrations = await db.collection('registrations').find({
      $or: searchQueries
    }).toArray();
    
    if (registrations.length > 0) {
      console.log(`Found ${registrations.length} potential registration(s):\n`);
      
      for (const reg of registrations) {
        const matchReasons = [];
        
        // Check what matched
        if (reg.functionId === functionId || reg.registrationData?.functionId === functionId) {
          matchReasons.push('Function ID');
        }
        if (reg.totalAmountPaid === amount) {
          matchReasons.push(`Amount ($${amount})`);
        }
        if (reg.registrationData?.bookingContact?.emailAddress === customerEmail || 
            reg.registrationData?.billingDetails?.emailAddress === customerEmail) {
          matchReasons.push('Email');
        }
        if (reg.registrationData?.lodgeDetails?.lodgeName === lodgeName || 
            reg.registrationData?.lodgeName === lodgeName ||
            reg.organisationName === lodgeName) {
          matchReasons.push('Lodge Name');
        }
        
        console.log(`Registration: ${reg.confirmationNumber}`);
        console.log(`  ID: ${reg.registrationId}`);
        console.log(`  Type: ${reg.registrationType}`);
        console.log(`  Amount: $${reg.totalAmountPaid}`);
        console.log(`  Function ID: ${reg.functionId}`);
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'N/A'}`);
        console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
        console.log(`  Square Payment ID: ${reg.squarePaymentId || 'Not set'}`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log(`  Matched by: ${matchReasons.join(', ')}`);
        console.log('');
        
        // Update with correct Square payment ID if this is the right match
        if (matchReasons.includes('Function ID') || 
            (matchReasons.includes('Email') && matchReasons.includes('Amount'))) {
          
          if (reg.squarePaymentId !== paymentId) {
            console.log(`⚠️  This registration has Square payment ID: ${reg.squarePaymentId || 'Not set'}`);
            console.log(`   But the payment we're looking for is: ${paymentId}`);
            
            if (!reg.squarePaymentId) {
              // Update if no payment ID is set
              const updateResult = await db.collection('registrations').updateOne(
                { _id: reg._id },
                { 
                  $set: { 
                    squarePaymentId: paymentId,
                    updatedAt: new Date()
                  }
                }
              );
              
              if (updateResult.modifiedCount > 0) {
                console.log(`   ✅ Updated registration with correct Square payment ID`);
              }
            }
          }
        }
      }
    } else {
      console.log('❌ No registrations found with the order criteria');
      
      // Try searching just by the exact criteria we know
      console.log('\nSearching by exact criteria...\n');
      
      const exactSearch = await db.collection('registrations').findOne({
        functionId: functionId,
        registrationType: 'lodge'
      });
      
      if (exactSearch) {
        console.log('Found registration by function ID:');
        console.log(`  Confirmation: ${exactSearch.confirmationNumber}`);
        console.log(`  Amount: $${exactSearch.totalAmountPaid}`);
        console.log(`  Square Payment ID: ${exactSearch.squarePaymentId || 'Not set'}`);
      }
      
      // Search by date range around payment time
      console.log('\nSearching by date range...\n');
      
      const paymentDate = new Date('2025-07-21T08:40:55.102Z');
      const dateRangeSearch = await db.collection('registrations').find({
        createdAt: {
          $gte: new Date(paymentDate.getTime() - 30 * 60 * 1000), // 30 minutes before
          $lte: new Date(paymentDate.getTime() + 30 * 60 * 1000)  // 30 minutes after
        },
        registrationType: 'lodge'
      }).toArray();
      
      if (dateRangeSearch.length > 0) {
        console.log(`Found ${dateRangeSearch.length} lodge registration(s) around payment time:\n`);
        
        for (const reg of dateRangeSearch) {
          console.log(`Registration: ${reg.confirmationNumber}`);
          console.log(`  Amount: $${reg.totalAmountPaid}`);
          console.log(`  Created: ${reg.createdAt}`);
          console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'N/A'}`);
          console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
          console.log('');
        }
      }
    }
    
    // Also check payment_imports for any existing links
    console.log('\n=== CHECKING PAYMENT IMPORTS ===\n');
    
    const paymentImport = await db.collection('payment_imports').findOne({
      squarePaymentId: paymentId
    });
    
    if (paymentImport) {
      console.log('Payment exists in payment_imports:');
      console.log(`  Processing Status: ${paymentImport.processingStatus}`);
      console.log(`  Matched Registration ID: ${paymentImport.matchedRegistrationId || 'Not matched'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findCorrectRegistration();