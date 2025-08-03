const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixAttendeeMembershipMapping() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING ATTENDEE MEMBERSHIP MAPPING ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const attendeesCollection = db.collection('attendees');
    const registrationImportsCollection = db.collection('registration_imports');
    const registrationsCollection = db.collection('registrations');
    
    // Find attendees without membership data
    const attendeesWithoutMembership = await attendeesCollection.find({
      $or: [
        { membership: { $exists: false } },
        { membership: null }
      ]
    }).toArray();
    
    console.log(`Found ${attendeesWithoutMembership.length} attendees without membership data\n`);
    
    let fixed = 0;
    let notFound = 0;
    let noMembershipData = 0;
    let errors = 0;
    
    for (const attendee of attendeesWithoutMembership) {
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
        
        // Check if the original data has any lodge/grand lodge information
        const hasLodgeData = originalData.lodge_id || originalData.lodgeId || 
                           originalData.lodgeOrganisationId || originalData.lodgeNameNumber ||
                           originalData.grand_lodge || originalData.grand_lodge_id;
        
        if (!hasLodgeData) {
          console.log(`⚠️  No lodge data in original for ${attendee.firstName} ${attendee.lastName}`);
          noMembershipData++;
          continue;
        }
        
        // Build the new membership and constitution structure
        const membership = {
          lodgeName: originalData.lodge || originalData.lodgeName || '',
          lodgeNumber: originalData.lodgeNumber || '',
          lodgeNameNumber: originalData.lodgeNameNumber || originalData.lodge_name_number || '',
          lodgeId: originalData.lodge_id || originalData.lodgeOrganisationId || originalData.lodgeId || null
        };
        
        const constitution = {
          grandLodgeName: originalData.grand_lodge || originalData.grandLodge || '',
          grandLodgeId: originalData.grand_lodge_id || originalData.grandLodgeOrganisationId || originalData.grandLodgeId || null
        };
        
        // Also update individual fields if they're missing
        const updates = {
          membership: membership,
          constitution: constitution
        };
        
        // Add individual fields if missing for backward compatibility
        if (!attendee.lodge_id && membership.lodgeId) {
          updates.lodge_id = membership.lodgeId;
        }
        if (!attendee.lodgeNameNumber && membership.lodgeNameNumber) {
          updates.lodgeNameNumber = membership.lodgeNameNumber;
        }
        if (!attendee.grand_lodge_id && constitution.grandLodgeId) {
          updates.grand_lodge_id = constitution.grandLodgeId;
        }
        if (!attendee.rank && originalData.rank) {
          updates.rank = originalData.rank;
        }
        if (!attendee.attendeeType && originalData.attendeeType) {
          updates.attendeeType = originalData.attendeeType;
        }
        
        // Add modification history entry
        const modificationEntry = {
          id: new ObjectId(),
          type: 'update',
          changes: [],
          description: 'Added membership data from original registration',
          timestamp: new Date(),
          userId: 'system-fix',
          source: 'fix-attendee-membership-mapping'
        };
        
        // Record changes
        modificationEntry.changes.push({
          field: 'membership',
          from: null,
          to: membership
        });
        
        modificationEntry.changes.push({
          field: 'constitution',
          from: null,
          to: constitution
        });
        
        if (updates.lodge_id) {
          modificationEntry.changes.push({
            field: 'lodge_id',
            from: attendee.lodge_id || null,
            to: updates.lodge_id
          });
        }
        
        if (updates.rank) {
          modificationEntry.changes.push({
            field: 'rank',
            from: attendee.rank || null,
            to: updates.rank
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
        
        console.log(`✅ Fixed ${attendee.firstName} ${attendee.lastName}: Lodge="${membership.lodgeNameNumber}", Grand Lodge="${constitution.grandLodgeName}" (from ${sourceCollection})`);
        fixed++;
        
      } catch (error) {
        console.error(`❌ Error processing attendee ${attendee._id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n=== FIX COMPLETE ===\n');
    console.log(`Total attendees without membership: ${attendeesWithoutMembership.length}`);
    console.log(`Successfully fixed: ${fixed}`);
    console.log(`No original data found: ${notFound}`);
    console.log(`No membership data in original: ${noMembershipData}`);
    console.log(`Errors: ${errors}`);
    
    // Show some examples of fixed attendees
    if (fixed > 0) {
      console.log('\n=== SAMPLE FIXED ATTENDEES ===\n');
      const fixedAttendees = await attendeesCollection.find({
        'modificationHistory.source': 'fix-attendee-membership-mapping'
      }).limit(3).toArray();
      
      fixedAttendees.forEach(attendee => {
        console.log(`${attendee.firstName} ${attendee.lastName}:`);
        if (attendee.constitution) {
          console.log(`  Grand Lodge: ${attendee.constitution.grandLodgeName || 'N/A'}`);
        }
        if (attendee.membership) {
          console.log(`  Lodge: ${attendee.membership.lodgeNameNumber || 'N/A'}`);
          console.log(`  Rank: ${attendee.rank || 'N/A'}`);
          console.log(`  Type: ${attendee.attendeeType || 'N/A'}`);
        }
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
fixAttendeeMembershipMapping()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });