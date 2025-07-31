const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateRossRefundedRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING ROSS MYLONAS REFUNDED/FAILED REGISTRATIONS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Define the registrations to update
    const registrationsToUpdate = [
      {
        confirmationNumber: 'IND-616604CO',
        stripePaymentIntentId: 'pi_3RYGk6KBASow5NsW1e0MBgty',
        newStatus: 'refunded',
        reason: 'Payment refunded'
      },
      {
        confirmationNumber: 'IND-013387DT',
        stripePaymentIntentId: 'pi_3RYGmnKBASow5NsW0HE5LcqU',
        newStatus: 'refunded',
        reason: 'Payment refunded'
      },
      {
        confirmationNumber: 'IND-820268FC',
        stripePaymentIntentId: 'pi_3RYH94KBASow5NsW10e3Twp8',
        newStatus: 'refunded',
        reason: 'Payment refunded'
      },
      {
        confirmationNumber: 'IND-899170ZA',
        stripePaymentIntentId: 'pi_3RYHAkKBASow5NsW1G5QBouB',
        newStatus: 'failed',
        reason: 'Payment failed'
      }
    ];
    
    // First, verify the paid registration
    const paidReg = await registrationsCollection.findOne({
      confirmationNumber: 'IND-927200QC'
    });
    
    if (paidReg) {
      console.log('✅ Verified PAID registration:');
      console.log(`   Confirmation: ${paidReg.confirmationNumber}`);
      console.log(`   Status: ${paidReg.paymentStatus}`);
      console.log(`   Amount: $${paidReg.totalAmountPaid}`);
      console.log(`   Tickets: ${paidReg.registrationData?.tickets?.length || 0}`);
      console.log('   This registration will be preserved as-is.\n');
    }
    
    // Process each registration to update
    for (const regUpdate of registrationsToUpdate) {
      console.log(`\nProcessing ${regUpdate.confirmationNumber}...`);
      
      // Find the registration
      const registration = await registrationsCollection.findOne({
        confirmationNumber: regUpdate.confirmationNumber,
        stripePaymentIntentId: regUpdate.stripePaymentIntentId
      });
      
      if (!registration) {
        console.log(`❌ Registration not found!`);
        continue;
      }
      
      console.log(`Found registration:`);
      console.log(`  Current status: ${registration.paymentStatus}`);
      console.log(`  Tickets: ${registration.registrationData?.tickets?.length || 0}`);
      
      // Prepare the update
      const updateObj = {
        $set: {
          paymentStatus: regUpdate.newStatus,
          status: regUpdate.newStatus,
          updatedAt: new Date(),
          'metadata.refundReason': regUpdate.reason,
          'metadata.updatedBy': 'duplicate-cleanup-script',
          'metadata.originalPaymentStatus': registration.paymentStatus
        }
      };
      
      // Update tickets to cancelled status
      if (registration.registrationData?.tickets && registration.registrationData.tickets.length > 0) {
        const updatedTickets = registration.registrationData.tickets.map(ticket => ({
          ...ticket,
          status: 'cancelled',
          previousStatus: ticket.status || 'sold',
          cancelledAt: new Date(),
          cancelledReason: regUpdate.reason
        }));
        
        updateObj.$set['registrationData.tickets'] = updatedTickets;
        
        console.log(`  Cancelling ${updatedTickets.length} tickets`);
      }
      
      // Perform the update
      const result = await registrationsCollection.updateOne(
        { _id: registration._id },
        updateObj
      );
      
      if (result.modifiedCount === 1) {
        console.log(`✅ Successfully updated registration:`);
        console.log(`   - Payment status: ${registration.paymentStatus} → ${regUpdate.newStatus}`);
        console.log(`   - Tickets marked as cancelled`);
      } else {
        console.log(`❌ Failed to update registration`);
      }
    }
    
    // Final verification
    console.log('\n\n=== FINAL VERIFICATION ===\n');
    
    const allRossRegs = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).toArray();
    
    console.log('Ross Mylonas registrations after update:');
    allRossRegs.forEach(reg => {
      const ticketStatuses = {};
      (reg.registrationData?.tickets || []).forEach(ticket => {
        ticketStatuses[ticket.status || 'unknown'] = (ticketStatuses[ticket.status || 'unknown'] || 0) + 1;
      });
      
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  Payment Status: ${reg.paymentStatus}`);
      console.log(`  Registration Status: ${reg.status}`);
      console.log(`  Tickets: ${JSON.stringify(ticketStatuses)}`);
    });
    
    // Count active vs cancelled tickets
    let activeTickets = 0;
    let cancelledTickets = 0;
    
    allRossRegs.forEach(reg => {
      (reg.registrationData?.tickets || []).forEach(ticket => {
        if (ticket.status === 'cancelled') {
          cancelledTickets++;
        } else if (ticket.status === 'sold' || !ticket.status) {
          activeTickets++;
        }
      });
    });
    
    console.log('\n\nSUMMARY:');
    console.log(`Total registrations: ${allRossRegs.length}`);
    console.log(`Active tickets: ${activeTickets} (should be 4 - from the paid registration)`);
    console.log(`Cancelled tickets: ${cancelledTickets} (should be 16 - from the 4 refunded/failed registrations)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateRossRefundedRegistrations();