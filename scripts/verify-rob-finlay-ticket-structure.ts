import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function verifyTicketStructure() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Get Rob Finlay's registration
    const robFinlayRegId = 'b55fea0f-3a17-4637-92ef-0a67a6341586';
    const registration = await registrations.findOne({ registrationId: robFinlayRegId });
    
    if (!registration) {
      console.log('Registration not found!');
      return;
    }
    
    console.log('Rob Finlay\'s Registration Tickets:\n');
    console.log(`Total tickets: ${registration.registrationData?.tickets?.length || 0}\n`);
    
    // Expected structure:
    // {
    //   eventTicketId: string,
    //   name: string,
    //   price: number,
    //   quantity: number,
    //   ownerType: string,
    //   ownerId: string
    // }
    
    const expectedFields = ['eventTicketId', 'name', 'price', 'quantity', 'ownerType', 'ownerId'];
    
    registration.registrationData?.tickets?.forEach((ticket: any, index: number) => {
      console.log(`Ticket ${index + 1}:`);
      console.log(JSON.stringify(ticket, null, 2));
      
      // Check if all expected fields are present
      const hasAllFields = expectedFields.every(field => field in ticket);
      const extraFields = Object.keys(ticket).filter(field => !expectedFields.includes(field));
      
      console.log(`\n✓ Has all required fields: ${hasAllFields ? 'YES' : 'NO'}`);
      if (!hasAllFields) {
        const missingFields = expectedFields.filter(field => !(field in ticket));
        console.log(`  Missing fields: ${missingFields.join(', ')}`);
      }
      
      if (extraFields.length > 0) {
        console.log(`  Extra fields: ${extraFields.join(', ')}`);
      }
      
      console.log('---\n');
    });
    
    // Compare with a sample ticket from another registration for consistency
    console.log('\n=== COMPARING WITH ANOTHER REGISTRATION ===\n');
    
    const sampleReg = await registrations.findOne({
      registrationId: { $ne: robFinlayRegId },
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    if (sampleReg?.registrationData?.tickets?.[0]) {
      console.log('Sample ticket from another registration:');
      console.log(JSON.stringify(sampleReg.registrationData.tickets[0], null, 2));
      
      const sampleFields = Object.keys(sampleReg.registrationData.tickets[0]).sort();
      const robFields = registration.registrationData?.tickets?.[0] ? 
        Object.keys(registration.registrationData.tickets[0]).sort() : [];
      
      console.log('\nField comparison:');
      console.log(`Sample registration fields: ${sampleFields.join(', ')}`);
      console.log(`Rob Finlay's fields: ${robFields.join(', ')}`);
      console.log(`Fields match: ${JSON.stringify(sampleFields) === JSON.stringify(robFields) ? 'YES' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

verifyTicketStructure();