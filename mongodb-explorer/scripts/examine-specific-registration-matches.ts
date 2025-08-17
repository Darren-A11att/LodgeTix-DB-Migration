import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI_MIGTEST = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

// Top match IDs from the search
const topMatchIds = [
  '687f7fe26b5f78e083fed4ff', // Multiple matches for date proximity
  '6886bd91bc34c2425617c25e', // Has email, appears in both searches
  '687ecbbe4aeeec50c63075dc', // Good date match for Troy's order
];

async function examineSpecificMatches() {
  const client = new MongoClient(MONGODB_URI_MIGTEST);
  
  try {
    await client.connect();
    console.log('Connected to LodgeTix migration test database\n');
    
    const db = client.db('LodgeTix-migration-test-1');
    const collection = db.collection('registrations');
    
    console.log('=== DETAILED EXAMINATION OF TOP REGISTRATION MATCHES ===\n');
    
    for (const matchId of topMatchIds) {
      try {
        const registration = await collection.findOne({ _id: new ObjectId(matchId) });
        
        if (!registration) {
          console.log(`❌ Registration ${matchId} not found`);
          continue;
        }
      
      console.log(`📋 Registration ID: ${matchId}`);
      console.log('────────────────────────────────────────────────────────');
      
      // Basic information
      console.log('BASIC INFO:');
      console.log(`  First Name: ${registration.firstName || 'Not provided'}`);
      console.log(`  Last Name: ${registration.lastName || 'Not provided'}`);
      console.log(`  Full Name: ${registration.fullName || 'Not provided'}`);
      console.log(`  Email: ${registration.contactEmail || registration.email || 'Not provided'}`);
      console.log(`  Phone: ${registration.phone || registration.contactPhone || 'Not provided'}`);
      
      // Financial details
      console.log('\nFINANCIAL DETAILS:');
      console.log(`  Total Amount: $${registration.totalAmount || 0} ${registration.currency || 'AUD'}`);
      console.log(`  Payment Status: ${registration.paymentStatus || 'Not specified'}`);
      console.log(`  Payment Method: ${registration.paymentMethod || 'Not specified'}`);
      
      // Registration details
      console.log('\nREGISTRATION DETAILS:');
      console.log(`  Registration Type: ${registration.registrationType || 'Not specified'}`);
      console.log(`  Attendee Count: ${registration.attendeeCount || 'Not specified'}`);
      console.log(`  Event: ${registration.eventName || registration.event || 'Not specified'}`);
      
      // Dates
      console.log('\nDATE INFORMATION:');
      console.log(`  Created At: ${registration.createdAt || 'Not specified'}`);
      console.log(`  Updated At: ${registration.updatedAt || 'Not specified'}`);
      console.log(`  Event Date: ${registration.eventDate || 'Not specified'}`);
      
      // Additional context
      console.log('\nADDITIONAL CONTEXT:');
      if (registration.notes) {
        console.log(`  Notes: ${registration.notes}`);
      }
      if (registration.source) {
        console.log(`  Source: ${registration.source}`);
      }
      if (registration.referenceId) {
        console.log(`  Reference ID: ${registration.referenceId}`);
      }
      
      // Payment/transaction references
      if (registration.stripePaymentIntentId) {
        console.log(`  Stripe Payment Intent: ${registration.stripePaymentIntentId}`);
      }
      if (registration.squarePaymentId) {
        console.log(`  Square Payment ID: ${registration.squarePaymentId}`);
      }
      
      // Show all available fields for debugging
      console.log('\nAVAILABLE FIELDS:');
      console.log(`  ${Object.keys(registration).join(', ')}`);
      
        console.log('\n' + '='.repeat(80) + '\n');
        
      } catch (error) {
        console.log(`❌ Error processing registration ${matchId}: ${error}`);
      }
    }
    
    // Now let's also look for registrations with specific email addresses
    console.log('🔍 SEARCHING BY EMAIL ADDRESSES FROM ERROR PAYMENTS:\n');
    
    const errorPaymentEmails = [
      'whitie62@gmail.com',
      'troyquimpo@yahoo.com', 
      'anthonycosoleto1990@gmail.com'
    ];
    
    for (const email of errorPaymentEmails) {
      console.log(`Searching for: ${email}`);
      
      const emailMatches = await collection.find({
        $or: [
          { contactEmail: { $regex: email, $options: 'i' } },
          { email: { $regex: email, $options: 'i' } }
        ]
      }).toArray();
      
      if (emailMatches.length > 0) {
        console.log(`✅ Found ${emailMatches.length} match(es):`);
        
        emailMatches.forEach((match, idx) => {
          console.log(`  ${idx + 1}. ID: ${match._id}`);
          console.log(`     Name: ${match.firstName || ''} ${match.lastName || ''}`);
          console.log(`     Email: ${match.contactEmail || match.email}`);
          console.log(`     Amount: $${match.totalAmount || 0}`);
          console.log(`     Type: ${match.registrationType}`);
          console.log(`     Count: ${match.attendeeCount}`);
          console.log(`     Date: ${match.createdAt}`);
        });
      } else {
        console.log(`❌ No matches found`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

examineSpecificMatches();