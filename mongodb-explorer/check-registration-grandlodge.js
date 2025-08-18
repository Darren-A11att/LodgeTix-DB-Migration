const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkRegistration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a registration with registrationData
    const registration = await db.collection('registrations').findOne({ 
      "registrationData.grandLodgeId": { $exists: true } 
    });
    
    if (registration) {
      console.log('Registration with grandLodgeId:', {
        registrationId: registration.registrationId,
        grandLodgeId: registration.registrationData?.grandLodgeId,
        registrationDataKeys: Object.keys(registration.registrationData || {})
      });
    } else {
      // Try any registration
      const anyReg = await db.collection('registrations').findOne({});
      console.log('Sample registration structure:', {
        hasRegistrationData: !!anyReg?.registrationData,
        registrationDataKeys: Object.keys(anyReg?.registrationData || {})
      });
    }
    
  } finally {
    await client.close();
  }
}

checkRegistration().catch(console.error);
