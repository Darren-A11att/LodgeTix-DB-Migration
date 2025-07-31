const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkPaymentsForDuplicateBanquets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING PAYMENT DOCUMENTS FOR DUPLICATE BANQUET REGISTRATIONS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    const paymentsCollection = db.collection('payments');
    
    // Get payment collection names to check
    const collections = await db.listCollections().toArray();
    const paymentCollections = collections
      .map(c => c.name)
      .filter(name => name.includes('payment') || name.includes('Payment'));
    
    console.log('Payment-related collections found:');
    paymentCollections.forEach(c => console.log(`  - ${c}`));
    console.log('');
    
    // First, find all banquet ticket IDs
    const banquetTickets = await eventTicketsCollection.find({
      $or: [
        { name: { $regex: /banquet/i } },
        { description: { $regex: /banquet/i } }
      ]
    }).toArray();
    
    const banquetTicketIds = new Set();
    banquetTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      banquetTicketIds.add(ticketId);
    });
    
    // Get all payments and create lookup maps
    let allPayments = [];
    
    // Check main payments collection
    if (await db.collection('payments').countDocuments() > 0) {
      const payments = await paymentsCollection.find({}).toArray();
      allPayments = allPayments.concat(payments);
    }
    
    // Check other payment collections
    for (const collName of paymentCollections) {
      if (collName !== 'payments') {
        const coll = db.collection(collName);
        const count = await coll.countDocuments();
        if (count > 0) {
          console.log(`Found ${count} documents in ${collName}`);
          const docs = await coll.find({}).limit(5).toArray();
          if (docs.length > 0) {
            console.log(`Sample fields from ${collName}:`, Object.keys(docs[0]).slice(0, 10));
          }
        }
      }
    }
    
    console.log(`\nTotal payments found: ${allPayments.length}\n`);
    
    // Create payment lookup maps
    const paymentsByEmail = new Map();
    const paymentsByAmount = new Map();
    const paymentsByStripeId = new Map();
    const paymentsBySquareId = new Map();
    
    allPayments.forEach(payment => {
      // By email
      const email = (payment.email || payment.customerEmail || payment.customer_email || '').toLowerCase();
      if (email) {
        if (!paymentsByEmail.has(email)) {
          paymentsByEmail.set(email, []);
        }
        paymentsByEmail.get(email).push(payment);
      }
      
      // By amount
      const amount = payment.amount || payment.total || payment.totalAmount;
      if (amount) {
        const amountKey = parseFloat(amount).toFixed(2);
        if (!paymentsByAmount.has(amountKey)) {
          paymentsByAmount.set(amountKey, []);
        }
        paymentsByAmount.get(amountKey).push(payment);
      }
      
      // By Stripe ID
      if (payment.stripePaymentId || payment.stripe_payment_id) {
        paymentsByStripeId.set(payment.stripePaymentId || payment.stripe_payment_id, payment);
      }
      
      // By Square ID
      if (payment.squarePaymentId || payment.square_payment_id) {
        paymentsBySquareId.set(payment.squarePaymentId || payment.square_payment_id, payment);
      }
    });
    
    // Get Ross Mylonas registrations specifically
    console.log('=== ROSS MYLONAS PAYMENT INVESTIGATION ===\n');
    
    const rossRegistrations = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).toArray();
    
    console.log(`Found ${rossRegistrations.length} registrations for Ross Mylonas\n`);
    
    // Check each registration for payment matches
    for (const reg of rossRegistrations) {
      console.log(`\nRegistration: ${reg.confirmationNumber}`);
      console.log(`Amount: $${reg.totalAmountPaid || reg.totalPricePaid || 0}`);
      console.log(`Created: ${reg.createdAt}`);
      console.log(`Payment fields on registration:`);
      console.log(`  - paymentId: ${reg.paymentId || 'none'}`);
      console.log(`  - stripePaymentId: ${reg.stripePaymentId || 'none'}`);
      console.log(`  - stripePaymentIntentId: ${reg.stripePaymentIntentId || 'none'}`);
      console.log(`  - squarePaymentId: ${reg.squarePaymentId || 'none'}`);
      
      // Look for payments by email
      const emailPayments = paymentsByEmail.get('rmylonas@hotmail.com') || [];
      console.log(`\nPayments found by email: ${emailPayments.length}`);
      
      // Look for payments by amount
      const amountValue = parseFloat(reg.totalAmountPaid || reg.totalPricePaid || 0);
      const amount = amountValue.toFixed(2);
      const amountPayments = paymentsByAmount.get(amount) || [];
      console.log(`Payments found by amount ($${amount}): ${amountPayments.length}`);
      
      // Check if any payment IDs match
      let matchFound = false;
      if (reg.stripePaymentId && paymentsByStripeId.has(reg.stripePaymentId)) {
        console.log(`✓ Found payment by Stripe ID`);
        matchFound = true;
      }
      if (reg.squarePaymentId && paymentsBySquareId.has(reg.squarePaymentId)) {
        console.log(`✓ Found payment by Square ID`);
        matchFound = true;
      }
      
      if (!matchFound && (emailPayments.length > 0 || amountPayments.length > 0)) {
        console.log('\nPotential payment matches:');
        const potentialMatches = [...new Set([...emailPayments, ...amountPayments])];
        potentialMatches.slice(0, 3).forEach(p => {
          console.log(`  - Payment ID: ${p._id}, Amount: $${p.amount || p.total}, Date: ${p.createdAt || p.created_at}`);
        });
      }
    }
    
    // Now check all duplicate banquet registrations
    console.log('\n\n=== ALL DUPLICATE BANQUET REGISTRATIONS PAYMENT CHECK ===\n');
    
    const allRegistrations = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': { $ne: 'david@icucameras.com.au' }
    }).toArray();
    
    // Group by email and check for banquet tickets
    const emailGroups = new Map();
    
    for (const reg of allRegistrations) {
      const regData = reg.registrationData || {};
      const contact = regData.bookingContact || regData.billingDetails || {};
      const email = (contact.emailAddress || '').toLowerCase();
      
      if (!email) continue;
      
      // Check for banquet tickets
      let hasBanquet = false;
      (regData.tickets || []).forEach(ticket => {
        if (banquetTicketIds.has(ticket.eventTicketId)) {
          hasBanquet = true;
        }
      });
      
      if (hasBanquet) {
        if (!emailGroups.has(email)) {
          emailGroups.set(email, []);
        }
        emailGroups.get(email).push(reg);
      }
    }
    
    // Summary of payment status
    let groupsWithAllPaid = 0;
    let groupsWithSomePaid = 0;
    let groupsWithNonePaid = 0;
    
    for (const [email, regs] of emailGroups) {
      if (regs.length <= 1) continue;
      
      let paidCount = 0;
      regs.forEach(reg => {
        // Check various payment indicators
        if (reg.paymentId || reg.stripePaymentId || reg.squarePaymentId || 
            reg.stripePaymentIntentId || (reg.totalAmountPaid && reg.totalAmountPaid > 0)) {
          paidCount++;
        }
      });
      
      if (paidCount === regs.length) {
        groupsWithAllPaid++;
      } else if (paidCount > 0) {
        groupsWithSomePaid++;
      } else {
        groupsWithNonePaid++;
      }
    }
    
    console.log('Payment Status Summary:');
    console.log(`Groups where ALL registrations have payment IDs: ${groupsWithAllPaid}`);
    console.log(`Groups where SOME registrations have payment IDs: ${groupsWithSomePaid}`);
    console.log(`Groups where NO registrations have payment IDs: ${groupsWithNonePaid}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkPaymentsForDuplicateBanquets();