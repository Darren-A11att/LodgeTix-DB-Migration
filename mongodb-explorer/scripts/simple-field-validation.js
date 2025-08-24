const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function validateFieldAnalysis() {
  console.log('🔍 FIELD VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('supabase');
  
  // Get sample documents to validate key field structures
  const attendeeSample = await db.collection('attendees').findOne();
  const ticketSample = await db.collection('tickets').findOne();
  
  console.log('\n📋 ATTENDEE SAMPLE STRUCTURE:');
  console.log('Top-level fields:', Object.keys(attendeeSample).join(', '));
  
  if (attendeeSample.attendeeData) {
    console.log('attendeeData nested fields:', Object.keys(attendeeSample.attendeeData).join(', '));
  }
  
  console.log('\n🎫 TICKET SAMPLE STRUCTURE:');
  console.log('Fields:', Object.keys(ticketSample).join(', '));
  
  // Validate critical linking fields
  console.log('\n🔗 RELATIONSHIP VALIDATION:');
  const attendeesWithRegistrationId = await db.collection('attendees').countDocuments({ registrationId: { $exists: true } });
  const ticketsWithRegistrationId = await db.collection('tickets').countDocuments({ registrationId: { $exists: true } });
  const attendeesWithAttendeeId = await db.collection('attendees').countDocuments({ attendeeId: { $exists: true } });
  const ticketsWithAttendeeId = await db.collection('tickets').countDocuments({ attendeeId: { $exists: true } });
  
  console.log(`✓ Attendees with registrationId: ${attendeesWithRegistrationId}`);
  console.log(`✓ Tickets with registrationId: ${ticketsWithRegistrationId}`);
  console.log(`✓ Attendees with attendeeId: ${attendeesWithAttendeeId}`);
  console.log(`✓ Tickets with attendeeId: ${ticketsWithAttendeeId}`);
  
  // Check for critical data integrity
  console.log('\n📊 DATA INTEGRITY CHECK:');
  const attendeesWithEmail = await db.collection('attendees').countDocuments({ 
    $or: [{ email: { $exists: true } }, { primaryEmail: { $exists: true } }, { 'attendeeData.primaryEmail': { $exists: true } }] 
  });
  const attendeesWithName = await db.collection('attendees').countDocuments({ 
    $or: [{ firstName: { $exists: true } }, { 'attendeeData.firstName': { $exists: true } }] 
  });
  const ticketsWithPrice = await db.collection('tickets').countDocuments({ 
    $or: [{ pricePaid: { $exists: true } }, { originalPrice: { $exists: true } }, { ticketPrice: { $exists: true } }] 
  });
  
  console.log(`✓ Attendees with email addresses: ${attendeesWithEmail}`);
  console.log(`✓ Attendees with names: ${attendeesWithName}`);
  console.log(`✓ Tickets with pricing: ${ticketsWithPrice}`);
  
  console.log('\n✅ FIELD ANALYSIS COMPLETE');
  console.log('Reports saved to: field-analysis-reports/');
  
  await client.close();
}

validateFieldAnalysis().catch(console.error);