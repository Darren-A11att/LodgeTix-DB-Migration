const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function extractRemainingAttendees() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXTRACTING REMAINING ATTENDEES ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const ticketsCollection = db.collection('tickets');
    
    // Find registrations that need attendee extraction
    const registrationsNeedingExtraction = await registrationsCollection.find({
      'registrationData.attendees': { $exists: true, $ne: [] },
      $or: [
        { 'registrationData.attendeesExtracted': { $ne: true } },
        { 'registrationData.attendeesExtracted': { $exists: false } }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsNeedingExtraction.length} registrations needing attendee extraction\n`);
    
    let totalAttendeesProcessed = 0;
    let totalRegistrationsUpdated = 0;
    let errors = 0;
    
    for (const registration of registrationsNeedingExtraction) {
      try {
        console.log(`Processing ${registration.confirmationNumber}...`);
        
        const attendees = registration.registrationData?.attendees || [];
        
        // Get all tickets for this registration
        const registrationTickets = await ticketsCollection.find({
          'details.registrationId': registration.registrationId
        }).toArray();
        
        console.log(`  Found ${attendees.length} attendees and ${registrationTickets.length} tickets`);
        
        // New array to store attendee references
        const attendeeReferences = [];
        
        // Process each attendee
        for (const attendee of attendees) {
          try {
            // Create the new attendee document ID
            const newAttendeeId = new ObjectId();
            
            // Find tickets for this specific attendee
            const attendeeTickets = registrationTickets.filter(ticket => 
              ticket.ownerId === attendee.attendeeId || 
              ticket.ownerId === attendee.id ||
              ticket.ownerId === attendee._id?.toString()
            );
            
            // Get registration info
            const registrationInfo = {
              registrationId: registration.registrationId,
              registrationType: registration.registrationType || 'individuals',
              functionId: registration.functionId,
              functionName: registration.functionName || registration.registrationData?.functionName || 'Event',
              confirmationNumber: registration.confirmationNumber,
              paymentId: registration.paymentId || registration.stripe_payment_intent_id || registration.squarePaymentId,
              bookingContactId: registration.booking_contact_id || registration.bookingContactId
            };
            
            // Create modification history
            const modificationHistory = [{
              id: new ObjectId().toString(),
              timestamp: new Date(),
              source: 'extract-remaining-attendees',
              operation: 'create',
              modifiedFields: ['initial_creation'],
              modifiedBy: 'system',
              details: {
                reason: 'Extracted from registration document',
                registrationId: registration._id
              }
            }];
            
            // Create the new attendee document with ALL fields
            const newAttendee = {
              _id: newAttendeeId,
              
              // Core identity fields
              attendeeId: attendee.attendeeId || new ObjectId().toString(),
              firstName: attendee.firstName || '',
              lastName: attendee.lastName || '',
              email: attendee.primaryEmail || attendee.email || '',
              phone: attendee.primaryPhone || attendee.phone || '',
              
              // Title and name fields
              title: attendee.title || '',
              suffix: attendee.suffix || '',
              postNominals: attendee.postNominals || '',
              
              // Type and status fields
              attendeeType: attendee.attendeeType || attendee.type || 'guest',
              isPrimary: attendee.isPrimary || false,
              isCheckedIn: attendee.isCheckedIn || false,
              firstTime: attendee.firstTime || false,
              
              // Partner/relationship fields
              partner: attendee.partner || null,
              partnerOf: attendee.partnerOf || null,
              isPartner: attendee.isPartner || null,
              relationship: attendee.relationship || '',
              guestOfId: attendee.guestOfId || null,
              
              // Contact preferences
              contactPreference: attendee.contactPreference || 'directly',
              contactConfirmed: attendee.contactConfirmed || false,
              
              // Dietary and special needs
              dietaryRequirements: attendee.dietaryRequirements || attendee.dietary || '',
              specialNeeds: attendee.specialNeeds || attendee.accessibility || '',
              notes: attendee.notes || '',
              
              // Lodge/organization fields
              rank: attendee.rank || '',
              lodge: attendee.lodge || '',
              lodge_id: attendee.lodge_id || attendee.lodgeId || attendee.lodgeOrganisationId || null,
              lodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
              grand_lodge: attendee.grand_lodge || attendee.grandLodge || '',
              grand_lodge_id: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null,
              grandOfficerStatus: attendee.grandOfficerStatus || '',
              useSameLodge: attendee.useSameLodge || false,
              
              // Organization (legacy field)
              organization: attendee.organization || attendee.lodge || '',
              
              // Membership object for structured data
              membership: {
                GrandLodgeName: attendee.grand_lodge || attendee.grandLodge || '',
                GrandLodgeId: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null,
                LodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
                LodgeId: attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || null
              },
              
              // Payment and table info
              paymentStatus: attendee.paymentStatus || 'pending',
              tableAssignment: attendee.tableAssignment || null,
              
              // Registration references
              registrations: [{
                registrationId: registrationInfo.registrationId,
                registrationType: registrationInfo.registrationType,
                functionId: registrationInfo.functionId,
                functionName: registrationInfo.functionName,
                confirmationNumber: registrationInfo.confirmationNumber,
                paymentId: registrationInfo.paymentId,
                bookingContactId: registrationInfo.bookingContactId
              }],
              
              // Auth user ID
              authUserId: attendee.authUserId || attendee.auth_user_id || null,
              
              // Event tickets for this attendee
              event_tickets: attendeeTickets.map(ticket => ({
                _id: ticket._id,
                name: ticket.eventName,
                status: ticket.status
              })),
              
              // Timestamps
              createdAt: attendee.createdAt || registration.createdAt || new Date(),
              updatedAt: attendee.updatedAt || new Date(),
              modifiedAt: new Date(),
              
              // Modification tracking
              lastModificationId: modificationHistory[modificationHistory.length - 1].id,
              modificationHistory: modificationHistory
            };
            
            // Insert the new attendee
            await attendeesCollection.insertOne(newAttendee);
            
            // Add reference to the array
            attendeeReferences.push({
              _id: newAttendeeId
            });
            
            totalAttendeesProcessed++;
            
            console.log(`    Created attendee: ${attendee.firstName} ${attendee.lastName}`);
            
          } catch (attendeeError) {
            console.error(`    Error processing attendee:`, attendeeError.message);
            errors++;
          }
        }
        
        // Update the registration to replace attendee objects with references
        if (attendeeReferences.length > 0) {
          const updateResult = await registrationsCollection.updateOne(
            { _id: registration._id },
            { 
              $set: { 
                'registrationData.attendees': attendeeReferences,
                'registrationData.attendeesExtracted': true,
                'registrationData.attendeesExtractionDate': new Date()
              }
            }
          );
          
          if (updateResult.modifiedCount === 1) {
            totalRegistrationsUpdated++;
            console.log(`  ✅ Updated registration with ${attendeeReferences.length} attendee references`);
          }
        }
        
      } catch (regError) {
        console.error(`Error processing registration ${registration._id}:`, regError.message);
        errors++;
      }
    }
    
    console.log('\n=== EXTRACTION COMPLETE ===\n');
    console.log(`Total registrations processed: ${registrationsNeedingExtraction.length}`);
    console.log(`Total registrations updated: ${totalRegistrationsUpdated}`);
    console.log(`Total attendees extracted: ${totalAttendeesProcessed}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the specific registration
    console.log('\n=== VERIFYING IND-838391AP ===');
    
    const verifyReg = await registrationsCollection.findOne({
      confirmationNumber: 'IND-838391AP'
    });
    
    if (verifyReg) {
      console.log('Attendees Extracted:', verifyReg.registrationData?.attendeesExtracted);
      
      const verifyAttendees = await attendeesCollection.find({
        'registrations.registrationId': verifyReg.registrationId
      }).toArray();
      
      console.log('Attendees in collection:', verifyAttendees.length);
      verifyAttendees.forEach(a => {
        console.log(`  - ${a.firstName} ${a.lastName}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the extraction
extractRemainingAttendees();