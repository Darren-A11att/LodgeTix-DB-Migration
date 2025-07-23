const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findTroyQuimpoRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SEARCHING FOR TROY QUIMPO REGISTRATION ===\n');
    
    // Payment details
    const paymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    const amount = 2351.74;
    const lodgeName = 'Lodge Jose Rizal No. 1045';
    const customerEmail = 'troyquimpo@yahoo.com';
    const paymentDate = new Date('2025-07-21T08:40:55.102Z');
    
    console.log('Looking for:');
    console.log(`  Customer: Troy Quimpo (${customerEmail})`);
    console.log(`  Lodge: ${lodgeName}`);
    console.log(`  Amount: $${amount}`);
    console.log(`  Payment Date: ${paymentDate}`);
    
    // Search for Troy Quimpo specifically
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.bookingContact.emailAddress': customerEmail },
        { 'registrationData.billingDetails.emailAddress': customerEmail },
        {
          $and: [
            { 'registrationData.bookingContact.firstName': 'Troy' },
            { 'registrationData.bookingContact.lastName': 'Quimpo' }
          ]
        },
        {
          $and: [
            { registrationType: 'lodge' },
            { totalAmountPaid: amount },
            {
              createdAt: {
                $gte: new Date(paymentDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
                $lte: new Date(paymentDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
              }
            }
          ]
        }
      ]
    }).toArray();
    
    if (registrations.length > 0) {
      console.log(`\nFound ${registrations.length} registration(s):\n`);
      
      for (const reg of registrations) {
        console.log(`Registration: ${reg.confirmationNumber}`);
        console.log(`  ID: ${reg.registrationId}`);
        console.log(`  Type: ${reg.registrationType}`);
        console.log(`  Amount: $${reg.totalAmountPaid}`);
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'N/A'}`);
        console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
        console.log(`  Square Payment ID: ${reg.squarePaymentId || 'Not set'}`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log('');
        
        // Check if this could be the right registration
        const isLikelyMatch = 
          (reg.registrationData?.bookingContact?.emailAddress === customerEmail ||
           reg.registrationData?.billingDetails?.emailAddress === customerEmail ||
           (reg.registrationData?.bookingContact?.firstName === 'Troy' && 
            reg.registrationData?.bookingContact?.lastName === 'Quimpo')) &&
          reg.registrationType === 'lodge';
        
        if (isLikelyMatch) {
          console.log('  🎯 This appears to be Troy Quimpo\'s registration!');
          
          if (reg.squarePaymentId === paymentId) {
            console.log('  ✅ Square payment ID already matches');
          } else if (reg.squarePaymentId) {
            console.log(`  ⚠️  Has different Square payment ID: ${reg.squarePaymentId}`);
          } else {
            console.log('  ❌ No Square payment ID set');
          }
        }
      }
    } else {
      console.log('\n❌ No registrations found for Troy Quimpo');
      
      // Try searching just by email without case sensitivity
      console.log('\nTrying case-insensitive email search...\n');
      
      const emailSearch = await db.collection('registrations').find({
        $or: [
          { 'registrationData.bookingContact.emailAddress': { $regex: /troyquimpo@yahoo\.com/i } },
          { 'registrationData.billingDetails.emailAddress': { $regex: /troyquimpo@yahoo\.com/i } }
        ]
      }).toArray();
      
      if (emailSearch.length > 0) {
        console.log(`Found ${emailSearch.length} registration(s) by email search`);
      }
    }
    
    // Also check if there's a registration created around the payment time
    console.log('\n=== CHECKING REGISTRATIONS AROUND PAYMENT TIME ===\n');
    
    const timeRangeRegistrations = await db.collection('registrations').find({
      registrationType: 'lodge',
      totalAmountPaid: amount,
      createdAt: {
        $gte: new Date(paymentDate.getTime() - 60 * 60 * 1000), // 1 hour before
        $lte: new Date(paymentDate.getTime() + 60 * 60 * 1000)  // 1 hour after
      }
    }).toArray();
    
    if (timeRangeRegistrations.length > 0) {
      console.log(`Found ${timeRangeRegistrations.length} lodge registration(s) with amount $${amount} around payment time:\n`);
      
      for (const reg of timeRangeRegistrations) {
        console.log(`Registration: ${reg.confirmationNumber}`);
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'N/A'}`);
        console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || 'N/A'}`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findTroyQuimpoRegistration();