const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkAttendeeStructure() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING ATTENDEE STRUCTURE AND LODGE REFERENCES ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Get a more detailed sample
    const attendees = await attendeesCollection.find({}).limit(10).toArray();
    
    console.log(`Found ${attendees.length} attendees to analyze\n`);
    
    attendees.forEach((attendee, index) => {
      console.log(`\nAttendee ${index + 1}:`);
      console.log(`  _id: ${attendee._id}`);
      console.log(`  attendeeId: ${attendee.attendeeId}`);
      console.log(`  Name: ${attendee.firstName} ${attendee.lastName}`);
      console.log(`  Email: ${attendee.email}`);
      console.log(`  Organization: ${attendee.organization}`);
      
      // Check if they have any lodge-related fields
      const lodgeRelatedFields = [];
      Object.keys(attendee).forEach(key => {
        if (key.toLowerCase().includes('lodge') || 
            key.toLowerCase().includes('masonic') || 
            key.toLowerCase().includes('organisation')) {
          lodgeRelatedFields.push(`${key}: ${JSON.stringify(attendee[key])}`);
        }
      });
      
      if (lodgeRelatedFields.length > 0) {
        console.log('  Lodge-related fields:');
        lodgeRelatedFields.forEach(field => console.log(`    ${field}`));
      }
      
      // Check nested objects
      if (attendee.registrations && Array.isArray(attendee.registrations)) {
        console.log(`  Registrations: ${attendee.registrations.length} found`);
        attendee.registrations.forEach((reg, regIndex) => {
          if (reg.lodgeId || reg.lodge || reg.organisationId) {
            console.log(`    Registration ${regIndex + 1} has lodge info:`, {
              lodgeId: reg.lodgeId,
              lodge: reg.lodge,
              organisationId: reg.organisationId
            });
          }
        });
      }
      
      // Show all top-level fields
      console.log(`  All fields: ${Object.keys(attendee).join(', ')}`);
    });
    
    // Check for different potential structures
    console.log('\n\n=== FIELD EXISTENCE ANALYSIS ===');
    
    const fieldChecks = [
      'organization',
      'organisation',
      'lodge',
      'lodgeId',
      'lodge_id',
      'masonic',
      'masonicInfo',
      'masonic_info',
      'registrations.lodgeId',
      'registrations.lodge',
      'registrations.organisationId'
    ];
    
    for (const field of fieldChecks) {
      const query = field.includes('.') 
        ? { [field]: { $exists: true } }
        : { [field]: { $exists: true } };
      
      const count = await attendeesCollection.countDocuments(query);
      console.log(`  Documents with "${field}": ${count}`);
    }
    
    // Check if organization field contains lodge info
    console.log('\n\n=== ORGANIZATION FIELD ANALYSIS ===');
    
    const attendeesWithOrg = await attendeesCollection.find({
      organization: { $exists: true, $ne: null, $ne: '' }
    }).limit(10).toArray();
    
    console.log(`\nSample organization values:`);
    attendeesWithOrg.forEach((att, index) => {
      console.log(`${index + 1}. ${att.firstName} ${att.lastName}: "${att.organization}"`);
    });
    
    // Check if any organization values match lodge names
    const lodgesCollection = db.collection('lodges');
    const lodgeNames = await lodgesCollection.distinct('name');
    const lodgeDisplayNames = await lodgesCollection.distinct('displayName');
    
    console.log(`\n\nChecking if organization values match lodge names...`);
    
    const matchingOrgs = await attendeesCollection.find({
      organization: { $in: [...lodgeNames, ...lodgeDisplayNames] }
    }).limit(5).toArray();
    
    if (matchingOrgs.length > 0) {
      console.log(`\nFound ${matchingOrgs.length} attendees with organization matching a lodge name:`);
      for (const att of matchingOrgs) {
        const lodge = await lodgesCollection.findOne({
          $or: [
            { name: att.organization },
            { displayName: att.organization }
          ]
        });
        console.log(`  ${att.firstName} ${att.lastName}: ${att.organization}`);
        if (lodge) {
          console.log(`    Matches lodge: ${lodge.displayName} (ID: ${lodge.lodgeId})`);
        }
      }
    } else {
      console.log('No direct matches found between organization field and lodge names.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

checkAttendeeStructure().catch(console.error);