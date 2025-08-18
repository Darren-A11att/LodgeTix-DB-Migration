const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkRegistrationDate() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a sample registration
    const registration = await db.collection('registrations').findOne({});
    if (registration) {
      console.log('Registration date fields:', {
        createdAt: registration.createdAt,
        createdDate: registration.createdDate,
        registrationDate: registration.registrationDate,
        _createdAt: registration._createdAt,
        hasCreatedAt: !!registration.createdAt,
        hasCreatedDate: !!registration.createdDate,
        hasRegistrationDate: !!registration.registrationDate
      });
    }
    
  } finally {
    await client.close();
  }
}

checkRegistrationDate().catch(console.error);
