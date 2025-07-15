import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix-reconcile';

async function analyzeMongoTicketStructure() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Get a sample registration with tickets
    const sampleReg = await registrations.findOne({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    if (sampleReg) {
      console.log('Sample registration ID:', sampleReg.registrationId);
      console.log('\nCurrent ticket structure in MongoDB:');
      console.log(JSON.stringify(sampleReg.registrationData.tickets[0], null, 2));
      
      console.log('\nAll fields in first ticket:');
      if (sampleReg.registrationData.tickets[0]) {
        console.log(Object.keys(sampleReg.registrationData.tickets[0]));
      }
    }
    
    // Count registrations with and without tickets
    const totalCount = await registrations.countDocuments();
    const withTickets = await registrations.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    const emptyTickets = await registrations.countDocuments({
      'registrationData.tickets': { $size: 0 }
    });
    const noTicketsField = await registrations.countDocuments({
      'registrationData.tickets': { $exists: false }
    });
    
    console.log('\n=== REGISTRATION COUNTS ===');
    console.log(`Total registrations: ${totalCount}`);
    console.log(`With tickets: ${withTickets}`);
    console.log(`Empty tickets array: ${emptyTickets}`);
    console.log(`No tickets field: ${noTicketsField}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeMongoTicketStructure();