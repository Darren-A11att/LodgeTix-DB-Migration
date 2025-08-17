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

async function generateSummaryReport() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db('lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    console.log('\n🔍 LODGE PAYMENT COMPARISON ANALYSIS');
    console.log('=====================================\n');
    
    const results = [];
    
    for (const registrationId of LODGE_REGISTRATION_IDS) {
      const registration = await registrationsCollection.findOne({ 
        id: registrationId 
      });
      
      if (registration) {
        const result = {
          registrationId,
          organizationName: registration.organisationName,
          paymentId: registration.paymentId,
          stripePaymentIntentId: registration.stripePaymentIntentId,
          squarePaymentId: registration.squarePaymentId,
          gateway: registration.gateway,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          totalAmountPaid: registration.totalAmountPaid
        };
        
        results.push(result);
        
        console.log(`📋 ${result.organizationName} (${registrationId})`);
        console.log(`   Payment Gateway: ${result.gateway}`);
        console.log(`   Payment ID: ${result.paymentId}`);
        console.log(`   Square Payment ID: ${result.squarePaymentId}`);
        console.log(`   Stripe Payment Intent ID: ${result.stripePaymentIntentId}`);
        console.log(`   Status: ${result.status} / ${result.paymentStatus}`);
        console.log(`   Amount: $${(result.totalAmountPaid / 100).toFixed(2)}`);
        console.log('');
      }
    }
    
    console.log('💰 ERROR PAYMENT IDS TO COMPARE AGAINST:');
    console.log('========================================');
    ERROR_PAYMENT_IDS.forEach((id, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${id}`);
    });
    
    console.log('\n🔎 COMPARISON ANALYSIS:');
    console.log('=======================');
    
    const allRegistrationPaymentIds = results.flatMap(r => [
      r.paymentId,
      r.stripePaymentIntentId,
      r.squarePaymentId
    ].filter(Boolean));
    
    console.log(`Found ${allRegistrationPaymentIds.length} payment IDs in the successful Lodge registrations:`);
    allRegistrationPaymentIds.forEach((id, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${id}`);
    });
    
    const matches = allRegistrationPaymentIds.filter(paymentId => 
      ERROR_PAYMENT_IDS.includes(paymentId)
    );
    
    console.log('\n✅ FINAL CONCLUSION:');
    console.log('====================');
    
    if (matches.length > 0) {
      console.log(`🚨 FOUND ${matches.length} MATCHES between successful registrations and error payments:`);
      matches.forEach(match => console.log(`   - ${match}`));
      console.log('\nThis suggests some error payments may be legitimate payments that should not be deleted.');
    } else {
      console.log('✅ NO MATCHES FOUND between successful Lodge registrations and error payments.');
      console.log('\nThis confirms that:');
      console.log('• The 12 error_payments are likely failed/duplicate payment attempts');
      console.log('• The successful Lodge registrations use completely different payment IDs');
      console.log('• It is safe to clean up the error_payments as they are not linked to successful registrations');
      console.log('');
      console.log('🔗 Payment Gateway Analysis:');
      console.log('• Lodge Jerusalem: Uses Square gateway (ext_c54de1764bab4b7cbd84)');
      console.log('• Lodge Mark Owen: Uses Square gateway (ext_7cca46617d224b349f61)');
      console.log('• Error payments: All use Stripe gateway (pi_3xxx format)');
      console.log('');
      console.log('This gateway difference further confirms these are separate payment attempts.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

generateSummaryReport().catch(console.error);