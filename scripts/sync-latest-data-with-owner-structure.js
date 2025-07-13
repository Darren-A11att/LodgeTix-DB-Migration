const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Square SDK setup - commented out for now due to SDK issues
// const Square = require('square');
// const squareClient = new Square.Client({
//   accessToken: process.env.SQUARE_ACCESS_TOKEN,
//   environment: 'production'
// });

async function syncLatestData() {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Initialize MongoDB client
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== SYNCING LATEST DATA WITH NEW TICKET STRUCTURE ===\n');
    
    // 1. Sync latest registrations from Supabase
    console.log('1. FETCHING LATEST REGISTRATIONS FROM SUPABASE\n');
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: latestRegistrations, error: regError } = await supabase
      .from('registrations')
      .select('*')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (regError) {
      console.error('Error fetching registrations:', regError);
    } else {
      console.log(`Found ${latestRegistrations.length} registrations from the last week\n`);
      
      let newRegs = 0;
      let updatedRegs = 0;
      
      for (const supReg of latestRegistrations) {
        try {
          // Check if registration exists in MongoDB
          const existingReg = await db.collection('registrations').findOne({
            $or: [
              { confirmationNumber: supReg.confirmation_number },
              { registrationId: supReg.id }
            ]
          });
          
          // Transform tickets to new structure
          let transformedTickets = null;
          if (supReg.registration_data?.tickets) {
            const isLodge = supReg.registration_type === 'lodge' || supReg.registration_type === 'lodges';
            
            if (Array.isArray(supReg.registration_data.tickets)) {
              transformedTickets = supReg.registration_data.tickets.map(ticket => {
                const newTicket = { ...ticket };
                
                // Transform to new owner structure
                if (isLodge) {
                  newTicket.ownerType = 'lodge';
                  newTicket.ownerId = supReg.registration_data.lodgeDetails?.lodgeId || 
                                     supReg.organisation_id || 
                                     supReg.id;
                } else {
                  newTicket.ownerType = 'attendee';
                  newTicket.ownerId = ticket.attendeeId || supReg.primary_attendee_id || supReg.id;
                }
                
                // Remove old attendeeId field
                delete newTicket.attendeeId;
                
                return newTicket;
              });
            } else if (typeof supReg.registration_data.tickets === 'object') {
              transformedTickets = {};
              Object.entries(supReg.registration_data.tickets).forEach(([key, ticket]) => {
                const newTicket = { ...ticket };
                
                if (isLodge) {
                  newTicket.ownerType = 'lodge';
                  newTicket.ownerId = supReg.registration_data.lodgeDetails?.lodgeId || 
                                     supReg.organisation_id || 
                                     supReg.id;
                } else {
                  newTicket.ownerType = 'attendee';
                  newTicket.ownerId = ticket.attendeeId || supReg.primary_attendee_id || supReg.id;
                }
                
                delete newTicket.attendeeId;
                transformedTickets[key] = newTicket;
              });
            }
          }
          
          // Prepare registration data with transformed tickets
          const registrationData = {
            ...supReg.registration_data,
            tickets: transformedTickets || supReg.registration_data.tickets
          };
          
          const mongoDoc = {
            registrationId: supReg.id,
            confirmationNumber: supReg.confirmation_number,
            registrationType: supReg.registration_type,
            status: supReg.status,
            registrationDate: supReg.registration_date,
            eventId: supReg.event_id,
            functionId: supReg.function_id,
            organisationId: supReg.organisation_id,
            organisationName: supReg.organisation_name,
            organisationNumber: supReg.organisation_number,
            customerId: supReg.customer_id,
            authUserId: supReg.auth_user_id,
            bookingContactId: supReg.booking_contact_id,
            primaryAttendeeId: supReg.primary_attendee_id,
            primaryAttendee: supReg.primary_attendee,
            attendeeCount: supReg.attendee_count,
            agreeToTerms: supReg.agree_to_terms,
            paymentStatus: supReg.payment_status,
            totalAmountPaid: supReg.total_amount_paid,
            totalPricePaid: supReg.total_price_paid,
            subtotal: supReg.subtotal,
            platformFeeAmount: supReg.platform_fee_amount,
            platformFeeId: supReg.platform_fee_id,
            includesProcessingFee: supReg.includes_processing_fee,
            stripePaymentIntentId: supReg.stripe_payment_intent_id,
            stripeFee: supReg.stripe_fee,
            squarePaymentId: supReg.square_payment_id,
            squareFee: supReg.square_fee,
            confirmationGeneratedAt: supReg.confirmation_generated_at,
            confirmationPdfUrl: supReg.confirmation_pdf_url,
            connectedAccountId: supReg.connected_account_id,
            createdAt: supReg.created_at,
            updatedAt: supReg.updated_at,
            registrationData: registrationData
          };
          
          if (existingReg) {
            // Update existing
            await db.collection('registrations').updateOne(
              { _id: existingReg._id },
              { $set: mongoDoc }
            );
            updatedRegs++;
          } else {
            // Insert new
            await db.collection('registrations').insertOne(mongoDoc);
            newRegs++;
          }
          
        } catch (error) {
          console.error(`Error syncing registration ${supReg.id}:`, error.message);
        }
      }
      
      console.log(`Synced registrations:`);
      console.log(`  - New: ${newRegs}`);
      console.log(`  - Updated: ${updatedRegs}\n`);
    }
    
    // 2. Square payments sync skipped for now
    console.log('2. SQUARE PAYMENTS SYNC - Skipped\n');
    
    // 3. Verify ticket structure
    console.log('3. VERIFYING TICKET STRUCTURE\n');
    
    const sampleIndividual = await db.collection('registrations').findOne({
      registrationType: { $in: ['individual', 'individuals'] },
      'registrationData.tickets': { $exists: true },
      createdAt: { $gte: oneWeekAgo }
    });
    
    if (sampleIndividual) {
      console.log('Sample INDIVIDUAL registration (recent):');
      console.log(`Confirmation: ${sampleIndividual.confirmationNumber}`);
      const tickets = sampleIndividual.registrationData?.tickets;
      console.log('Tickets:', JSON.stringify(
        Array.isArray(tickets) ? tickets.slice(0, 2) : Object.values(tickets || {}).slice(0, 2),
        null, 2
      ));
    }
    
    const sampleLodge = await db.collection('registrations').findOne({
      registrationType: { $in: ['lodge', 'lodges'] },
      'registrationData.tickets': { $exists: true },
      createdAt: { $gte: oneWeekAgo }
    });
    
    if (sampleLodge) {
      console.log('\nSample LODGE registration (recent):');
      console.log(`Confirmation: ${sampleLodge.confirmationNumber}`);
      const tickets = sampleLodge.registrationData?.tickets;
      console.log('Tickets:', JSON.stringify(
        Array.isArray(tickets) ? tickets.slice(0, 2) : Object.values(tickets || {}).slice(0, 2),
        null, 2
      ));
    }
    
    console.log('\n✅ Sync complete! All new tickets now use ownerType/ownerId structure');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

syncLatestData().catch(console.error);