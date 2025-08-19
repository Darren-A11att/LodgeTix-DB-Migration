import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.explorer' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required');
  process.exit(1);
}

// Error payment IDs to compare against
const ERROR_PAYMENT_IDS = [
  'pi_3PqcyFGgocE8jUP71IEVEQKu',
  'pi_3PpTKdGgocE8jUP73HdGsP7M', 
  'pi_3PpTOCGgocE8jUP70w7s8MPk',
  'pi_3PpTRRGgocE8jUP71p9vgF5e',
  'pi_3PpTSJGgocE8jUP71T5wC8jM',
  'pi_3PpU6lGgocE8jUP70AQhgeDj',
  'pi_3PqU2XGgocE8jUP70RtP8a8D',
  'pi_3PqUKDGgocE8jUP70X9mlCUV',
  'pi_3PqUO6GgocE8jUP71Q5UaIAg',
  'pi_3PqUStGgocE8jUP73WQRxlxg',
  'pi_3PqUZUGgocE8jUP71g6Y5nEd',
  'pi_3PqcfqGgocE8jUP72w8KUuBf'
];

// Lodge registration IDs
const LODGE_REGISTRATION_IDS = [
  '4a7a7ca5-ed7d-4251-b04a-b9169fde77a8', // Jerusalem
  'b95234d7-8980-4d48-8854-af9d1fc06b49'  // Mark Owen
];

async function checkLodgeRegistrationPaymentIds() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db('lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    console.log('\n=== CHECKING LODGE REGISTRATION PAYMENT IDS ===\n');
    
    for (const registrationId of LODGE_REGISTRATION_IDS) {
      console.log(`\n--- Registration ID: ${registrationId} ---`);
      
      const registration = await registrationsCollection.findOne({ 
        id: registrationId 
      });
      
      if (!registration) {
        console.log('❌ Registration not found');
        continue;
      }
      
      console.log(`Registration found for: ${registration.organisationName || 'Unknown Organization'}`);
      
      // Extract payment-related fields from actual structure
      const paymentFields = {
        paymentId: registration.paymentId,
        stripePaymentIntentId: registration.stripePaymentIntentId,
        squarePaymentId: registration.squarePaymentId,
        gateway: registration.gateway
      };
      
      console.log('\nPayment fields in registration:');
      Object.entries(paymentFields).forEach(([field, value]) => {
        if (value) {
          console.log(`  ${field}: ${value}`);
        }
      });
      
      // Check for any matches with error payment IDs
      const foundPaymentIds = Object.values(paymentFields).filter(Boolean);
      const matches = foundPaymentIds.filter(paymentId => 
        ERROR_PAYMENT_IDS.includes(paymentId as string)
      );
      
      if (matches.length > 0) {
        console.log(`\n🚨 MATCH FOUND! Registration payment ID(s) match error_payments:`);
        matches.forEach(match => console.log(`  - ${match}`));
      } else {
        console.log(`\n✅ NO MATCHES - Registration payment IDs are different from error_payments`);
        if (foundPaymentIds.length > 0) {
          console.log('This suggests the error_payments are indeed failed/duplicate attempts');
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Error payment IDs to compare against:');
    ERROR_PAYMENT_IDS.forEach(id => console.log(`  - ${id}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkLodgeRegistrationPaymentIds().catch(console.error);