const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function extractAttendeesToCollection() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXTRACTING ATTENDEES TO SEPARATE COLLECTION ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const eventsCollection = db.collection('events');
    const ticketsCollection = db.collection('tickets');
    
    // Check current state
    const attendeeCount = await attendeesCollection.countDocuments();
    if (attendeeCount > 0) {
      console.log(`⚠️  WARNING: attendees collection already has ${attendeeCount} documents`);
      console.log('Do you want to continue? This script will add more attendees.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Get all registrations with attendees
    const registrationsWithAttendees = await registrationsCollection.find({
      'registrationData.attendees': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`Found ${registrationsWithAttendees.length} registrations with attendees\n`);
    
    // Create event/function map for name lookup
    const eventMap = new Map();
    const events = await eventsCollection.find({}).toArray();
    events.forEach(event => {
      const eventId = event.eventId || event.event_id || event._id.toString();
      eventMap.set(eventId, event.name || 'Unknown Event');
    });
    
    let totalAttendeesProcessed = 0;
    let totalRegistrationsUpdated = 0;
    let errors = 0;
    
    // Process each registration
    for (const registration of registrationsWithAttendees) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        const attendees = regData.attendees || [];
        
        if (attendees.length === 0) continue;
        
        console.log(`Processing registration: ${registration.confirmationNumber} (${attendees.length} attendees)`);
        
        // Extract registration info
        const registrationInfo = {
          registrationObjectId: registration._id,
          status: registration.status || 'pending',
          registrationId: registration.registrationId,
          functionId: registration.eventId || registration.functionId || regData.eventId || regData.functionId,
          confirmationNumber: registration.confirmationNumber,
          paymentId: registration.paymentId || registration.stripePaymentIntentId || registration.squarePaymentId || null,
          bookingContactId: regData.bookingContact?.contactId || regData.bookingContact?.id || 
                           regData.billingDetails?.contactId || regData.billingDetails?.id || null
        };
        
        // Get function name
        const functionName = eventMap.get(registrationInfo.functionId) || 'Unknown Function';
        
        // Get all tickets for this registration
        const registrationTickets = await ticketsCollection.find({
          'details.registrationId': registration.registrationId
        }).toArray();
        
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
            
            // Build modification history
            const modificationHistory = [];
            
            // Creation entry
            const creationEntry = {
              id: new ObjectId(),
              type: 'creation',
              changes: [],
              description: 'Attendee extracted from registration during migration',
              timestamp: new Date(),
              userId: 'system-migration',
              source: 'attendee-extraction-script'
            };
            
            // Record initial values
            if (attendee.firstName || attendee.lastName) {
              creationEntry.changes.push({
                field: 'name',
                from: null,
                to: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim()
              });
            }
            
            modificationHistory.push(creationEntry);
            
            // Build the new attendee document with ALL fields
            const newAttendee = {
              _id: newAttendeeId,
              
              // Core identity fields
              attendeeId: attendee.attendeeId || attendee.id || newAttendeeId.toString(),
              firstName: attendee.firstName || attendee.first_name || '',
              lastName: attendee.lastName || attendee.last_name || '',
              email: attendee.primaryEmail || attendee.email || attendee.emailAddress || '',
              phone: attendee.primaryPhone || attendee.phone || attendee.phoneNumber || '',
              
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
              
              // Registration info
              registrations: [{
                _id: registrationInfo.registrationObjectId,
                status: registrationInfo.status,
                registrationId: registrationInfo.registrationId,
                functionId: registrationInfo.functionId,
                functionName: functionName,
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
            
          } catch (attendeeError) {
            console.error(`  Error processing attendee in registration ${registration.confirmationNumber}:`, attendeeError.message);
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
          }
        }
        
        // Log progress every 50 registrations
        if (totalRegistrationsUpdated % 50 === 0) {
          console.log(`Processed ${totalRegistrationsUpdated} registrations, ${totalAttendeesProcessed} attendees...`);
        }
        
      } catch (regError) {
        console.error(`Error processing registration ${registration._id}:`, regError.message);
        errors++;
      }
    }
    
    console.log('\n=== EXTRACTION COMPLETE ===\n');
    console.log(`Total registrations processed: ${registrationsWithAttendees.length}`);
    console.log(`Total registrations updated: ${totalRegistrationsUpdated}`);
    console.log(`Total attendees extracted: ${totalAttendeesProcessed}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the extraction
    console.log('\n=== VERIFICATION ===\n');
    
    // Check a sample attendee
    const sampleAttendee = await attendeesCollection.findOne({});
    if (sampleAttendee) {
      console.log('Sample extracted attendee:');
      console.log(JSON.stringify(sampleAttendee, null, 2));
    }
    
    // Check a sample updated registration
    const sampleReg = await registrationsCollection.findOne({
      'registrationData.attendeesExtracted': true
    });
    if (sampleReg) {
      console.log('\nSample updated registration attendees array:');
      console.log(JSON.stringify(sampleReg.registrationData.attendees, null, 2));
    }
    
    // Create indexes
    console.log('\n=== CREATING INDEXES ===\n');
    
    await attendeesCollection.createIndex({ attendeeId: 1 });
    await attendeesCollection.createIndex({ email: 1 });
    await attendeesCollection.createIndex({ 'registrations.registrationId': 1 });
    await attendeesCollection.createIndex({ 'registrations.confirmationNumber': 1 });
    await attendeesCollection.createIndex({ authUserId: 1 });
    await attendeesCollection.createIndex({ createdAt: 1 });
    await attendeesCollection.createIndex({ 
      firstName: 1, 
      lastName: 1 
    }, { name: 'name_compound' });
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the extraction
extractAttendeesToCollection();