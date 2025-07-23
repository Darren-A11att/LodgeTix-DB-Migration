const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function createMissingLodgeRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CREATING MISSING LODGE REGISTRATION ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const transactionsCollection = db.collection('squareTransactions');
    const lodgesCollection = db.collection('lodges');
    
    // The completed payment that needs a registration
    const paymentId = 'nVNemNbGg3V5dGg2EOXOnLa58AeZY';
    
    // Get the transaction details
    const transaction = await transactionsCollection.findOne({ _id: paymentId });
    
    if (!transaction) {
      console.log('❌ Transaction not found');
      return;
    }
    
    console.log('Transaction Details:');
    console.log(`  Payment ID: ${transaction._id}`);
    console.log(`  Amount: $${(transaction.summary.amount / 100).toFixed(2)}`);
    console.log(`  Customer: ${transaction.customer?.given_name} ${transaction.customer?.family_name}`);
    console.log(`  Email: ${transaction.customer?.email_address}`);
    console.log(`  Lodge: ${transaction.order?.metadata?.lodge_name}\n`);
    
    // Check if registration already exists
    const existingReg = await registrationsCollection.findOne({
      squarePaymentId: paymentId
    });
    
    if (existingReg) {
      console.log('✅ Registration already exists:', existingReg.confirmationNumber);
      return;
    }
    
    // Find the lodge in the lodges collection
    const lodge = await lodgesCollection.findOne({
      $or: [
        { name: 'Lodge Ionic No. 65' },
        { lodgeName: 'Lodge Ionic No. 65' },
        { displayName: 'Lodge Ionic No. 65' },
        { lodgeNumber: '65' },
        { number: '65' }
      ]
    });
    
    if (!lodge) {
      console.log('⚠️  Lodge not found in lodges collection, using metadata from transaction');
    } else {
      console.log('Found Lodge:');
      console.log(`  Lodge ID: ${lodge.lodgeId || lodge._id}`);
      console.log(`  Name: ${lodge.displayName || lodge.name || lodge.lodgeName}`);
      console.log(`  Number: ${lodge.lodgeNumber || lodge.number}\n`);
    }
    
    // Create the registration
    const confirmationNumber = `LDG-${Math.floor(Math.random() * 900000) + 100000}IO`; // IO for Ionic
    const registrationId = uuidv4();
    
    const newRegistration = {
      registrationId: registrationId,
      confirmationNumber: confirmationNumber,
      registrationType: 'lodge',
      functionId: transaction.order?.metadata?.function_id || 'eebddef5-6833-43e3-8d32-700508b1c089',
      
      registrationData: {
        lodgeDetails: {
          lodgeId: lodge?.lodgeId || `lodge-ionic-65`,
          lodgeName: transaction.order?.metadata?.lodge_name || 'Lodge Ionic No. 65',
          lodgeNumber: '65'
        },
        bookingContact: {
          firstName: transaction.customer?.given_name || 'Marcantone',
          lastName: transaction.customer?.family_name || 'Cosoleto',
          emailAddress: transaction.customer?.email_address || 'anthonycosoleto1990@gmail.com',
          phone: transaction.customer?.phone_number || '',
          title: transaction.customer?.note?.match(/Title: ([^,]+)/)?.[1] || '',
          businessName: transaction.order?.metadata?.lodge_name || 'Lodge Ionic No. 65'
        },
        tickets: [],
        packageDetails: {
          packageCount: parseInt(transaction.order?.metadata?.package_count || '1'),
          itemsPerPackage: parseInt(transaction.order?.metadata?.items_per_package || '10')
        }
      },
      
      // Payment information
      totalAmountPaid: transaction.summary.amount / 100,
      totalPricePaid: transaction.summary.amount / 100,
      paymentStatus: 'completed',
      status: 'completed',
      squarePaymentId: paymentId,
      
      // Customer info
      customerId: transaction.customer?.id,
      organisationName: transaction.order?.metadata?.organization_name || 'Lodge Ionic No. 65',
      organisationId: lodge?.organisationId || lodge?.lodgeId || `lodge-ionic-65`,
      
      // Dates
      createdAt: new Date(transaction.payment.created_at),
      updatedAt: new Date(),
      registrationDate: new Date(transaction.payment.created_at),
      
      // Import metadata
      importedAt: new Date(),
      importSource: 'missing-lodge-registration-creation',
      metadata: {
        createdFrom: 'square-payment-reconstruction',
        originalPaymentId: paymentId,
        notes: 'Lodge registration created from completed Square payment'
      }
    };
    
    // Extract line items to create tickets
    if (transaction.order?.line_items) {
      const tickets = [];
      
      transaction.order.line_items.forEach((item, index) => {
        const quantity = parseInt(item.quantity || '1');
        const pricePerItem = (item.base_price_money?.amount || 0) / 100;
        
        // Create individual tickets based on quantity
        for (let i = 0; i < quantity; i++) {
          tickets.push({
            eventTicketId: uuidv4(),
            name: item.name || 'Lodge Package',
            price: pricePerItem / quantity,
            quantity: 1,
            ownerType: 'lodge',
            ownerId: lodge?.lodgeId || newRegistration.registrationData.lodgeDetails.lodgeId
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
    console.log(`  Tickets: ${newRegistration.registrationData.tickets.length}\n`);
    
    // Insert the registration
    const result = await registrationsCollection.insertOne(newRegistration);
    
    if (result.acknowledged) {
      console.log(`✅ Successfully created lodge registration: ${newRegistration.confirmationNumber}`);
      
      // Now enrich the transaction with registration data
      console.log('\n=== ENRICHING TRANSACTION ===\n');
      
      // Build registration object for the transaction
      const registrationObj = {
        id: newRegistration.registrationId,
        confirmationNumber: newRegistration.confirmationNumber,
        type: 'lodge',
        attendees: []
      };
      
      // For lodge registrations, create attendees based on tickets
      newRegistration.registrationData.tickets.forEach((ticket, index) => {
        const attendee = {
          id: uuidv4(),
          type: 'lodge',
          details: {
            title: null,
            firstName: null,
            lastName: null,
            rank: null,
            grandRank: null,
            grandOfficer: null,
            grandOffice: null
          },
          contact: {
            preference: null,
            phone: null,
            email: null
          },
          relationship: {
            isPartner: false,
            partnerOf: null
          },
          membership: {
            grandLodge: {
              name: null,
              abbrv: null,
              id: null
            },
            lodge: {
              lodgeNameNumber: newRegistration.registrationData.lodgeDetails.lodgeName,
              id: newRegistration.registrationData.lodgeDetails.lodgeId
            }
          },
          catering: {
            dietaryRequirements: null,
            specialNeeds: null
          },
          tickets: [{
            eventTicketId: ticket.eventTicketId,
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity || 1
          }]
        };
        
        registrationObj.attendees.push(attendee);
      });
      
      // Update the transaction
      const updateResult = await transactionsCollection.updateOne(
        { _id: paymentId },
        { 
          $set: { 
            registration: registrationObj,
            'metadata.hasRegistration': true,
            'metadata.registrationEnrichedAt': new Date(),
            'metadata.registrationCreatedAt': new Date(),
            'metadata.registrationId': newRegistration.registrationId,
            'metadata.confirmationNumber': newRegistration.confirmationNumber
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log('✅ Successfully enriched transaction with registration data');
        console.log(`   Attendees created: ${registrationObj.attendees.length}`);
      }
      
      // Final verification
      console.log('\n=== VERIFICATION ===\n');
      
      const verifyReg = await registrationsCollection.findOne({ 
        confirmationNumber: newRegistration.confirmationNumber 
      });
      
      const verifyTx = await transactionsCollection.findOne({ _id: paymentId });
      
      console.log('Registration exists:', verifyReg ? '✅' : '❌');
      console.log('Transaction enriched:', verifyTx?.registration ? '✅' : '❌');
      console.log('Payment linked:', verifyReg?.squarePaymentId === paymentId ? '✅' : '❌');
      
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
createMissingLodgeRegistration();