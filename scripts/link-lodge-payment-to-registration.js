const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function linkLodgePaymentToRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== LINKING LODGE PAYMENT TO REGISTRATION ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const transactionsCollection = db.collection('squareTransactions');
    
    // The lodge payment
    const lodgePaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    
    // Get the payment details
    const lodgePayment = await transactionsCollection.findOne({ _id: lodgePaymentId });
    
    if (!lodgePayment) {
      console.log('❌ Lodge payment not found');
      return;
    }
    
    console.log('Lodge Payment Details:');
    console.log(`  ID: ${lodgePayment._id}`);
    console.log(`  Amount: $${(lodgePayment.summary.amount / 100).toFixed(2)}`);
    console.log(`  Customer: ${lodgePayment.summary.customerName} (${lodgePayment.summary.customerEmail})`);
    console.log(`  Type: ${lodgePayment.order?.metadata?.registration_type}`);
    console.log(`  Lodge: ${lodgePayment.order?.metadata?.lodge_name}`);
    console.log(`  Function ID: ${lodgePayment.order?.metadata?.function_id}\n`);
    
    // Find lodge registrations for Troy Quimpo or Lodge Jose Rizal No. 1045
    const lodgeRegistrations = await registrationsCollection.find({
      registrationType: 'lodge',
      $or: [
        { 'registrationData.bookingContact.emailAddress': 'troyquimpo@yahoo.com' },
        { 'registrationData.lodgeDetails.lodgeName': 'Lodge Jose Rizal No. 1045' },
        { organisationName: 'Lodge Jose Rizal No. 1045' },
        { totalAmountPaid: 2351.74 }
      ]
    }).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} potential lodge registrations:\n`);
    
    let bestMatch = null;
    
    for (const reg of lodgeRegistrations) {
      console.log(`Registration: ${reg.confirmationNumber}`);
      console.log(`  Amount: $${reg.totalAmountPaid}`);
      console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName}`);
      console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
      console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress}`);
      console.log(`  Current Payment ID: ${reg.squarePaymentId || 'None'}`);
      console.log(`  Created: ${reg.createdAt}`);
      
      // Check if this is the best match
      const isCorrectAmount = Math.abs(reg.totalAmountPaid - 2351.74) < 0.01;
      const isCorrectLodge = reg.registrationData?.lodgeDetails?.lodgeName === 'Lodge Jose Rizal No. 1045' ||
                            reg.organisationName === 'Lodge Jose Rizal No. 1045';
      const isTroyQuimpo = reg.registrationData?.bookingContact?.emailAddress === 'troyquimpo@yahoo.com';
      
      if (isCorrectAmount && isCorrectLodge) {
        if (!bestMatch || isTroyQuimpo) {
          bestMatch = reg;
        }
      }
      
      console.log('');
    }
    
    if (!bestMatch) {
      // Try to find any lodge registration without a payment ID that matches the amount
      console.log('No exact match found. Searching for unlinked lodge registrations...\n');
      
      const unlinkedLodgeRegs = await registrationsCollection.find({
        registrationType: 'lodge',
        squarePaymentId: { $exists: false },
        totalAmountPaid: 2351.74
      }).toArray();
      
      if (unlinkedLodgeRegs.length > 0) {
        bestMatch = unlinkedLodgeRegs[0];
        console.log(`Found unlinked lodge registration: ${bestMatch.confirmationNumber}`);
      }
    }
    
    if (bestMatch) {
      console.log(`\n=== LINKING PAYMENT TO REGISTRATION ===\n`);
      console.log(`Selected registration: ${bestMatch.confirmationNumber}`);
      console.log(`  Lodge: ${bestMatch.registrationData?.lodgeDetails?.lodgeName || bestMatch.organisationName}`);
      console.log(`  Amount: $${bestMatch.totalAmountPaid}`);
      
      // Link the payment to this registration
      const updateResult = await registrationsCollection.updateOne(
        { _id: bestMatch._id },
        {
          $set: {
            squarePaymentId: lodgePaymentId,
            updatedAt: new Date(),
            'metadata.paymentLinkedAt': new Date(),
            'metadata.paymentLinkSource': 'manual-fix-script'
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`\n✅ Successfully linked payment ${lodgePaymentId} to registration ${bestMatch.confirmationNumber}`);
      } else {
        console.log(`\n⚠️  Failed to update registration`);
      }
    } else {
      console.log('\n❌ No suitable lodge registration found');
      console.log('\nCreating a new lodge registration from the payment data...\n');
      
      // Create a new lodge registration
      const newRegistration = {
        registrationId: `lodge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        confirmationNumber: `LDG-${Math.floor(Math.random() * 900000) + 100000}JR`, // JR for Jose Rizal
        registrationType: 'lodge',
        functionId: lodgePayment.order?.metadata?.function_id || 'eebddef5-6833-43e3-8d32-700508b1c089',
        
        registrationData: {
          lodgeDetails: {
            lodgeId: lodgePayment.order?.metadata?.lodge_id || `lodge-jose-rizal-1045`,
            lodgeName: lodgePayment.order?.metadata?.lodge_name || 'Lodge Jose Rizal No. 1045',
            lodgeNumber: '1045'
          },
          bookingContact: {
            firstName: lodgePayment.customer?.given_name || 'Troy',
            lastName: lodgePayment.customer?.family_name || 'Quimpo',
            emailAddress: lodgePayment.customer?.email_address || 'troyquimpo@yahoo.com',
            phone: lodgePayment.customer?.phone_number || '',
            title: lodgePayment.customer?.note?.match(/Title: ([^,]+)/)?.[1] || '',
            businessName: lodgePayment.order?.metadata?.lodge_name || 'Lodge Jose Rizal No. 1045'
          },
          tickets: [],
          packageDetails: {
            packageCount: parseInt(lodgePayment.order?.metadata?.package_count || '2'),
            itemsPerPackage: parseInt(lodgePayment.order?.metadata?.items_per_package || '10')
          }
        },
        
        // Payment information
        totalAmountPaid: lodgePayment.summary.amount / 100,
        totalPricePaid: lodgePayment.summary.amount / 100,
        paymentStatus: 'completed',
        status: 'completed',
        squarePaymentId: lodgePaymentId,
        
        // Customer info
        customerId: lodgePayment.customer?.id,
        organisationName: lodgePayment.order?.metadata?.organization_name || 'Lodge Jose Rizal No. 1045',
        organisationId: lodgePayment.order?.metadata?.organization_id,
        
        // Dates
        createdAt: new Date(lodgePayment.payment.created_at),
        updatedAt: new Date(),
        registrationDate: new Date(lodgePayment.payment.created_at),
        
        // Import metadata
        importedAt: new Date(),
        importSource: 'lodge-payment-link-fix',
        metadata: {
          createdFrom: 'square-payment-reconstruction',
          originalPaymentId: lodgePaymentId,
          notes: 'Lodge registration created from Square payment data after fixing payment linking issue'
        }
      };
      
      // Extract line items to create tickets
      if (lodgePayment.order?.line_items) {
        const tickets = [];
        
        lodgePayment.order.line_items.forEach(item => {
          const quantity = parseInt(item.quantity || '1');
          const pricePerItem = (item.base_price_money?.amount || 0) / 100;
          
          // Create individual tickets based on quantity
          for (let i = 0; i < quantity; i++) {
            tickets.push({
              eventTicketId: item.uid || 'lodge-package-ticket',
              name: item.name || 'Lodge Package',
              price: pricePerItem / quantity,
              quantity: 1,
              ownerType: 'lodge',
              ownerId: newRegistration.registrationData.lodgeDetails.lodgeId
            });
          }
        });
        
        newRegistration.registrationData.tickets = tickets;
      }
      
      console.log('Creating new lodge registration:');
      console.log(`  Confirmation: ${newRegistration.confirmationNumber}`);
      console.log(`  Lodge: ${newRegistration.registrationData.lodgeDetails.lodgeName}`);
      console.log(`  Contact: ${newRegistration.registrationData.bookingContact.firstName} ${newRegistration.registrationData.bookingContact.lastName}`);
      console.log(`  Amount: $${newRegistration.totalAmountPaid}`);
      console.log(`  Tickets: ${newRegistration.registrationData.tickets.length}`);
      
      // Insert the registration
      const result = await registrationsCollection.insertOne(newRegistration);
      
      if (result.acknowledged) {
        console.log(`\n✅ Successfully created lodge registration: ${newRegistration.confirmationNumber}`);
        console.log(`✅ Linked to payment: ${lodgePaymentId}`);
      } else {
        console.log('\n❌ Failed to create lodge registration');
      }
    }
    
    // Final verification
    console.log('\n=== FINAL VERIFICATION ===\n');
    
    // Run the audit again to verify everything is correct
    const troyRegistrations = await registrationsCollection.find({
      $or: [
        { 'registrationData.bookingContact.emailAddress': 'troyquimpo@yahoo.com' },
        { 'registrationData.bookingContact.firstName': 'Troy', 'registrationData.bookingContact.lastName': 'Quimpo' }
      ]
    }).toArray();
    
    console.log(`Troy Quimpo has ${troyRegistrations.length} registration(s):\n`);
    
    for (const reg of troyRegistrations) {
      console.log(`${reg.confirmationNumber} (${reg.registrationType}):`);
      console.log(`  Amount: $${reg.totalAmountPaid}`);
      console.log(`  Payment ID: ${reg.squarePaymentId || 'None'}`);
      
      if (reg.squarePaymentId) {
        const payment = await transactionsCollection.findOne({ _id: reg.squarePaymentId });
        if (payment) {
          const paymentAmount = payment.summary.amount / 100;
          const amountMatch = Math.abs(paymentAmount - reg.totalAmountPaid) < 0.01;
          console.log(`  Payment Amount: $${paymentAmount} ${amountMatch ? '✅' : '❌'}`);
        }
      }
      console.log('');
    }
    
    // Check the lodge payment
    const lodgePaymentLinks = await registrationsCollection.countDocuments({
      squarePaymentId: lodgePaymentId
    });
    
    console.log(`Lodge payment ${lodgePaymentId} is linked to ${lodgePaymentLinks} registration(s)`);
    
    if (lodgePaymentLinks === 1) {
      console.log('✅ Lodge payment is correctly linked to exactly one registration');
    } else if (lodgePaymentLinks === 0) {
      console.log('❌ Lodge payment is not linked to any registration');
    } else {
      console.log('⚠️  Lodge payment is linked to multiple registrations');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
linkLodgePaymentToRegistration();