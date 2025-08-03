const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Progress tracker
const progressTracker = {
  total: 0,
  processed: 0,
  enriched: 0,
  errors: 0,
  skipped: 0,
  dataSourceBreakdown: {
    registration_imports: 0,
    registrations: 0,
    not_found: 0
  },
  fieldsEnriched: {
    email: 0,
    phone: 0,
    membership: 0,
    rank: 0,
    attendeeType: 0,
    lodgeFields: 0,
    contactPreference: 0,
    relationship: 0,
    partner: 0,
    suffix: 0,
    grandOfficerStatus: 0,
    otherFields: 0
  }
};

// Helper functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email && emailRegex.test(email);
}

function normalizePhoneNumber(phone) {
  // Australian phone number normalization
  return phone ? phone.replace(/\s+/g, ' ').trim() : '';
}

// Enrich ALL fields from source data
async function enrichAllFields(attendee, sourceData) {
  const updates = {};
  let fieldsUpdated = 0;
  
  // Define all fields to check and enrich
  const fieldsToEnrich = [
    // Contact fields
    { target: 'email', sources: ['primaryEmail', 'email', 'emailAddress'], validator: isValidEmail, transform: v => v.toLowerCase().trim() },
    { target: 'phone', sources: ['primaryPhone', 'phone', 'phoneNumber'], transform: normalizePhoneNumber },
    
    // Title and name fields
    { target: 'title', sources: ['title'] },
    { target: 'suffix', sources: ['suffix'] },
    { target: 'postNominals', sources: ['postNominals'] },
    
    // Type and status fields
    { target: 'attendeeType', sources: ['attendeeType', 'type'], defaultValue: 'guest' },
    { target: 'isPrimary', sources: ['isPrimary'], type: 'boolean' },
    { target: 'isCheckedIn', sources: ['isCheckedIn'], type: 'boolean' },
    { target: 'firstTime', sources: ['firstTime'], type: 'boolean' },
    
    // Partner/relationship fields
    { target: 'partner', sources: ['partner'] },
    { target: 'partnerOf', sources: ['partnerOf'] },
    { target: 'isPartner', sources: ['isPartner'] },
    { target: 'relationship', sources: ['relationship'] },
    { target: 'guestOfId', sources: ['guestOfId'] },
    
    // Contact preferences
    { target: 'contactPreference', sources: ['contactPreference'], defaultValue: 'directly' },
    { target: 'contactConfirmed', sources: ['contactConfirmed'], type: 'boolean' },
    
    // Dietary and special needs
    { target: 'dietaryRequirements', sources: ['dietaryRequirements', 'dietary'] },
    { target: 'specialNeeds', sources: ['specialNeeds', 'accessibility'] },
    { target: 'notes', sources: ['notes'] },
    
    // Lodge/organization fields
    { target: 'rank', sources: ['rank'] },
    { target: 'lodge', sources: ['lodge'] },
    { target: 'lodge_id', sources: ['lodge_id', 'lodgeId', 'lodgeOrganisationId'] },
    { target: 'lodgeNameNumber', sources: ['lodgeNameNumber', 'lodge_name_number'] },
    { target: 'grand_lodge', sources: ['grand_lodge', 'grandLodge'] },
    { target: 'grand_lodge_id', sources: ['grand_lodge_id', 'grandLodgeOrganisationId', 'grandLodgeId'] },
    { target: 'grandOfficerStatus', sources: ['grandOfficerStatus'] },
    { target: 'useSameLodge', sources: ['useSameLodge'], type: 'boolean' },
    
    // Payment and table info
    { target: 'paymentStatus', sources: ['paymentStatus'], defaultValue: 'pending' },
    { target: 'tableAssignment', sources: ['tableAssignment'] }
  ];
  
  // Process each field
  for (const fieldDef of fieldsToEnrich) {
    // Check if attendee already has this field with a value
    const currentValue = attendee[fieldDef.target];
    const hasValue = currentValue !== null && currentValue !== undefined && currentValue !== '';
    
    if (!hasValue || fieldDef.type === 'boolean') {
      // Try to find value from source data
      let newValue = null;
      
      for (const sourceField of fieldDef.sources) {
        if (sourceData[sourceField] !== undefined && sourceData[sourceField] !== null && sourceData[sourceField] !== '') {
          newValue = sourceData[sourceField];
          break;
        }
      }
      
      // Apply default value if specified and no value found
      if (newValue === null && fieldDef.defaultValue !== undefined) {
        newValue = fieldDef.defaultValue;
      }
      
      // Apply transform if specified
      if (newValue !== null && fieldDef.transform) {
        newValue = fieldDef.transform(newValue);
      }
      
      // Apply validator if specified
      if (newValue !== null && fieldDef.validator && !fieldDef.validator(newValue)) {
        continue; // Skip invalid values
      }
      
      // Handle boolean type
      if (fieldDef.type === 'boolean' && newValue !== null) {
        newValue = Boolean(newValue);
      }
      
      // Update if we have a new value
      if (newValue !== null && newValue !== currentValue) {
        updates[fieldDef.target] = newValue;
        fieldsUpdated++;
        
        // Track specific field enrichments
        if (fieldDef.target === 'email') progressTracker.fieldsEnriched.email++;
        else if (fieldDef.target === 'phone') progressTracker.fieldsEnriched.phone++;
        else if (fieldDef.target === 'rank') progressTracker.fieldsEnriched.rank++;
        else if (fieldDef.target === 'attendeeType') progressTracker.fieldsEnriched.attendeeType++;
        else if (fieldDef.target === 'contactPreference') progressTracker.fieldsEnriched.contactPreference++;
        else if (fieldDef.target === 'relationship') progressTracker.fieldsEnriched.relationship++;
        else if (fieldDef.target === 'partner' || fieldDef.target === 'partnerOf') progressTracker.fieldsEnriched.partner++;
        else if (fieldDef.target === 'suffix') progressTracker.fieldsEnriched.suffix++;
        else if (fieldDef.target === 'grandOfficerStatus') progressTracker.fieldsEnriched.grandOfficerStatus++;
        else if (fieldDef.target.includes('lodge')) progressTracker.fieldsEnriched.lodgeFields++;
        else progressTracker.fieldsEnriched.otherFields++;
      }
    }
  }
  
  // Build/update membership object
  const membership = {
    GrandLodgeName: sourceData.grand_lodge || sourceData.grandLodge || attendee.grand_lodge || '',
    GrandLodgeId: sourceData.grand_lodge_id || sourceData.grandLodgeOrganisationId || sourceData.grandLodgeId || attendee.grand_lodge_id || null,
    LodgeNameNumber: sourceData.lodgeNameNumber || sourceData.lodge_name_number || attendee.lodgeNameNumber || '',
    LodgeId: sourceData.lodge_id || sourceData.lodgeOrganisationId || sourceData.lodgeId || attendee.lodge_id || null
  };
  
  // Only update membership if we have meaningful data and it's different
  const hasValidMembershipData = Object.values(membership).some(v => v !== null && v !== '');
  if (hasValidMembershipData && (!attendee.membership || JSON.stringify(attendee.membership) !== JSON.stringify(membership))) {
    updates.membership = membership;
    progressTracker.fieldsEnriched.membership++;
    fieldsUpdated++;
  }
  
  return { updates, fieldsUpdated };
}

// Find source data for an attendee
async function findSourceData(attendee, db) {
  // Strategy 1: Find by attendeeId in registration_imports
  const registrationInfo = attendee.registrations && attendee.registrations[0];
  if (!registrationInfo) {
    return { data: null, source: null };
  }
  
  // First try registration_imports (original data)
  const registrationImport = await db.collection('registration_imports').findOne({
    registrationId: registrationInfo.registrationId
  });
  
  if (registrationImport) {
    const attendees = registrationImport.registrationData?.attendees || registrationImport.attendees || [];
    const sourceAttendee = attendees.find(a => 
      a.attendeeId === attendee.attendeeId ||
      a.id === attendee.attendeeId ||
      (a.firstName === attendee.firstName && a.lastName === attendee.lastName)
    );
    
    if (sourceAttendee) {
      return { data: sourceAttendee, source: 'registration_imports' };
    }
  }
  
  // Try registrations collection as fallback
  const registration = await db.collection('registrations').findOne({
    registrationId: registrationInfo.registrationId
  });
  
  if (registration) {
    const regData = registration.registrationData || registration;
    if (regData.originalAttendees) {
      const sourceAttendee = regData.originalAttendees.find(a => 
        a.attendeeId === attendee.attendeeId ||
        a.id === attendee.attendeeId ||
        (a.firstName === attendee.firstName && a.lastName === attendee.lastName)
      );
      
      if (sourceAttendee) {
        return { data: sourceAttendee, source: 'registrations' };
      }
    }
  }
  
  return { data: null, source: null };
}

// Enrich a single attendee
async function enrichSingleAttendee(attendee, db) {
  try {
    // Find source data
    const { data: sourceData, source } = await findSourceData(attendee, db);
    
    if (!sourceData) {
      progressTracker.dataSourceBreakdown.not_found++;
      return { success: false, reason: 'Source data not found' };
    }
    
    progressTracker.dataSourceBreakdown[source]++;
    
    // Enrich all fields
    const { updates, fieldsUpdated } = await enrichAllFields(attendee, sourceData);
    
    // If no updates needed, skip
    if (Object.keys(updates).length === 0) {
      progressTracker.skipped++;
      return { success: false, reason: 'No updates needed' };
    }
    
    // Create modification history entry
    const modificationEntry = {
      id: new ObjectId(),
      type: 'enrichment',
      changes: [],
      description: 'Complete data enrichment from registration sources - ALL fields',
      timestamp: new Date(),
      userId: 'system-enrichment-complete',
      source: 'enrich-all-attendees-complete',
      sourceDataLocation: {
        collection: source,
        attendeeIndex: 0
      },
      enrichmentStats: {
        fieldsEnriched: Object.keys(updates),
        fieldsUpdatedCount: fieldsUpdated,
        matchingStrategy: 'attendeeId',
        confidence: 'high'
      }
    };
    
    // Record changes
    for (const [field, value] of Object.entries(updates)) {
      modificationEntry.changes.push({
        field: field,
        from: attendee[field] || null,
        to: value
      });
    }
    
    // Update the attendee
    await db.collection('attendees').updateOne(
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
    
    progressTracker.enriched++;
    return { success: true, updates: Object.keys(updates), fieldsUpdated };
    
  } catch (error) {
    progressTracker.errors++;
    return { success: false, reason: error.message };
  }
}

// Process a batch of attendees
async function processBatch(attendeeBatch, db) {
  const results = await Promise.allSettled(
    attendeeBatch.map(attendee => enrichSingleAttendee(attendee, db))
  );
  
  return results;
}

// Main enrichment function
async function enrichAllAttendeesComplete() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== COMPLETE ATTENDEE DATA ENRICHMENT (ALL FIELDS) ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const attendeesCollection = db.collection('attendees');
    
    // Get total count
    progressTracker.total = await attendeesCollection.countDocuments();
    console.log(`Total attendees to process: ${progressTracker.total}\n`);
    
    // Analyze current data gaps
    console.log('Analyzing current data gaps...');
    const gapAnalysis = {
      missingEmail: await attendeesCollection.countDocuments({ 
        $or: [{ email: '' }, { email: null }, { email: { $exists: false } }] 
      }),
      missingPhone: await attendeesCollection.countDocuments({ 
        $or: [{ phone: '' }, { phone: null }, { phone: { $exists: false } }] 
      }),
      missingMembership: await attendeesCollection.countDocuments({ 
        $or: [{ membership: { $exists: false } }, { membership: null }] 
      }),
      missingContactPreference: await attendeesCollection.countDocuments({ 
        $or: [{ contactPreference: { $exists: false } }, { contactPreference: null }] 
      }),
      missingRelationship: await attendeesCollection.countDocuments({ 
        $or: [{ relationship: { $exists: false } }, { relationship: null }, { relationship: '' }],
        attendeeType: 'guest'
      }),
      missingPartnerLink: await attendeesCollection.countDocuments({ 
        $or: [
          { partner: { $exists: false } },
          { partnerOf: { $exists: false } }
        ]
      })
    };
    
    console.log('Current data gaps:');
    console.log(`  - Missing email: ${gapAnalysis.missingEmail}`);
    console.log(`  - Missing phone: ${gapAnalysis.missingPhone}`);
    console.log(`  - Missing membership: ${gapAnalysis.missingMembership}`);
    console.log(`  - Missing contactPreference: ${gapAnalysis.missingContactPreference}`);
    console.log(`  - Missing relationship (guests): ${gapAnalysis.missingRelationship}`);
    console.log(`  - Missing partner links: ${gapAnalysis.missingPartnerLink}\n`);
    
    // Process attendees in batches
    const batchSize = 100;
    let processed = 0;
    
    console.log('Starting enrichment process...\n');
    
    const cursor = attendeesCollection.find({});
    
    while (await cursor.hasNext()) {
      const batch = [];
      
      // Collect batch
      for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }
      
      if (batch.length === 0) break;
      
      // Process batch
      await processBatch(batch, db);
      
      processed += batch.length;
      progressTracker.processed = processed;
      
      // Progress update every 500 attendees
      if (processed % 500 === 0 || processed === progressTracker.total) {
        const percentComplete = ((processed / progressTracker.total) * 100).toFixed(1);
        console.log(`Progress: ${processed}/${progressTracker.total} (${percentComplete}%)`);
        console.log(`  - Enriched: ${progressTracker.enriched}`);
        console.log(`  - Skipped: ${progressTracker.skipped}`);
        console.log(`  - Errors: ${progressTracker.errors}`);
      }
    }
    
    await cursor.close();
    
    // Final report
    console.log('\n=== ENRICHMENT COMPLETE ===\n');
    
    console.log('Summary:');
    console.log(`  - Total attendees: ${progressTracker.total}`);
    console.log(`  - Successfully enriched: ${progressTracker.enriched}`);
    console.log(`  - Skipped (no updates needed): ${progressTracker.skipped}`);
    console.log(`  - Errors: ${progressTracker.errors}`);
    console.log(`  - Success rate: ${((progressTracker.enriched / progressTracker.total) * 100).toFixed(2)}%\n`);
    
    console.log('Data sources used:');
    console.log(`  - registration_imports: ${progressTracker.dataSourceBreakdown.registration_imports}`);
    console.log(`  - registrations: ${progressTracker.dataSourceBreakdown.registrations}`);
    console.log(`  - Not found: ${progressTracker.dataSourceBreakdown.not_found}\n`);
    
    console.log('Fields enriched:');
    console.log(`  - Email addresses: ${progressTracker.fieldsEnriched.email}`);
    console.log(`  - Phone numbers: ${progressTracker.fieldsEnriched.phone}`);
    console.log(`  - Membership data: ${progressTracker.fieldsEnriched.membership}`);
    console.log(`  - Contact preferences: ${progressTracker.fieldsEnriched.contactPreference}`);
    console.log(`  - Relationships: ${progressTracker.fieldsEnriched.relationship}`);
    console.log(`  - Partner links: ${progressTracker.fieldsEnriched.partner}`);
    console.log(`  - Rank: ${progressTracker.fieldsEnriched.rank}`);
    console.log(`  - Attendee type: ${progressTracker.fieldsEnriched.attendeeType}`);
    console.log(`  - Lodge fields: ${progressTracker.fieldsEnriched.lodgeFields}`);
    console.log(`  - Suffix: ${progressTracker.fieldsEnriched.suffix}`);
    console.log(`  - Grand Officer Status: ${progressTracker.fieldsEnriched.grandOfficerStatus}`);
    console.log(`  - Other fields: ${progressTracker.fieldsEnriched.otherFields}\n`);
    
    // Post-enrichment gap analysis
    console.log('Post-enrichment data gaps:');
    const postGapAnalysis = {
      missingEmail: await attendeesCollection.countDocuments({ 
        $or: [{ email: '' }, { email: null }, { email: { $exists: false } }] 
      }),
      missingPhone: await attendeesCollection.countDocuments({ 
        $or: [{ phone: '' }, { phone: null }, { phone: { $exists: false } }] 
      }),
      missingMembership: await attendeesCollection.countDocuments({ 
        $or: [{ membership: { $exists: false } }, { membership: null }] 
      }),
      missingContactPreference: await attendeesCollection.countDocuments({ 
        $or: [{ contactPreference: { $exists: false } }, { contactPreference: null }] 
      })
    };
    
    console.log(`  - Missing email: ${postGapAnalysis.missingEmail} (improved by ${gapAnalysis.missingEmail - postGapAnalysis.missingEmail})`);
    console.log(`  - Missing phone: ${postGapAnalysis.missingPhone} (improved by ${gapAnalysis.missingPhone - postGapAnalysis.missingPhone})`);
    console.log(`  - Missing membership: ${postGapAnalysis.missingMembership} (improved by ${gapAnalysis.missingMembership - postGapAnalysis.missingMembership})`);
    console.log(`  - Missing contactPreference: ${postGapAnalysis.missingContactPreference} (improved by ${gapAnalysis.missingContactPreference - postGapAnalysis.missingContactPreference})`);
    
    // Show sample enriched attendees
    console.log('\n=== SAMPLE ENRICHED ATTENDEES ===\n');
    const enrichedSamples = await attendeesCollection.find({
      'modificationHistory.source': 'enrich-all-attendees-complete'
    }).limit(5).toArray();
    
    enrichedSamples.forEach((attendee, index) => {
      console.log(`${index + 1}. ${attendee.firstName} ${attendee.lastName}:`);
      console.log(`   Email: ${attendee.email || 'N/A'}`);
      console.log(`   Phone: ${attendee.phone || 'N/A'}`);
      console.log(`   Contact Preference: ${attendee.contactPreference || 'N/A'}`);
      console.log(`   Type: ${attendee.attendeeType || 'N/A'}`);
      console.log(`   Relationship: ${attendee.relationship || 'N/A'}`);
      if (attendee.partner) console.log(`   Partner: ${attendee.partner}`);
      if (attendee.partnerOf) console.log(`   Partner Of: ${attendee.partnerOf}`);
      if (attendee.membership) {
        console.log(`   Lodge: ${attendee.membership.LodgeNameNumber || 'N/A'}`);
        console.log(`   Grand Lodge: ${attendee.membership.GrandLodgeName || 'N/A'}`);
      }
      console.log(`   Rank: ${attendee.rank || 'N/A'}`);
      if (attendee.grandOfficerStatus) console.log(`   Grand Officer Status: ${attendee.grandOfficerStatus}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error during enrichment:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the enrichment
enrichAllAttendeesComplete()
  .then(() => {
    console.log('\n✅ Complete enrichment process finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Enrichment failed:', error);
    process.exit(1);
  });