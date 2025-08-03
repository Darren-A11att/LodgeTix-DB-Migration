const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function extractPrimaryAdditionalAttendees() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXTRACTING ATTENDEES FROM PRIMARY/ADDITIONAL FORMAT ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const ticketsCollection = db.collection('tickets');
    const importsCollection = db.collection('registration_imports');
    
    // Find registrations with the new format in registration_imports
    const registrationsWithNewFormat = await importsCollection.find({
      $or: [
        { 'registrationData.primaryAttendee': { $exists: true } },
        { 'registrationData.additionalAttendees': { $exists: true, $ne: [] } }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithNewFormat.length} registrations with primaryAttendee/additionalAttendees format\n`);
    
    let totalAttendeesProcessed = 0;
    let totalAttendeesCreated = 0;
    let totalAttendeesUpdated = 0;
    let errors = 0;
    
    for (const registration of registrationsWithNewFormat) {
      try {
        console.log(`\nProcessing ${registration.confirmationNumber} (${registration.registrationId})...`);
        
        const regData = registration.registrationData || {};
        const allAttendees = [];
        
        // Process primary attendee
        if (regData.primaryAttendee) {
          allAttendees.push({
            ...regData.primaryAttendee,
            isPrimary: true
          });
        }
        
        // Process additional attendees
        if (regData.additionalAttendees && Array.isArray(regData.additionalAttendees)) {
          allAttendees.push(...regData.additionalAttendees);
        }
        
        console.log(`  Found ${allAttendees.length} attendees to process`);
        
        // Get all tickets for this registration
        const registrationTickets = await ticketsCollection.find({
          'details.registrationId': registration.registrationId
        }).toArray();
        
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
        
        // Process each attendee
        for (const attendee of allAttendees) {
          try {
            totalAttendeesProcessed++;
            
            // Check if attendee already exists
            const existingAttendee = await attendeesCollection.findOne({
              attendeeId: attendee.attendeeId
            });
            
            if (existingAttendee) {
              console.log(`    Updating existing attendee: ${attendee.firstName} ${attendee.lastName}`);
              
              // Create update object with all fields from the new format (including new data structure)
              const updateData = {
                // NEW DATA STRUCTURE
                jurisdiction: {},
                constitution: await buildConstitutionObject(attendee, db),
                membership: await buildMembershipObject(attendee, db),
                legacyMembership: {
                  GrandLodgeName: attendee.grand_lodge || attendee.grandLodge || existingAttendee.grand_lodge || '',
                  GrandLodgeId: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || existingAttendee.grand_lodge_id || null,
                  LodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || existingAttendee.lodgeNameNumber || '',
                  LodgeId: attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || existingAttendee.lodge_id || null
                },
                // Core fields
                email: attendee.primaryEmail || attendee.email || existingAttendee.email || '',
                phone: attendee.primaryPhone || attendee.phone || existingAttendee.phone || '',
                
                // Title and name fields
                title: attendee.title || existingAttendee.title || '',
                suffix: attendee.suffix || existingAttendee.suffix || '',
                postNominals: attendee.postNominals || existingAttendee.postNominals || '',
                
                // Type and status fields
                attendeeType: attendee.attendeeType || attendee.type || existingAttendee.attendeeType || 'guest',
                isPrimary: attendee.isPrimary !== undefined ? attendee.isPrimary : existingAttendee.isPrimary,
                isCheckedIn: attendee.isCheckedIn || existingAttendee.isCheckedIn || false,
                firstTime: attendee.firstTime !== undefined ? attendee.firstTime : existingAttendee.firstTime,
                
                // Partner/relationship fields
                partner: attendee.partner || existingAttendee.partner || null,
                partnerOf: attendee.partnerOf || existingAttendee.partnerOf || null,
                isPartner: attendee.isPartner || existingAttendee.isPartner || null,
                relationship: attendee.relationship || existingAttendee.relationship || '',
                guestOfId: attendee.guestOfId || existingAttendee.guestOfId || null,
                
                // Contact preferences
                contactPreference: attendee.contactPreference || existingAttendee.contactPreference || 'directly',
                contactConfirmed: attendee.contactConfirmed || existingAttendee.contactConfirmed || false,
                
                // Dietary and special needs
                dietaryRequirements: attendee.dietaryRequirements || attendee.dietary || existingAttendee.dietaryRequirements || '',
                specialNeeds: attendee.specialNeeds || attendee.accessibility || existingAttendee.specialNeeds || '',
                notes: attendee.notes || existingAttendee.notes || '',
                
                // Lodge/organization fields
                rank: attendee.rank || existingAttendee.rank || '',
                lodge: attendee.lodge || existingAttendee.lodge || '',
                lodge_id: attendee.lodge_id || attendee.lodgeId || attendee.lodgeOrganisationId || existingAttendee.lodge_id || null,
                lodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || existingAttendee.lodgeNameNumber || '',
                grand_lodge: attendee.grand_lodge || attendee.grandLodge || existingAttendee.grand_lodge || '',
                grand_lodge_id: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || existingAttendee.grand_lodge_id || null,
                grandOfficerStatus: attendee.grandOfficerStatus || existingAttendee.grandOfficerStatus || '',
                useSameLodge: attendee.useSameLodge !== undefined ? attendee.useSameLodge : existingAttendee.useSameLodge,
                
                // Membership object
                membership: {
                  GrandLodgeName: attendee.grand_lodge || attendee.grandLodge || existingAttendee.membership?.GrandLodgeName || '',
                  GrandLodgeId: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || existingAttendee.membership?.GrandLodgeId || null,
                  LodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || existingAttendee.membership?.LodgeNameNumber || '',
                  LodgeId: attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || existingAttendee.membership?.LodgeId || null
                },
                
                // Payment and table info
                paymentStatus: attendee.paymentStatus || existingAttendee.paymentStatus || 'pending',
                tableAssignment: attendee.tableAssignment || existingAttendee.tableAssignment || null,
                
                // Timestamps
                modifiedAt: new Date()
              };
              
              // Add modification history
              const modificationEntry = {
                id: new ObjectId().toString(),
                timestamp: new Date(),
                source: 'extract-primary-additional-attendees',
                operation: 'update',
                modifiedFields: Object.keys(updateData),
                modifiedBy: 'system',
                details: {
                  reason: 'Extracted from primaryAttendee/additionalAttendees format',
                  registrationId: registration._id,
                  fromFormat: attendee.isPrimary ? 'primaryAttendee' : 'additionalAttendees'
                }
              };
              
              await attendeesCollection.updateOne(
                { _id: existingAttendee._id },
                {
                  $set: {
                    ...updateData,
                    lastModificationId: modificationEntry.id
                  },
                  $push: {
                    modificationHistory: modificationEntry
                  }
                }
              );
              
              totalAttendeesUpdated++;
              
            } else {
              console.log(`    Creating new attendee: ${attendee.firstName} ${attendee.lastName}`);
              
              // Create new attendee document
              const newAttendeeId = new ObjectId();
              
              // Find tickets for this specific attendee
              const attendeeTickets = registrationTickets.filter(ticket => 
                ticket.ownerId === attendee.attendeeId || 
                ticket.ownerId === attendee.id ||
                ticket.ownerId === attendee._id?.toString()
              );
              
              // Create modification history
              const modificationHistory = [{
                id: new ObjectId().toString(),
                timestamp: new Date(),
                source: 'extract-primary-additional-attendees',
                operation: 'create',
                modifiedFields: ['initial_creation'],
                modifiedBy: 'system',
                details: {
                  reason: 'Created from primaryAttendee/additionalAttendees format',
                  registrationId: registration._id,
                  fromFormat: attendee.isPrimary ? 'primaryAttendee' : 'additionalAttendees'
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
                
                // NEW DATA STRUCTURE: Jurisdiction object (empty for now)
                jurisdiction: {},
                
                // NEW DATA STRUCTURE: Constitution object with Grand Lodge lookup
                constitution: await buildConstitutionObject(attendee, db),
                
                // NEW DATA STRUCTURE: Enhanced Membership object with Lodge lookup
                membership: await buildMembershipObject(attendee, db),
                
                // Legacy membership object (keep for backward compatibility)
                legacyMembership: {
                  GrandLodgeName: attendee.grand_lodge || attendee.grandLodge || '',
                  GrandLodgeId: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null,
                  LodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
                  LodgeId: attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || null
                },
                
                // Payment and table info
                paymentStatus: attendee.paymentStatus || 'pending',
                tableAssignment: attendee.tableAssignment || null,
                
                // Registration references
                registrations: [registrationInfo],
                
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
              totalAttendeesCreated++;
            }
            
          } catch (attendeeError) {
            console.error(`    Error processing attendee:`, attendeeError.message);
            errors++;
          }
        }
        
      } catch (regError) {
        console.error(`Error processing registration ${registration._id}:`, regError.message);
        errors++;
      }
    }
    
    console.log('\n=== EXTRACTION COMPLETE ===\n');
    console.log(`Total registrations processed: ${registrationsWithNewFormat.length}`);
    console.log(`Total attendees processed: ${totalAttendeesProcessed}`);
    console.log(`Total attendees created: ${totalAttendeesCreated}`);
    console.log(`Total attendees updated: ${totalAttendeesUpdated}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the 34 unenriched attendees
    console.log('\n=== VERIFYING UNENRICHED ATTENDEES ===');
    
    const stillUnenriched = await attendeesCollection.countDocuments({
      'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
    });
    
    console.log(`Attendees still needing enrichment: ${stillUnenriched}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

/**
 * Build constitution object by looking up grandLodges collection
 */
async function buildConstitutionObject(attendee, db) {
  const grandLodgeId = attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null;
  
  if (!grandLodgeId) {
    return {
      name: attendee.grand_lodge || attendee.grandLodge || '',
      id: null,
      country: '',
      abbreviation: '',
      stateRegion: '',
      stateRegionCode: ''
    };
  }
  
  try {
    const grandLodge = await db.collection('grandLodges').findOne({
      $or: [
        { grandLodgeId: grandLodgeId },
        { organisationId: grandLodgeId }
      ]
    });
    
    if (grandLodge) {
      return {
        name: grandLodge.name || '',
        id: grandLodge.grandLodgeId || grandLodge.organisationId || null,
        country: grandLodge.country || '',
        abbreviation: grandLodge.abbreviation || '',
        stateRegion: grandLodge.stateRegion || '',
        stateRegionCode: grandLodge.stateRegionCode || ''
      };
    }
  } catch (error) {
    console.warn(`Warning: Could not lookup grand lodge ${grandLodgeId}:`, error.message);
  }
  
  // Fallback to basic data
  return {
    name: attendee.grand_lodge || attendee.grandLodge || '',
    id: grandLodgeId,
    country: '',
    abbreviation: '',
    stateRegion: '',
    stateRegionCode: ''
  };
}

/**
 * Build membership object by looking up lodges collection
 */
async function buildMembershipObject(attendee, db) {
  const lodgeId = attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || null;
  
  if (!lodgeId) {
    return {
      name: attendee.lodge || '',
      number: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
      id: null,
      displayName: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
      district: '',
      meetingPlace: '',
      areaType: ''
    };
  }
  
  try {
    const lodge = await db.collection('lodges').findOne({
      $or: [
        { lodgeId: lodgeId },
        { organisationId: lodgeId }
      ]
    });
    
    if (lodge) {
      const number = lodge.number ? (typeof lodge.number === 'object' ? lodge.number.$numberDecimal : lodge.number.toString()) : '';
      return {
        name: lodge.name || '',
        number: number,
        id: lodge.lodgeId || lodge.organisationId || null,
        displayName: lodge.displayName || `${lodge.name || ''} No. ${number}`.trim(),
        district: lodge.district || '',
        meetingPlace: lodge.meetingPlace || '',
        areaType: lodge.areaType || ''
      };
    }
  } catch (error) {
    console.warn(`Warning: Could not lookup lodge ${lodgeId}:`, error.message);
  }
  
  // Fallback to basic data
  return {
    name: attendee.lodge || '',
    number: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
    id: lodgeId,
    displayName: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
    district: '',
    meetingPlace: '',
    areaType: ''
  };
}

// Run the extraction
extractPrimaryAdditionalAttendees()
  .then(() => console.log('\n✅ Primary/Additional attendee extraction complete'))
  .catch(console.error);