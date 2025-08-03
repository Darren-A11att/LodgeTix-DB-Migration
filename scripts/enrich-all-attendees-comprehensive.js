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
    lodgeFields: 0
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

// Enrich contact data (email and phone)
async function enrichContactData(attendee, sourceData) {
  const updates = {};
  
  // Email priority: primaryEmail > email > emailAddress
  if (!attendee.email || attendee.email === '') {
    const email = sourceData.primaryEmail || sourceData.email || sourceData.emailAddress;
    if (email && isValidEmail(email)) {
      updates.email = email.toLowerCase().trim();
      progressTracker.fieldsEnriched.email++;
    }
  }
  
  // Phone priority: primaryPhone > phone > phoneNumber
  if (!attendee.phone || attendee.phone === '') {
    const phone = sourceData.primaryPhone || sourceData.phone || sourceData.phoneNumber;
    if (phone) {
      updates.phone = normalizePhoneNumber(phone);
      progressTracker.fieldsEnriched.phone++;
    }
  }
  
  return updates;
}

// Enrich membership data
async function enrichMembershipData(attendee, sourceData) {
  const updates = {};
  
  // Build membership object
  const membership = {
    GrandLodgeName: sourceData.grand_lodge || sourceData.grandLodge || '',
    GrandLodgeId: sourceData.grand_lodge_id || sourceData.grandLodgeOrganisationId || sourceData.grandLodgeId || null,
    LodgeNameNumber: sourceData.lodgeNameNumber || sourceData.lodge_name_number || '',
    LodgeId: sourceData.lodge_id || sourceData.lodgeOrganisationId || sourceData.lodgeId || null
  };
  
  // Only update if we have meaningful data
  const hasValidData = Object.values(membership).some(v => v !== null && v !== '');
  if (hasValidData && !attendee.membership) {
    updates.membership = membership;
    progressTracker.fieldsEnriched.membership++;
  }
  
  // Also update individual lodge fields if missing
  if (!attendee.lodge_id && membership.LodgeId) {
    updates.lodge_id = membership.LodgeId;
    progressTracker.fieldsEnriched.lodgeFields++;
  }
  if (!attendee.lodgeNameNumber && membership.LodgeNameNumber) {
    updates.lodgeNameNumber = membership.LodgeNameNumber;
    progressTracker.fieldsEnriched.lodgeFields++;
  }
  if (!attendee.grand_lodge_id && membership.GrandLodgeId) {
    updates.grand_lodge_id = membership.GrandLodgeId;
    progressTracker.fieldsEnriched.lodgeFields++;
  }
  
  return updates;
}

// Enrich additional fields
async function enrichAdditionalFields(attendee, sourceData) {
  const updates = {};
  
  if (!attendee.rank && sourceData.rank) {
    updates.rank = sourceData.rank;
    progressTracker.fieldsEnriched.rank++;
  }
  
  if (!attendee.attendeeType && sourceData.attendeeType) {
    updates.attendeeType = sourceData.attendeeType;
    progressTracker.fieldsEnriched.attendeeType++;
  }
  
  // Add other fields as needed
  if (!attendee.title && sourceData.title) {
    updates.title = sourceData.title;
  }
  
  if (!attendee.postNominals && sourceData.postNominals) {
    updates.postNominals = sourceData.postNominals;
  }
  
  if (!attendee.dietaryRequirements && sourceData.dietaryRequirements) {
    updates.dietaryRequirements = sourceData.dietaryRequirements;
  }
  
  if (!attendee.specialNeeds && sourceData.specialNeeds) {
    updates.specialNeeds = sourceData.specialNeeds;
  }
  
  return updates;
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
    
    // Collect all updates
    const updates = {};
    
    // Enrich contact data
    Object.assign(updates, await enrichContactData(attendee, sourceData));
    
    // Enrich membership data
    Object.assign(updates, await enrichMembershipData(attendee, sourceData));
    
    // Enrich additional fields
    Object.assign(updates, await enrichAdditionalFields(attendee, sourceData));
    
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
      description: 'Comprehensive data enrichment from registration sources',
      timestamp: new Date(),
      userId: 'system-enrichment',
      source: 'enrich-all-attendees-comprehensive',
      sourceDataLocation: {
        collection: source,
        attendeeIndex: 0
      },
      enrichmentStats: {
        fieldsEnriched: Object.keys(updates),
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
    return { success: true, updates: Object.keys(updates) };
    
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
async function enrichAllAttendeesComprehensive() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== COMPREHENSIVE ATTENDEE DATA ENRICHMENT ===\n');
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
      missingRank: await attendeesCollection.countDocuments({ 
        $or: [{ rank: '' }, { rank: null }, { rank: { $exists: false } }] 
      }),
      missingAttendeeType: await attendeesCollection.countDocuments({ 
        $or: [{ attendeeType: '' }, { attendeeType: null }, { attendeeType: { $exists: false } }] 
      })
    };
    
    console.log('Current data gaps:');
    console.log(`  - Missing email: ${gapAnalysis.missingEmail}`);
    console.log(`  - Missing phone: ${gapAnalysis.missingPhone}`);
    console.log(`  - Missing membership: ${gapAnalysis.missingMembership}`);
    console.log(`  - Missing rank: ${gapAnalysis.missingRank}`);
    console.log(`  - Missing attendeeType: ${gapAnalysis.missingAttendeeType}\n`);
    
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
    console.log(`  - Rank: ${progressTracker.fieldsEnriched.rank}`);
    console.log(`  - Attendee type: ${progressTracker.fieldsEnriched.attendeeType}`);
    console.log(`  - Lodge fields: ${progressTracker.fieldsEnriched.lodgeFields}\n`);
    
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
      })
    };
    
    console.log(`  - Missing email: ${postGapAnalysis.missingEmail} (improved by ${gapAnalysis.missingEmail - postGapAnalysis.missingEmail})`);
    console.log(`  - Missing phone: ${postGapAnalysis.missingPhone} (improved by ${gapAnalysis.missingPhone - postGapAnalysis.missingPhone})`);
    console.log(`  - Missing membership: ${postGapAnalysis.missingMembership} (improved by ${gapAnalysis.missingMembership - postGapAnalysis.missingMembership})`);
    
    // Show sample enriched attendees
    console.log('\n=== SAMPLE ENRICHED ATTENDEES ===\n');
    const enrichedSamples = await attendeesCollection.find({
      'modificationHistory.source': 'enrich-all-attendees-comprehensive'
    }).limit(3).toArray();
    
    enrichedSamples.forEach((attendee, index) => {
      console.log(`${index + 1}. ${attendee.firstName} ${attendee.lastName}:`);
      console.log(`   Email: ${attendee.email || 'N/A'}`);
      console.log(`   Phone: ${attendee.phone || 'N/A'}`);
      if (attendee.membership) {
        console.log(`   Lodge: ${attendee.membership.LodgeNameNumber || 'N/A'}`);
        console.log(`   Grand Lodge: ${attendee.membership.GrandLodgeName || 'N/A'}`);
      }
      console.log(`   Rank: ${attendee.rank || 'N/A'}`);
      console.log(`   Type: ${attendee.attendeeType || 'N/A'}\n`);
    });
    
  } catch (error) {
    console.error('Error during enrichment:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the enrichment
enrichAllAttendeesComprehensive()
  .then(() => {
    console.log('\n✅ Enrichment process completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Enrichment failed:', error);
    process.exit(1);
  });