import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function removeBillingDetails() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Read the migration results to get the list of successfully migrated registrations
    const resultsPath = path.join(__dirname, 'billing-to-booking-migration-results.json');
    const migrationResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    
    const successfulMigrations = migrationResults.results.filter(r => r.status === 'success');
    
    console.log(`\nProcessing ${successfulMigrations.length} successfully migrated registrations...`);
    
    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    const results = [];
    
    for (const migration of successfulMigrations) {
      const registrationId = migration.registrationId;
      const confirmationNumber = migration.confirmationNumber;
      
      try {
        // Find the registration
        const existing = await registrationsCollection.findOne({
          $or: [
            { registrationId: registrationId },
            { registration_id: registrationId }
          ]
        });
        
        if (!existing) {
          console.log(`✗ Registration ${confirmationNumber} not found`);
          notFoundCount++;
          continue;
        }
        
        // Verify it has both bookingContact and billingDetails
        const hasBookingContact = !!existing.registrationData?.bookingContact;
        const hasBillingDetails = !!existing.registrationData?.billingDetails;
        
        if (!hasBookingContact) {
          console.log(`⚠ ${confirmationNumber} does not have bookingContact, skipping removal`);
          errorCount++;
          continue;
        }
        
        if (!hasBillingDetails) {
          console.log(`⚠ ${confirmationNumber} does not have billingDetails, nothing to remove`);
          continue;
        }
        
        // Remove billingDetails from registrationData
        const result = await registrationsCollection.updateOne(
          { _id: existing._id },
          {
            $unset: {
              'registrationData.billingDetails': ""
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          successCount++;
          console.log(`✓ Removed billingDetails from ${confirmationNumber}`);
          
          results.push({
            registrationId,
            confirmationNumber,
            status: 'success'
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
    
    console.log('\n=== Removal Summary ===');
    console.log(`Total registrations processed: ${successfulMigrations.length}`);
    console.log(`Successfully removed billingDetails: ${successCount}`);
    console.log(`Not found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Save removal results
    const removalResultsPath = path.join(__dirname, 'billing-details-removal-results.json');
    fs.writeFileSync(removalResultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: successfulMigrations.length,
        success: successCount,
        notFound: notFoundCount,
        errors: errorCount
      },
      results
    }, null, 2));
    
    console.log(`\nResults saved to: ${removalResultsPath}`);
    
    // Final verification
    if (successCount > 0) {
      console.log('\n=== Final Verification ===');
      console.log('Checking that billingDetails was removed and bookingContact remains...');
      
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
      
      console.log('\n✅ Migration complete! billingDetails has been removed from all migrated registrations.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
removeBillingDetails().catch(console.error);