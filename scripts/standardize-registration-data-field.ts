import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function standardizeRegistrationDataField() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // First, find all registrations with registration_data field
    console.log('\nSearching for registrations with registration_data field...');
    const registrationsWithSnakeCase = await registrationsCollection.find({
      registration_data: { $exists: true }
    }).toArray();
    
    console.log(`Found ${registrationsWithSnakeCase.length} registrations with registration_data field`);
    
    if (registrationsWithSnakeCase.length === 0) {
      console.log('No registrations need updating');
      return;
    }
    
    // Process each registration
    let successCount = 0;
    let errorCount = 0;
    
    for (const registration of registrationsWithSnakeCase) {
      const registrationId = registration.registrationId || registration.registration_id || registration._id;
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number || 'N/A';
      
      try {
        // Rename registration_data to registrationData
        const result = await registrationsCollection.updateOne(
          { _id: registration._id },
          {
            $rename: { 'registration_data': 'registrationData' }
          }
        );
        
        if (result.modifiedCount > 0) {
          successCount++;
          console.log(`✓ Updated ${confirmationNumber} (${registrationId})`);
        } else {
          console.log(`⚠ No changes for ${confirmationNumber} (${registrationId})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Error updating ${confirmationNumber} (${registrationId}):`, error);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total registrations found: ${registrationsWithSnakeCase.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the changes
    console.log('\nVerifying changes...');
    const remainingSnakeCase = await registrationsCollection.countDocuments({
      registration_data: { $exists: true }
    });
    const camelCaseCount = await registrationsCollection.countDocuments({
      registrationData: { $exists: true }
    });
    
    console.log(`\nAfter update:`);
    console.log(`- Registrations with registration_data: ${remainingSnakeCase}`);
    console.log(`- Registrations with registrationData: ${camelCaseCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
standardizeRegistrationDataField().catch(console.error);