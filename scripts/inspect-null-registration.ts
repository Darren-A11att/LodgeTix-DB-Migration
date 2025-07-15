import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function inspectNullRegistration() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Find the registration with null registrationId
    const nullReg = await registrations.findOne({
      registrationId: null
    });
    
    if (!nullReg) {
      console.log('No registration found with null registrationId');
      return;
    }
    
    console.log('=== FULL REGISTRATION DATA ===\n');
    
    // Display all top-level fields
    console.log('Top-level fields:');
    Object.entries(nullReg).forEach(([key, value]) => {
      if (key === 'registrationData') {
        console.log(`${key}: [Object - see below]`);
      } else if (value instanceof Date) {
        console.log(`${key}: ${value.toISOString()}`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });
    
    // Display registrationData separately
    console.log('\n=== REGISTRATION DATA ===\n');
    if (nullReg.registrationData) {
      Object.entries(nullReg.registrationData).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          console.log(`${key}:`);
          console.log(JSON.stringify(value, null, 2));
        } else {
          console.log(`${key}: ${value}`);
        }
      });
    }
    
    // Save full data to file
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'null-registration-full-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(nullReg, null, 2));
    console.log(`\nFull data saved to: ${outputPath}`);
    
    // Check for any identifying information
    console.log('\n=== IDENTIFYING INFORMATION ===');
    console.log(`MongoDB _id: ${nullReg._id}`);
    console.log(`Customer ID: ${nullReg.customerId}`);
    console.log(`Booking Contact Email: ${nullReg.registrationData?.bookingContact?.email}`);
    console.log(`Stripe Payment Intent: ${nullReg.stripePaymentIntentId}`);
    console.log(`Square Payment ID: ${nullReg.squarePaymentId}`);
    console.log(`Confirmation Number: ${nullReg.confirmationNumber}`);
    console.log(`Total Amount Paid: ${nullReg.totalAmountPaid}`);
    console.log(`Payment Status: ${nullReg.paymentStatus}`);
    
    // Check attendees
    if (nullReg.registrationData?.attendees) {
      console.log(`\nAttendees: ${nullReg.registrationData.attendees.length}`);
      nullReg.registrationData.attendees.forEach((att: any, i: number) => {
        console.log(`  ${i + 1}. ${att.firstName} ${att.lastName} (${att.email || 'no email'})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

inspectNullRegistration();