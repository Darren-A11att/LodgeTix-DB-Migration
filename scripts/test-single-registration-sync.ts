import { EnhancedPaymentSyncService } from '../src/services/sync/enhanced-payment-sync';
import { MongoClient } from 'mongodb';

async function testSingleRegistrationSync() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get the specific registration
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    const registration = await db.collection('registrations').findOne({ id: registrationId });
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('Processing registration:', registrationId);
    console.log('Registration type:', registration.registration_type || registration.type);
    console.log('Number of tickets in registration_data:', 
      registration.registration_data?.selectedTickets?.length || 
      registration.registration_data?.tickets?.length || 0
    );
    
    // Create sync service instance
    const syncService = new EnhancedPaymentSyncService(
      uri,
      'lodgetix',
      process.env.STRIPE_SECRET_KEY || '',
      process.env.SQUARE_ACCESS_TOKEN || '',
      process.env.SQUARE_ENVIRONMENT || 'production'
    );
    
    // Process just this registration
    await syncService.processRegistration(registration);
    
    console.log('\n=== CHECKING RESULTS ===\n');
    
    // Check import_tickets
    const importedTickets = await db.collection('import_tickets').find({ 
      'data.originalRegistrationId': registrationId 
    }).toArray();
    
    console.log(`Tickets in import_tickets: ${importedTickets.length}`);
    importedTickets.forEach((ticket: any, idx: number) => {
      console.log(`  ${idx + 1}. ${ticket.data.eventName} - ${ticket.data.eventTicketId}`);
    });
    
    // Check production tickets
    const productionTickets = await db.collection('tickets').find({ 
      originalRegistrationId: registrationId 
    }).toArray();
    
    console.log(`\nTickets in production: ${productionTickets.length}`);
    productionTickets.forEach((ticket: any, idx: number) => {
      console.log(`  ${idx + 1}. ${ticket.eventName} - ${ticket.eventTicketId}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testSingleRegistrationSync().catch(console.error);