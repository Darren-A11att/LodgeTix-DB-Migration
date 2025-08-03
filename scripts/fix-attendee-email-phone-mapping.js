const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixAttendeeEmailPhoneMapping() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING ATTENDEE EMAIL/PHONE MAPPING ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const attendeesCollection = db.collection('attendees');
    const registrationImportsCollection = db.collection('registration_imports');
    const registrationsCollection = db.collection('registrations');
    
    // Find attendees with missing email or phone
    const attendeesWithMissingData = await attendeesCollection.find({
      $or: [
        { email: '' },
        { email: null },
        { phone: '' },
        { phone: null }
      ]
    }).toArray();
    
    console.log(`Found ${attendeesWithMissingData.length} attendees with missing email or phone data\n`);
    
    let fixed = 0;
    let notFound = 0;
    let errors = 0;
    
    for (const attendee of attendeesWithMissingData) {
      try {
        // Get the registration info from the attendee
        const registrationInfo = attendee.registrations && attendee.registrations[0];
        if (!registrationInfo) {
          console.log(`⚠️  No registration info for attendee ${attendee._id}`);
          notFound++;
          continue;
        }
        
        // Try to find the original registration data in registration_imports
        let originalData = null;
        let sourceCollection = null;
        
        // First try registration_imports
        const registrationImport = await registrationImportsCollection.findOne({
          registrationId: registrationInfo.registrationId
        });
        
        if (registrationImport) {
          sourceCollection = 'registration_imports';
          const attendees = registrationImport.registrationData?.attendees || registrationImport.attendees || [];
          originalData = attendees.find(a => 
            a.attendeeId === attendee.attendeeId ||
            a.id === attendee.attendeeId ||
            (a.firstName === attendee.firstName && a.lastName === attendee.lastName)
          );
        }
        
        // If not found, try registrations collection (for already processed registrations)
        if (!originalData) {
          const registration = await registrationsCollection.findOne({
            registrationId: registrationInfo.registrationId
          });
          
          if (registration) {
            sourceCollection = 'registrations';
            // For processed registrations, we need to check if there's any stored original data
            // This might be in a different format or might not exist
            const regData = registration.registrationData || registration;
            if (regData.originalAttendees) {
              originalData = regData.originalAttendees.find(a => 
                a.attendeeId === attendee.attendeeId ||
                a.id === attendee.attendeeId ||
                (a.firstName === attendee.firstName && a.lastName === attendee.lastName)
              );
            }
          }
        }
        
        if (!originalData) {
          console.log(`❌ No original data found for ${attendee.firstName} ${attendee.lastName} (${attendee._id})`);
          notFound++;
          continue;
        }
        
        // Extract email and phone from original data
        const updates = {};
        let hasUpdates = false;
        
        // Check for email
        if (!attendee.email || attendee.email === '') {
          const email = originalData.primaryEmail || originalData.email || originalData.emailAddress || null;
          if (email) {
            updates.email = email;
            hasUpdates = true;
          }
        }
        
        // Check for phone
        if (!attendee.phone || attendee.phone === '') {
          const phone = originalData.primaryPhone || originalData.phone || originalData.phoneNumber || null;
          if (phone) {
            updates.phone = phone;
            hasUpdates = true;
          }
        }
        
        if (hasUpdates) {
          // Add modification history entry
          const modificationEntry = {
            id: new ObjectId(),
            type: 'update',
            changes: [],
            description: 'Fixed missing email/phone data from original registration',
            timestamp: new Date(),
            userId: 'system-fix',
            source: 'fix-attendee-email-phone-mapping'
          };
          
          if (updates.email) {
            modificationEntry.changes.push({
              field: 'email',
              from: attendee.email || null,
              to: updates.email
            });
          }
          
          if (updates.phone) {
            modificationEntry.changes.push({
              field: 'phone',
              from: attendee.phone || null,
              to: updates.phone
            });
          }
          
          // Update the attendee
          await attendeesCollection.updateOne(
            { _id: attendee._id },
            {
              $set: {
                ...updates,
                modifiedAt: new Date(),
                lastModificationId: modificationEntry.id
              },
              $push: {
                modificationHistory: modificationEntry
              }
            }
          );
          
          console.log(`✅ Fixed ${attendee.firstName} ${attendee.lastName}: email=${updates.email || 'no change'}, phone=${updates.phone || 'no change'} (from ${sourceCollection})`);
          fixed++;
        } else {
          console.log(`⚠️  No email/phone found in original data for ${attendee.firstName} ${attendee.lastName}`);
          notFound++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing attendee ${attendee._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n=== FIX COMPLETE ===\n');
    console.log(`Total attendees with missing data: ${attendeesWithMissingData.length}`);
    console.log(`Successfully fixed: ${fixed}`);
    console.log(`No original data found: ${notFound}`);
    console.log(`Errors: ${errors}`);
    
    // Show some examples of fixed attendees
    if (fixed > 0) {
      console.log('\n=== SAMPLE FIXED ATTENDEES ===\n');
      const fixedAttendees = await attendeesCollection.find({
        'modificationHistory.source': 'fix-attendee-email-phone-mapping'
      }).limit(3).toArray();
      
      fixedAttendees.forEach(attendee => {
        console.log(`${attendee.firstName} ${attendee.lastName}:`);
        console.log(`  Email: ${attendee.email || 'still empty'}`);
        console.log(`  Phone: ${attendee.phone || 'still empty'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixAttendeeEmailPhoneMapping()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });