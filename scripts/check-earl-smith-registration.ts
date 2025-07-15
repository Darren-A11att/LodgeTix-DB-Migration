import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function checkEarlSmithRegistration() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Earl Smith's registration ID from the corrupted document
    const earlSmithRegId = '8cd577e4-1039-4d72-bce7-2eb58f64c489';
    
    console.log(`Searching for registration ID: ${earlSmithRegId}\n`);
    
    // 1. Check if it exists as registrationId
    const regById = await registrations.findOne({
      registrationId: earlSmithRegId
    });
    
    if (regById) {
      console.log('✅ Found registration with this ID:\n');
      console.log(`Registration ID: ${regById.registrationId}`);
      console.log(`Primary Attendee: ${regById.primaryAttendee}`);
      console.log(`Status: ${regById.status}`);
      console.log(`Created: ${regById.createdAt}`);
      console.log(`Confirmation: ${regById.confirmationNumber}`);
      console.log(`Total Amount: $${regById.totalAmountPaid}`);
      console.log(`Tickets: ${regById.registrationData?.tickets?.length || 0}`);
      
      if (regById.registrationData?.bookingContact) {
        const bc = regById.registrationData.bookingContact;
        console.log(`Booking Contact: ${bc.firstName} ${bc.lastName} (${bc.email})`);
      }
    } else {
      console.log('❌ No registration found with this registrationId');
    }
    
    // 2. Search for any registration with Earl Smith as primary attendee
    console.log('\n\nSearching for Earl Smith registrations...\n');
    
    const earlSmithRegs = await registrations.find({
      $or: [
        { primaryAttendee: { $regex: 'Earl Smith', $options: 'i' } },
        { 'registrationData.bookingContact.firstName': 'Earl' },
        { 'registrationData.bookingContact.email': 'sisigandbeer@gmail.com' }
      ]
    }).toArray();
    
    console.log(`Found ${earlSmithRegs.length} registration(s) related to Earl Smith:\n`);
    
    earlSmithRegs.forEach((reg, index) => {
      console.log(`${index + 1}. Registration:`);
      console.log(`   ID: ${reg.registrationId}`);
      console.log(`   Primary Attendee: ${reg.primaryAttendee}`);
      console.log(`   Booking Email: ${reg.registrationData?.bookingContact?.email}`);
      console.log(`   Confirmation: ${reg.confirmationNumber}`);
      console.log(`   Created: ${reg.createdAt}`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Total: $${reg.totalAmountPaid}`);
      console.log(`   ---`);
    });
    
    // 3. Check for the specific Square payment ID
    console.log('\n\nChecking Square payment ID: PbKYW5dTefMFveaPc7t8lCa8LnYZY\n');
    
    const squarePaymentReg = await registrations.findOne({
      $or: [
        { squarePaymentId: 'PbKYW5dTefMFveaPc7t8lCa8LnYZY' },
        { square_payment_id: 'PbKYW5dTefMFveaPc7t8lCa8LnYZY' },
        { 'registrationData.square_payment_id': 'PbKYW5dTefMFveaPc7t8lCa8LnYZY' }
      ]
    });
    
    if (squarePaymentReg) {
      console.log('✅ Found registration with Earl\'s Square payment ID:');
      console.log(`   Registration ID: ${squarePaymentReg.registrationId}`);
      console.log(`   Primary Attendee: ${squarePaymentReg.primaryAttendee}`);
    } else {
      console.log('❌ No other registration found with Earl\'s Square payment ID');
    }
    
    // 4. Check for confirmation number
    console.log('\n\nChecking confirmation number: IND-541361JS\n');
    
    const confirmationReg = await registrations.findOne({
      confirmationNumber: 'IND-541361JS'
    });
    
    if (confirmationReg) {
      console.log('✅ Found registration with confirmation IND-541361JS:');
      console.log(`   Registration ID: ${confirmationReg.registrationId}`);
      console.log(`   Primary Attendee: ${confirmationReg.primaryAttendee}`);
    } else {
      console.log('❌ No other registration found with confirmation IND-541361JS');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

checkEarlSmithRegistration();