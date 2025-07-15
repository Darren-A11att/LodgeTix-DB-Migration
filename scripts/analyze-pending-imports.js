const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function analyzePendingImports() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  const pendingImports = await db.collection('registration_imports').find({}).toArray();
  
  console.log('=== ANALYSIS OF PENDING IMPORTS ===\n');
  console.log('Total pending:', pendingImports.length);
  
  // Analyze characteristics
  const hasEmail = pendingImports.filter(r => r.registrationData?.attendees?.[0]?.email).length;
  const hasTickets = pendingImports.filter(r => 
    (r.registrationData?.tickets?.length > 0) || 
    (r.registrationData?.selectedTickets?.length > 0)
  ).length;
  const hasAmount = pendingImports.filter(r => r.totalAmountPaid > 0).length;
  
  console.log('\nCharacteristics:');
  console.log('- Have email addresses:', hasEmail);
  console.log('- Have tickets:', hasTickets);
  console.log('- Have totalAmountPaid > 0:', hasAmount);
  
  console.log('\nDetailed breakdown:');
  pendingImports.forEach((r, i) => {
    const attendee = r.registrationData?.attendees?.[0];
    const tickets = r.registrationData?.tickets || r.registrationData?.selectedTickets || [];
    
    console.log(`\n${i+1}. Registration ${r.registrationId}`);
    console.log('   Created:', new Date(r.createdAt).toLocaleDateString());
    console.log('   Type:', r.registrationType);
    console.log('   Email:', attendee?.email || 'None');
    console.log('   Name:', attendee ? `${attendee.firstName} ${attendee.lastName}` : 'None');
    console.log('   Tickets:', tickets.length);
    console.log('   Total Amount:', r.totalAmountPaid);
    console.log('   Payment IDs:', {
      square: r.squarePaymentId || 'None',
      stripe: r.stripePaymentIntentId || 'None'
    });
  });
  
  console.log('\n=== RECOMMENDATION ===');
  if (hasAmount === 0 && hasEmail > 0) {
    console.log('These appear to be abandoned registrations (started but never paid).');
    console.log('They should probably be moved to a separate collection or deleted.');
  } else {
    console.log('Review each registration individually to determine appropriate action.');
  }
  
  await client.close();
}

analyzePendingImports().catch(console.error);