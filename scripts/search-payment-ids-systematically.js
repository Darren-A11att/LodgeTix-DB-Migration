const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function searchPaymentIdsSystematically() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SYSTEMATIC PAYMENT ID SEARCH ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Read the unenriched transactions report
    const reportPath = path.join(__dirname, 'unenriched-transactions-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    console.log(`Found ${report.unenrichedTransactions.length} unenriched transactions to search\n`);
    
    // Define all possible payment ID fields to search
    const paymentFields = [
      'squarePaymentId',
      'square_payment_id',
      'stripePaymentIntentId',
      'stripePaymentId',
      'stripe_payment_id',
      'paymentId',
      'payment_id',
      'paymentIntentId',
      'payment_intent_id',
      'transactionId',
      'transaction_id',
      'squareTransactionId',
      'square_transaction_id',
      'stripeTransactionId',
      'stripe_transaction_id',
      'metadata.paymentId',
      'metadata.squarePaymentId',
      'metadata.stripePaymentId',
      'paymentDetails.paymentId',
      'paymentDetails.transactionId',
      'paymentInfo.paymentId',
      'paymentInfo.transactionId'
    ];
    
    const searchResults = [];
    
    for (const transaction of report.unenrichedTransactions) {
      const paymentId = transaction.paymentId;
      console.log(`\n=== Searching for Payment ID: ${paymentId} ===`);
      console.log(`Amount: $${transaction.amount}`);
      console.log(`Customer: ${transaction.customerName} (${transaction.customerEmail})`);
      console.log(`Date: ${transaction.createdAt}`);
      
      if (transaction.orderMetadata?.registration_type) {
        console.log(`Type: ${transaction.orderMetadata.registration_type}`);
        console.log(`Organization: ${transaction.orderMetadata.organization_name || transaction.orderMetadata.lodge_name}`);
      }
      
      const result = {
        paymentId: paymentId,
        transactionDetails: {
          amount: transaction.amount,
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          createdAt: transaction.createdAt,
          orderMetadata: transaction.orderMetadata
        },
        searchResults: []
      };
      
      // Search across all payment fields
      for (const field of paymentFields) {
        const query = { [field]: paymentId };
        
        try {
          const matches = await registrationsCollection.find(query).toArray();
          
          if (matches.length > 0) {
            console.log(`\n✅ Found ${matches.length} match(es) in field: ${field}`);
            
            for (const match of matches) {
              console.log(`  Registration: ${match.confirmationNumber}`);
              console.log(`  Type: ${match.registrationType}`);
              console.log(`  Amount: $${match.totalAmountPaid}`);
              console.log(`  Created: ${match.createdAt}`);
              
              result.searchResults.push({
                field: field,
                registration: {
                  id: match.registrationId || match._id,
                  confirmationNumber: match.confirmationNumber,
                  type: match.registrationType,
                  amount: match.totalAmountPaid,
                  createdAt: match.createdAt,
                  customerEmail: match.registrationData?.bookingContact?.emailAddress || 
                                match.registrationData?.bookingContact?.email ||
                                match.billingDetails?.email
                }
              });
            }
          }
        } catch (err) {
          // Field might not exist, continue
        }
      }
      
      // Also search by amount and customer email for potential matches
      if (transaction.customerEmail && transaction.customerEmail !== 'Unknown') {
        console.log(`\nSearching by email and amount...`);
        
        const amountCents = Math.round(parseFloat(transaction.amount) * 100);
        const emailMatches = await registrationsCollection.find({
          $and: [
            {
              $or: [
                { 'registrationData.bookingContact.emailAddress': transaction.customerEmail },
                { 'registrationData.bookingContact.email': transaction.customerEmail },
                { 'billingDetails.email': transaction.customerEmail },
                { 'customerEmail': transaction.customerEmail }
              ]
            },
            {
              $or: [
                { totalAmountPaid: parseFloat(transaction.amount) },
                { totalAmountPaid: amountCents },
                { totalPricePaid: parseFloat(transaction.amount) },
                { totalPricePaid: amountCents }
              ]
            }
          ]
        }).toArray();
        
        if (emailMatches.length > 0) {
          console.log(`\n🔍 Found ${emailMatches.length} potential match(es) by email + amount`);
          
          for (const match of emailMatches) {
            console.log(`  Registration: ${match.confirmationNumber}`);
            console.log(`  Type: ${match.registrationType}`);
            console.log(`  Amount: $${match.totalAmountPaid}`);
            console.log(`  Payment ID: ${match.squarePaymentId || match.stripePaymentIntentId || 'None'}`);
            
            result.searchResults.push({
              field: 'email_and_amount_match',
              registration: {
                id: match.registrationId || match._id,
                confirmationNumber: match.confirmationNumber,
                type: match.registrationType,
                amount: match.totalAmountPaid,
                createdAt: match.createdAt,
                customerEmail: match.registrationData?.bookingContact?.emailAddress || 
                              match.registrationData?.bookingContact?.email ||
                              match.billingDetails?.email,
                existingPaymentId: match.squarePaymentId || match.stripePaymentIntentId || null
              }
            });
          }
        }
      }
      
      if (result.searchResults.length === 0) {
        console.log('\n❌ No matches found in any payment field');
      }
      
      searchResults.push(result);
    }
    
    // Save detailed search results
    const outputPath = path.join(__dirname, 'payment-id-search-results.json');
    const searchReport = {
      generatedAt: new Date().toISOString(),
      searchedFields: paymentFields,
      totalSearched: report.unenrichedTransactions.length,
      results: searchResults
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(searchReport, null, 2));
    
    console.log(`\n\n=== SEARCH COMPLETE ===`);
    console.log(`\n📄 Detailed search results saved to: ${outputPath}`);
    
    // Summary
    const foundCount = searchResults.filter(r => r.searchResults.length > 0).length;
    console.log(`\nSummary:`);
    console.log(`  Total payment IDs searched: ${searchResults.length}`);
    console.log(`  Found potential matches: ${foundCount}`);
    console.log(`  No matches found: ${searchResults.length - foundCount}`);
    
    // List which transactions have potential matches
    console.log('\nTransactions with potential matches:');
    searchResults.forEach(result => {
      if (result.searchResults.length > 0) {
        console.log(`\n${result.paymentId}:`);
        const uniqueRegistrations = [...new Set(result.searchResults.map(r => r.registration.confirmationNumber))];
        uniqueRegistrations.forEach(conf => {
          const reg = result.searchResults.find(r => r.registration.confirmationNumber === conf);
          console.log(`  - ${conf} (${reg.registration.type}) - $${reg.registration.amount} - Found in: ${reg.field}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
searchPaymentIdsSystematically();