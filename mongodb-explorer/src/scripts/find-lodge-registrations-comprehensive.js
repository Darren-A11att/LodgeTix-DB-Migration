require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function findAllPossibleLodgeRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Connected to MongoDB\n');
    console.log('Searching for ALL possible lodge registrations...\n');
    
    // Method 1: By registrationType
    const byRegistrationType = await db.collection('registrations').find({
      registrationType: 'lodge'
    }).toArray();
    console.log(`Method 1 - registrationType='lodge': ${byRegistrationType.length} found`);
    
    // Method 2: By confirmation number pattern
    const byConfirmationPattern = await db.collection('registrations').find({
      confirmationNumber: { $regex: '^LDG-' }
    }).toArray();
    console.log(`Method 2 - confirmationNumber starts with 'LDG-': ${byConfirmationPattern.length} found`);
    
    // Method 3: By organization fields
    const byOrganizationFields = await db.collection('registrations').find({
      $or: [
        { organisationName: { $exists: true, $ne: null, $ne: '' } },
        { lodgeName: { $exists: true, $ne: null, $ne: '' } },
        { organisationId: { $exists: true, $ne: null, $ne: '' } },
        { lodgeId: { $exists: true, $ne: null, $ne: '' } },
        { lodgeNumber: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).toArray();
    console.log(`Method 3 - Has organization/lodge fields: ${byOrganizationFields.length} found`);
    
    // Method 4: By bulk attendee count (typical for lodges)
    const byBulkAttendees = await db.collection('registrations').find({
      attendeeCount: { $gte: 10 },
      registrationType: { $ne: 'individuals' }
    }).toArray();
    console.log(`Method 4 - Bulk attendees (>=10) and not individual: ${byBulkAttendees.length} found`);
    
    // Method 5: No confirmation number but has lodge indicators
    const noConfirmationButLodge = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { confirmationNumber: { $exists: false } },
            { confirmationNumber: null },
            { confirmationNumber: '' }
          ]
        },
        {
          $or: [
            { registrationType: 'lodge' },
            { organisationName: { $exists: true, $ne: null, $ne: '' } },
            { lodgeName: { $exists: true, $ne: null, $ne: '' } }
          ]
        }
      ]
    }).toArray();
    console.log(`Method 5 - No confirmation number but has lodge indicators: ${noConfirmationButLodge.length} found`);
    
    // Method 6: Check metadata and registration data for lodge patterns
    const byMetadataPatterns = await db.collection('registrations').find({
      $or: [
        { 'registrationData.lodgeDetails': { $exists: true } },
        { 'metadata.registrationType': 'lodge' },
        { 'registrationData.registrationType': 'lodge' }
      ]
    }).toArray();
    console.log(`Method 6 - Lodge patterns in metadata/registrationData: ${byMetadataPatterns.length} found`);
    
    // Combine all methods to find unique registrations
    const allIds = new Set();
    const allPossibleLodges = [];
    
    // Helper function to add registration if not already added
    const addIfUnique = (reg) => {
      const id = reg._id.toString();
      if (!allIds.has(id)) {
        allIds.add(id);
        allPossibleLodges.push(reg);
      }
    };
    
    // Add all found registrations
    byRegistrationType.forEach(addIfUnique);
    byConfirmationPattern.forEach(addIfUnique);
    byOrganizationFields.forEach(addIfUnique);
    byBulkAttendees.forEach(addIfUnique);
    noConfirmationButLodge.forEach(addIfUnique);
    byMetadataPatterns.forEach(addIfUnique);
    
    console.log(`\n=== TOTAL UNIQUE POSSIBLE LODGE REGISTRATIONS: ${allPossibleLodges.length} ===\n`);
    
    // Analyze the found registrations
    const analysis = {
      withConfirmation: 0,
      withoutConfirmation: 0,
      withLDGPrefix: 0,
      withOtherPrefix: 0,
      withOrganizationName: 0,
      withAttendeeCount: 0,
      byRegistrationType: {}
    };
    
    console.log('Detailed breakdown:');
    for (let idx = 0; idx < allPossibleLodges.length; idx++) {
      const reg = allPossibleLodges[idx];
      const hasConfirmation = reg.confirmationNumber && reg.confirmationNumber !== '';
      const isLDGPrefix = hasConfirmation && reg.confirmationNumber.startsWith('LDG-');
      const hasOrgName = reg.organisationName || reg.lodgeName;
      
      if (hasConfirmation) {
        analysis.withConfirmation++;
        if (isLDGPrefix) {
          analysis.withLDGPrefix++;
        } else {
          analysis.withOtherPrefix++;
        }
      } else {
        analysis.withoutConfirmation++;
      }
      
      if (hasOrgName) analysis.withOrganizationName++;
      if (reg.attendeeCount > 0) analysis.withAttendeeCount++;
      
      const regType = reg.registrationType || 'null';
      analysis.byRegistrationType[regType] = (analysis.byRegistrationType[regType] || 0) + 1;
      
      // Show details for registrations without standard confirmation
      if (!hasConfirmation || !isLDGPrefix) {
        console.log(`\n${idx + 1}. Registration ID: ${reg._id}`);
        console.log(`   Confirmation: ${reg.confirmationNumber || 'NONE'}`);
        console.log(`   Type: ${reg.registrationType || 'null'}`);
        console.log(`   Organization: ${hasOrgName || 'N/A'}`);
        console.log(`   Attendees: ${reg.attendeeCount || 0}`);
        console.log(`   Created: ${reg.createdAt || reg.registrationDate || 'Unknown'}`);
        
        // Check for payment
        const payment = await db.collection('payments').findOne({
          $or: [
            { matchedRegistrationId: reg._id },
            { registrationId: reg._id }
          ]
        });
        console.log(`   Has Payment: ${payment ? 'Yes' : 'No'}`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total possible lodge registrations: ${allPossibleLodges.length}`);
    console.log(`  With confirmation numbers: ${analysis.withConfirmation}`);
    console.log(`    - LDG- prefix: ${analysis.withLDGPrefix}`);
    console.log(`    - Other prefix: ${analysis.withOtherPrefix}`);
    console.log(`  Without confirmation numbers: ${analysis.withoutConfirmation}`);
    console.log(`  With organization name: ${analysis.withOrganizationName}`);
    console.log(`  With attendee count: ${analysis.withAttendeeCount}`);
    
    console.log('\nBy registration type:');
    Object.entries(analysis.byRegistrationType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Sample some without confirmation numbers
    if (analysis.withoutConfirmation > 0) {
      console.log('\n=== REGISTRATIONS WITHOUT CONFIRMATION NUMBERS ===');
      const noConfirmationSamples = allPossibleLodges
        .filter(reg => !reg.confirmationNumber || reg.confirmationNumber === '')
        .slice(0, 5);
      
      noConfirmationSamples.forEach((reg, idx) => {
        console.log(`\n${idx + 1}. ID: ${reg._id}`);
        console.log(`   Type: ${reg.registrationType}`);
        console.log(`   Org: ${reg.organisationName || reg.lodgeName || 'N/A'}`);
        console.log(`   Attendees: ${reg.attendeeCount || 0}`);
        console.log(`   Status: ${reg.status || reg.paymentStatus || 'Unknown'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findAllPossibleLodgeRegistrations().catch(console.error);