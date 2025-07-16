import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function migrateBillingToBookingContact() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Read the normalized billingDetails data (now bookingContact)
    const billingDetailsPath = path.join(__dirname, 'registrations-with-billing-details.json');
    const billingDetailsData = JSON.parse(fs.readFileSync(billingDetailsPath, 'utf-8'));
    
    console.log(`\nProcessing ${billingDetailsData.count} lodge registrations with billingDetails...`);
    
    let successCount = 0;
    let alreadyHasBookingContact = 0;
    let errorCount = 0;
    const results = [];
    
    for (const reg of billingDetailsData.registrations) {
      const registrationId = reg.registrationId;
      const confirmationNumber = reg.confirmationNumber;
      
      try {
        // First, check if this registration already has bookingContact
        const existing = await registrationsCollection.findOne({
          $or: [
            { registrationId: registrationId },
            { registration_id: registrationId }
          ]
        });
        
        if (!existing) {
          console.log(`✗ Registration ${confirmationNumber} not found in database`);
          errorCount++;
          continue;
        }
        
        // Check if it already has bookingContact
        const hasBookingContact = !!(
          existing.bookingContact || 
          existing.booking_contact ||
          existing.registrationData?.bookingContact ||
          existing.registrationData?.booking_contact
        );
        
        if (hasBookingContact) {
          console.log(`⚠ ${confirmationNumber} already has bookingContact, skipping`);
          alreadyHasBookingContact++;
          continue;
        }
        
        // Check if it has billingDetails
        const hasBillingDetails = !!(
          existing.registrationData?.billingDetails ||
          existing.registrationData?.billing_details
        );
        
        if (!hasBillingDetails) {
          console.log(`⚠ ${confirmationNumber} does not have billingDetails in registrationData`);
          errorCount++;
          continue;
        }
        
        // Add bookingContact to registrationData (using the normalized data from our file)
        const bookingContact = reg.bookingContact;
        
        const result = await registrationsCollection.updateOne(
          { _id: existing._id },
          {
            $set: {
              'registrationData.bookingContact': bookingContact
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          successCount++;
          console.log(`✓ Added bookingContact to ${confirmationNumber}`);
          console.log(`  Name: ${bookingContact.firstName} ${bookingContact.lastName}`);
          console.log(`  Email: ${bookingContact.emailAddress}`);
          console.log(`  Business: ${bookingContact.businessName}`);
          
          results.push({
            registrationId,
            confirmationNumber,
            status: 'success',
            bookingContact
          });
        } else {
          console.log(`⚠ No changes made for ${confirmationNumber}`);
          errorCount++;
        }
        
      } catch (error) {
        errorCount++;
        console.error(`✗ Error processing ${confirmationNumber}:`, error);
        results.push({
          registrationId,
          confirmationNumber,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('\n=== Migration Summary ===');
    console.log(`Total registrations processed: ${billingDetailsData.count}`);
    console.log(`Successfully added bookingContact: ${successCount}`);
    console.log(`Already had bookingContact: ${alreadyHasBookingContact}`);
    console.log(`Errors: ${errorCount}`);
    
    // Save results to file for verification
    const resultsPath = path.join(__dirname, 'billing-to-booking-migration-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: billingDetailsData.count,
        success: successCount,
        alreadyHasBookingContact,
        errors: errorCount
      },
      results
    }, null, 2));
    
    console.log(`\nResults saved to: ${resultsPath}`);
    
    // Verify the changes
    if (successCount > 0) {
      console.log('\n=== Verification ===');
      console.log('Checking that bookingContact was added correctly...');
      
      for (const result of results) {
        if (result.status === 'success') {
          const verification = await registrationsCollection.findOne({
            $or: [
              { registrationId: result.registrationId },
              { registration_id: result.registrationId }
            ]
          });
          
          const hasBookingContact = !!verification?.registrationData?.bookingContact;
          const hasBillingDetails = !!verification?.registrationData?.billingDetails;
          
          console.log(`${result.confirmationNumber}: bookingContact=${hasBookingContact}, billingDetails=${hasBillingDetails}`);
        }
      }
      
      console.log('\n✅ bookingContact has been added. You can now run the removal script to delete billingDetails.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
migrateBillingToBookingContact().catch(console.error);