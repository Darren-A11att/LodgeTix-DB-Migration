require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function countAllRegistrationsByType() {
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
    console.log('Counting ALL registrations in the database...\n');
    
    // Get total count
    const totalCount = await db.collection('registrations').countDocuments();
    console.log(`Total registrations in database: ${totalCount}\n`);
    
    // Count by registrationType field
    const typeGroups = await db.collection('registrations').aggregate([
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('By registrationType field:');
    typeGroups.forEach(group => {
      console.log(`  ${group._id || 'null/undefined'}: ${group.count}`);
    });
    
    // Count by confirmation number prefix
    const confirmationPrefixes = await db.collection('registrations').aggregate([
      {
        $match: {
          confirmationNumber: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          prefix: { $substr: ['$confirmationNumber', 0, 3] }
        }
      },
      {
        $group: {
          _id: '$prefix',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\nBy confirmation number prefix:');
    confirmationPrefixes.forEach(group => {
      console.log(`  ${group._id}: ${group.count}`);
    });
    
    // Specific counts for lodge registrations
    console.log('\n=== LODGE REGISTRATIONS ===');
    
    // Method 1: By registrationType = 'lodge'
    const lodgeByType = await db.collection('registrations').countDocuments({
      registrationType: 'lodge'
    });
    console.log(`Registrations with registrationType='lodge': ${lodgeByType}`);
    
    // Method 2: By confirmation number starting with 'LDG-'
    const lodgeByConfirmation = await db.collection('registrations').countDocuments({
      confirmationNumber: { $regex: '^LDG-' }
    });
    console.log(`Registrations with confirmationNumber starting with 'LDG-': ${lodgeByConfirmation}`);
    
    // Method 3: Combined (either condition)
    const lodgeCombined = await db.collection('registrations').countDocuments({
      $or: [
        { registrationType: 'lodge' },
        { confirmationNumber: { $regex: '^LDG-' } }
      ]
    });
    console.log(`Total lodge registrations (either condition): ${lodgeCombined}`);
    
    // Check for individual registrations
    console.log('\n=== INDIVIDUAL REGISTRATIONS ===');
    
    const individualByType = await db.collection('registrations').countDocuments({
      registrationType: 'individual'
    });
    console.log(`Registrations with registrationType='individual': ${individualByType}`);
    
    const individualByConfirmation = await db.collection('registrations').countDocuments({
      confirmationNumber: { $regex: '^IND-' }
    });
    console.log(`Registrations with confirmationNumber starting with 'IND-': ${individualByConfirmation}`);
    
    // Sample some registrations to see patterns
    console.log('\n=== SAMPLE REGISTRATIONS ===');
    const samples = await db.collection('registrations').find({}).limit(10).toArray();
    
    console.log('\nFirst 10 registrations:');
    samples.forEach((reg, idx) => {
      console.log(`${idx + 1}. ${reg.confirmationNumber || 'NO_CONFIRMATION'} - Type: ${reg.registrationType || 'null'} - Org: ${reg.organisationName || reg.lodgeName || 'N/A'}`);
    });
    
    // Check for other patterns
    console.log('\n=== OTHER PATTERNS ===');
    
    // Count registrations with lodge-related fields
    const withLodgeName = await db.collection('registrations').countDocuments({
      lodgeName: { $exists: true, $ne: null }
    });
    console.log(`Registrations with lodgeName field: ${withLodgeName}`);
    
    const withOrganisationName = await db.collection('registrations').countDocuments({
      organisationName: { $exists: true, $ne: null }
    });
    console.log(`Registrations with organisationName field: ${withOrganisationName}`);
    
    const withAttendeeCount = await db.collection('registrations').countDocuments({
      attendeeCount: { $exists: true, $gt: 0 }
    });
    console.log(`Registrations with attendeeCount > 0: ${withAttendeeCount}`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total registrations: ${totalCount}`);
    console.log(`Lodge registrations: ${lodgeCombined}`);
    console.log(`Individual registrations: ${individualByConfirmation}`);
    console.log(`Other/Unknown: ${totalCount - lodgeCombined - individualByConfirmation}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

countAllRegistrationsByType().catch(console.error);