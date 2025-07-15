import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function findRegistrationWithoutTickets() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Find registrations with no tickets or empty tickets array
    const noTickets = await registrations.find({
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': { $size: 0 } },
        { 'registrationData.tickets': null }
      ]
    }).toArray();
    
    console.log(`Found ${noTickets.length} registration(s) without tickets:\n`);
    
    noTickets.forEach(reg => {
      console.log(`Registration ID: ${reg.registrationId}`);
      console.log(`Type: ${reg.registrationType || 'N/A'}`);
      console.log(`Status: ${reg.status || 'N/A'}`);
      console.log(`Created: ${reg.createdAt}`);
      console.log(`Customer ID: ${reg.customerId || 'N/A'}`);
      console.log(`Primary Attendee: ${reg.primaryAttendee || 'N/A'}`);
      
      if (reg.registrationData?.bookingContact) {
        const bc = reg.registrationData.bookingContact;
        console.log(`Booking Contact: ${bc.firstName || ''} ${bc.lastName || ''} (${bc.email || 'N/A'})`);
      }
      
      console.log(`Tickets field exists: ${reg.registrationData?.tickets !== undefined}`);
      console.log(`Tickets value: ${JSON.stringify(reg.registrationData?.tickets)}`);
      
      // Check if this was from our recent import
      if (reg.importSource) {
        console.log(`Import Source: ${reg.importSource}`);
        console.log(`Imported At: ${reg.importedAt}`);
      }
      
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

findRegistrationWithoutTickets();