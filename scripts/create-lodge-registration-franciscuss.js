const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function createLodgeRegistrationForFranciscuss() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CREATING LODGE REGISTRATION FOR FRANCISCUSS SUNGA ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const stripeTransactionsCollection = db.collection('stripeTransactions');
    const lodgesCollection = db.collection('lodges');
    
    // The payment information provided
    const paymentData = {
      _id: '685c0b9df861ce10c31247fe',
      transactionId: 'ch_3RZInfHDfNBUEWUu08WSM1W1',
      customerEmail: 'franciscuss.sunga@yahoo.com',
      customerName: 'Franciscuss Sunga',
      grossAmount: 1190.54,
      lodgeName: 'Lodge Horace Thompson Ryde No. 134',
      metadata: {
        function_name: 'Grand Proclamation 2025',
        package_id: '794841e4-5f04-4899-96e2-c0afece4d5f2',
        lodge_name: 'Lodge Horace Thompson Ryde No. 134',
        table_count: '1',
        function_id: 'eebddef5-6833-43e3-8d32-700508b1c089',
        subtotal: '1150'
      },
      timestamp: '2025-06-12T11:36:43.000Z'
    };
    
    // Check if registration already exists for this email and function
    const existingReg = await registrationsCollection.findOne({
      'registrationData.bookingContact.emailAddress': paymentData.customerEmail,
      functionId: paymentData.metadata.function_id,
      registrationType: 'lodge'
    });
    
    if (existingReg) {
      console.log('✅ Registration already exists:', existingReg.confirmationNumber);
      console.log('   Lodge:', existingReg.registrationData.lodgeDetails.lodgeName);
      return;
    }
    
    // Find the lodge in the lodges collection
    const lodge = await lodgesCollection.findOne({
      $or: [
        { name: 'Lodge Horace Thompson Ryde No. 134' },
        { lodgeName: 'Lodge Horace Thompson Ryde No. 134' },
        { displayName: 'Lodge Horace Thompson Ryde No. 134' },
        { lodgeNumber: '134' },
        { number: '134' }
      ]
    });
    
    if (!lodge) {
      console.log('⚠️  Lodge not found in lodges collection, using metadata from payment');
    } else {
      console.log('Found Lodge:');
      console.log(`  Lodge ID: ${lodge.lodgeId || lodge._id}`);
      console.log(`  Name: ${lodge.displayName || lodge.name || lodge.lodgeName}`);
      console.log(`  Number: ${lodge.lodgeNumber || lodge.number}\n`);
    }
    
    // Generate confirmation number and registration ID
    const confirmationNumber = `LDG-${Date.now().toString().slice(-6)}HTR`; // HTR for Horace Thompson Ryde
    const registrationId = uuidv4();
    const objectId = new ObjectId();
    
    const newRegistration = {
      _id: objectId,
      registrationId: registrationId,
      confirmationNumber: confirmationNumber,
      registrationType: 'lodge',
      functionId: paymentData.metadata.function_id,
      functionName: paymentData.metadata.function_name,
      
      registrationData: {
        lodgeDetails: {
          lodgeId: lodge?.lodgeId || lodge?._id?.toString() || `lodge-horace-thompson-ryde-134`,
          lodgeName: paymentData.lodgeName,
          lodgeNumber: '134'
        },
        bookingContact: {
          firstName: 'Franciscuss',
          lastName: 'Sunga',
          emailAddress: paymentData.customerEmail,
          phone: '',
          title: '',
          businessName: paymentData.lodgeName
        },
        tickets: [],
        packageDetails: {
          packageId: paymentData.metadata.package_id,
          packageCount: 1,
          tableCount: parseInt(paymentData.metadata.table_count || '1'),
          itemsPerPackage: 10 // Standard table size
        }
      },
      
      // Payment information
      totalAmountPaid: paymentData.grossAmount,
      totalPricePaid: paymentData.grossAmount,
      subtotal: parseFloat(paymentData.metadata.subtotal),
      paymentStatus: 'completed',
      status: 'completed',
      stripePaymentId: paymentData.transactionId,
      paymentId: paymentData._id,
      
      // Customer info
      customerId: null,
      organisationName: paymentData.lodgeName,
      organisationId: lodge?.organisationId || lodge?.lodgeId || `lodge-horace-thompson-ryde-134`,
      
      // Dates
      createdAt: new Date(paymentData.timestamp),
      updatedAt: new Date(),
      registrationDate: new Date(paymentData.timestamp),
      
      // Import metadata
      importedAt: new Date(),
      importSource: 'manual-creation-from-stripe-payment',
      metadata: {
        createdFrom: 'stripe-payment-reconstruction',
        originalPaymentId: paymentData._id,
        stripeChargeId: paymentData.transactionId,
        notes: 'Lodge registration created from Stripe payment for Franciscuss Sunga'
      }
    };
    
    // Create tickets based on table count (10 tickets per table)
    const ticketsPerTable = 10;
    const tableCount = parseInt(paymentData.metadata.table_count || '1');
    const pricePerTicket = parseFloat(paymentData.metadata.subtotal) / (tableCount * ticketsPerTable);
    
    const tickets = [];
    for (let i = 0; i < tableCount * ticketsPerTable; i++) {
      tickets.push({
        eventTicketId: uuidv4(),
        name: 'Grand Proclamation 2025 - Banquet Ticket',
        price: pricePerTicket,
        quantity: 1,
        ownerType: 'lodge',
        ownerId: newRegistration.registrationData.lodgeDetails.lodgeId,
        packageId: paymentData.metadata.package_id,
        tableNumber: Math.floor(i / ticketsPerTable) + 1,
        seatNumber: (i % ticketsPerTable) + 1
      });
    }
    
    newRegistration.registrationData.tickets = tickets;
    newRegistration.totalAttendees = tickets.length;
    
    console.log('Creating new lodge registration:');
    console.log(`  Confirmation: ${newRegistration.confirmationNumber}`);
    console.log(`  Object ID: ${objectId}`);
    console.log(`  Lodge: ${newRegistration.registrationData.lodgeDetails.lodgeName}`);
    console.log(`  Contact: ${newRegistration.registrationData.bookingContact.firstName} ${newRegistration.registrationData.bookingContact.lastName}`);
    console.log(`  Email: ${newRegistration.registrationData.bookingContact.emailAddress}`);
    console.log(`  Amount: $${newRegistration.totalAmountPaid}`);
    console.log(`  Tables: ${tableCount}`);
    console.log(`  Tickets: ${newRegistration.registrationData.tickets.length}\n`);
    
    // Insert the registration
    const result = await registrationsCollection.insertOne(newRegistration);
    
    if (result.acknowledged) {
      console.log(`✅ Successfully created lodge registration`);
      console.log(`   ID: ${objectId}`);
      console.log(`   Confirmation: ${newRegistration.confirmationNumber}`);
      
      // Update the stripe transaction if it exists
      const updateResult = await stripeTransactionsCollection.updateOne(
        { _id: paymentData._id },
        { 
          $set: { 
            registrationId: newRegistration.registrationId,
            confirmationNumber: newRegistration.confirmationNumber,
            'metadata.registration_id': newRegistration.registrationId,
            'metadata.confirmation_number': newRegistration.confirmationNumber,
            hasRegistration: true,
            registrationEnrichedAt: new Date()
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log('\n✅ Successfully linked payment to registration');
      } else {
        console.log('\n⚠️  Payment record not found in stripeTransactions collection');
      }
      
      // Final verification
      console.log('\n=== VERIFICATION ===\n');
      
      const verifyReg = await registrationsCollection.findOne({ 
        _id: objectId
      });
      
      console.log('Registration created:', verifyReg ? '✅' : '❌');
      console.log('Confirmation number:', verifyReg?.confirmationNumber || 'N/A');
      console.log('Total amount:', verifyReg ? `$${verifyReg.totalAmountPaid}` : 'N/A');
      console.log('Tickets created:', verifyReg?.registrationData?.tickets?.length || 0);
      
    } else {
      console.log('❌ Failed to create lodge registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the creation
createLodgeRegistrationForFranciscuss();