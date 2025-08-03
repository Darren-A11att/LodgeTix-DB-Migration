const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testPaymentRegistrationSync() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('=== TESTING PAYMENT-REGISTRATION SYNC ===\n');
    
    // Test payment ID from your example
    const testPaymentId = "PhTXoxEY7t83xZ0W6Gm6HM44KPeZY";
    
    console.log(`Testing with payment ID: ${testPaymentId}\n`);
    
    // Check if payment exists in payment_imports
    const paymentImport = await db.collection('payment_imports').findOne({
      squarePaymentId: testPaymentId
    });
    
    console.log(`Payment in payment_imports: ${paymentImport ? 'YES' : 'NO'}`);
    if (paymentImport) {
      console.log(`  Import date: ${paymentImport.importedAt}`);
      console.log(`  Amount: $${paymentImport.amount}`);
      console.log(`  Has customer: ${!!paymentImport.customer}`);
      console.log(`  Has order: ${!!paymentImport.order}`);
    }
    
    // Search for registration in Supabase
    console.log(`\nSearching Supabase for registration...`);
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('stripe_payment_intent_id', testPaymentId);
    
    if (error) {
      console.log(`Error searching: ${error.message}`);
    } else {
      console.log(`Registrations found: ${registrations?.length || 0}`);
      
      if (registrations && registrations.length > 0) {
        const reg = registrations[0];
        console.log(`\nRegistration details:`);
        console.log(`  ID: ${reg.id}`);
        console.log(`  Confirmation: ${reg.confirmation_number}`);
        console.log(`  Status: ${reg.status}`);
        console.log(`  Email: ${reg.contact_email}`);
        console.log(`  Created: ${reg.created_at}`);
        
        // Check if in registration_imports
        const regImport = await db.collection('registration_imports').findOne({
          registrationId: reg.id
        });
        
        console.log(`\nRegistration in registration_imports: ${regImport ? 'YES' : 'NO'}`);
        if (regImport) {
          console.log(`  Import date: ${regImport.importedAt}`);
          console.log(`  Matched payment: ${regImport.matchedPaymentId}`);
        }
      }
    }
    
    // Check production collections
    console.log(`\n=== PRODUCTION COLLECTIONS ===`);
    
    const payment = await db.collection('payments').findOne({
      paymentId: testPaymentId
    });
    console.log(`Payment in production: ${payment ? 'YES' : 'NO'}`);
    
    const registration = registrations && registrations.length > 0 
      ? await db.collection('registrations').findOne({ 
          registrationId: registrations[0].id 
        })
      : null;
    console.log(`Registration in production: ${registration ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testPaymentRegistrationSync();