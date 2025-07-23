const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixPaymentLinkingIssue() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING PAYMENT LINKING ISSUE ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const transactionsCollection = db.collection('squareTransactions');
    
    // The problematic payment ID
    const problematicPaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    
    // Get the payment details
    const lodgePayment = await transactionsCollection.findOne({ _id: problematicPaymentId });
    
    if (!lodgePayment) {
      console.log('❌ Payment not found');
      return;
    }
    
    console.log('Lodge Payment Details:');
    console.log(`  ID: ${lodgePayment._id}`);
    console.log(`  Amount: $${(lodgePayment.summary.amount / 100).toFixed(2)}`);
    console.log(`  Type: ${lodgePayment.order?.metadata?.registration_type}`);
    console.log(`  Lodge: ${lodgePayment.order?.metadata?.lodge_name}\n`);
    
    // Find all registrations incorrectly linked to this payment
    const incorrectlyLinkedRegs = await registrationsCollection.find({
      squarePaymentId: problematicPaymentId
    }).toArray();
    
    console.log(`Found ${incorrectlyLinkedRegs.length} registrations linked to this payment\n`);
    
    // The only registration that should keep this payment ID is a lodge registration
    // for $2,351.74 for Lodge Jose Rizal No. 1045
    let correctLodgeReg = null;
    const registrationsToUnlink = [];
    
    for (const reg of incorrectlyLinkedRegs) {
      if (reg.registrationType === 'lodge' && 
          Math.abs(reg.totalAmountPaid - 2351.74) < 0.01) {
        // This is likely the correct lodge registration
        correctLodgeReg = reg;
        console.log(`✅ Found correct lodge registration: ${reg.confirmationNumber}`);
      } else {
        registrationsToUnlink.push(reg);
      }
    }
    
    // If we didn't find a correct lodge registration, look for one that was created
    // by the create-missing-lodge-registration.js script
    if (!correctLodgeReg) {
      const createdLodgeReg = incorrectlyLinkedRegs.find(reg => 
        reg.registrationType === 'lodge' && 
        reg.metadata?.createdFrom === 'square-payment-reconstruction'
      );
      
      if (createdLodgeReg) {
        correctLodgeReg = createdLodgeReg;
        console.log(`✅ Found lodge registration created by fix script: ${createdLodgeReg.confirmationNumber}`);
      }
    }
    
    console.log(`\n=== UNLINKING INCORRECT REGISTRATIONS ===\n`);
    console.log(`Registrations to unlink: ${registrationsToUnlink.length}`);
    
    // Group registrations by type and amount for summary
    const summary = {};
    
    for (const reg of registrationsToUnlink) {
      const key = `${reg.registrationType}_$${reg.totalAmountPaid}`;
      if (!summary[key]) {
        summary[key] = {
          type: reg.registrationType,
          amount: reg.totalAmountPaid,
          count: 0,
          examples: []
        };
      }
      summary[key].count++;
      if (summary[key].examples.length < 3) {
        summary[key].examples.push(reg.confirmationNumber);
      }
    }
    
    console.log('Registration types to unlink:');
    Object.values(summary).forEach(s => {
      console.log(`  - ${s.type} ($${s.amount}): ${s.count} registrations`);
      console.log(`    Examples: ${s.examples.join(', ')}`);
    });
    
    // Unlink all incorrect registrations
    const unlinkResult = await registrationsCollection.updateMany(
      {
        _id: { $in: registrationsToUnlink.map(r => r._id) },
        squarePaymentId: problematicPaymentId
      },
      {
        $unset: { squarePaymentId: "" },
        $set: { 
          updatedAt: new Date(),
          'metadata.paymentUnlinkedAt': new Date(),
          'metadata.paymentUnlinkReason': 'Incorrectly linked to lodge payment HXi6TI41gIR5NbndF5uOQotM2b6YY'
        }
      }
    );
    
    console.log(`\n✅ Unlinked ${unlinkResult.modifiedCount} registrations from payment ${problematicPaymentId}`);
    
    // Now, let's try to match individual registrations with their correct payments
    console.log('\n=== MATCHING REGISTRATIONS WITH CORRECT PAYMENTS ===\n');
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    for (const reg of registrationsToUnlink) {
      // Skip if registration already has a payment ID (shouldn't happen but just in case)
      if (reg.squarePaymentId && reg.squarePaymentId !== problematicPaymentId) {
        continue;
      }
      
      // Try to find a matching payment based on amount and customer email
      const customerEmail = reg.registrationData?.bookingContact?.emailAddress;
      
      if (!customerEmail || reg.totalAmountPaid === 0) {
        unmatchedCount++;
        continue;
      }
      
      // Find a payment with matching amount and customer
      const matchingPayment = await transactionsCollection.findOne({
        'summary.customerEmail': customerEmail,
        'summary.amount': Math.round(reg.totalAmountPaid * 100), // Convert to cents
        '_id': { $ne: problematicPaymentId } // Not the lodge payment
      });
      
      if (matchingPayment) {
        // Check if this payment is already linked to another registration
        const existingLink = await registrationsCollection.findOne({
          squarePaymentId: matchingPayment._id,
          _id: { $ne: reg._id }
        });
        
        if (!existingLink) {
          // Link this payment to the registration
          await registrationsCollection.updateOne(
            { _id: reg._id },
            {
              $set: {
                squarePaymentId: matchingPayment._id,
                updatedAt: new Date(),
                'metadata.paymentRelinkedAt': new Date()
              }
            }
          );
          
          matchedCount++;
          console.log(`✅ Matched ${reg.confirmationNumber} to payment ${matchingPayment._id} ($${reg.totalAmountPaid})`);
        } else {
          unmatchedCount++;
        }
      } else {
        unmatchedCount++;
      }
    }
    
    console.log(`\n=== MATCHING SUMMARY ===`);
    console.log(`Successfully matched: ${matchedCount} registrations`);
    console.log(`Could not match: ${unmatchedCount} registrations`);
    
    // Special check for Troy Quimpo
    console.log('\n=== TROY QUIMPO SPECIFIC CHECK ===\n');
    
    const troyIndividualReg = await registrationsCollection.findOne({
      'registrationData.bookingContact.emailAddress': 'troyquimpo@yahoo.com',
      registrationType: 'individuals'
    });
    
    if (troyIndividualReg) {
      console.log(`Troy's individual registration: ${troyIndividualReg.confirmationNumber}`);
      console.log(`  Amount: $${troyIndividualReg.totalAmountPaid}`);
      console.log(`  Payment ID: ${troyIndividualReg.squarePaymentId || 'None'}`);
      
      // Try to find his individual payment
      const troyIndividualPayment = await transactionsCollection.findOne({
        'summary.customerEmail': 'troyquimpo@yahoo.com',
        'summary.amount': Math.round(troyIndividualReg.totalAmountPaid * 100)
      });
      
      if (troyIndividualPayment && !troyIndividualReg.squarePaymentId) {
        await registrationsCollection.updateOne(
          { _id: troyIndividualReg._id },
          {
            $set: {
              squarePaymentId: troyIndividualPayment._id,
              updatedAt: new Date()
            }
          }
        );
        console.log(`✅ Linked Troy's individual registration to payment ${troyIndividualPayment._id}`);
      }
    }
    
    // Final verification
    console.log('\n=== FINAL VERIFICATION ===\n');
    
    const stillLinkedToLodgePayment = await registrationsCollection.countDocuments({
      squarePaymentId: problematicPaymentId
    });
    
    console.log(`Registrations still linked to lodge payment: ${stillLinkedToLodgePayment}`);
    
    if (stillLinkedToLodgePayment === 1 && correctLodgeReg) {
      console.log('✅ Success! Only the correct lodge registration is linked to the payment');
    } else if (stillLinkedToLodgePayment === 0) {
      console.log('⚠️  Warning: No registrations linked to the lodge payment');
      console.log('   The lodge registration may need to be created or re-linked');
    } else {
      console.log('⚠️  Warning: Multiple registrations still linked to the lodge payment');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixPaymentLinkingIssue();