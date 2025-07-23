import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;

// MongoDB config
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TransformedTicket {
  eventTicketId: string;
  name: string;
  price: number;
  quantity: number;
  ownerType: 'attendee' | 'lodge';
  ownerId: string;
}

function parsePrice(price: any): number {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    return parseFloat(price.replace(/[^0-9.-]+/g, '')) || 0;
  }
  return 0;
}

function roundToTwoDecimals(num: any): number {
  return Math.round((parseFloat(num) || 0) * 100) / 100;
}

async function importSpecificMissingRegistrations() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Load missing registrations data
    const missingDataPath = path.join(__dirname, 'missing-registrations-from-csv.json');
    const missingData = JSON.parse(fs.readFileSync(missingDataPath, 'utf-8'));
    
    // Get list of registration IDs to import (excluding TEST and pending without confirmation)
    const regIdsToImport = missingData.registrations
      .filter((reg: any) => 
        reg.status === 'completed' && 
        reg.confirmationNumber && 
        reg.confirmationNumber !== ''
      )
      .map((reg: any) => reg.registrationId);
    
    console.log(`=== IMPORTING ${regIdsToImport.length} MISSING REGISTRATIONS ===\n`);
    
    // Get event tickets for mapping
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        description: ticket.description || ''
      });
    });
    
    // Fetch full registration data from Supabase
    const { data: supabaseRegistrations, error } = await supabase
      .from('registrations')
      .select('*')
      .in('registration_id', regIdsToImport);
    
    if (error) {
      throw error;
    }
    
    console.log(`Fetched ${supabaseRegistrations?.length || 0} registrations from Supabase\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const supabaseReg of supabaseRegistrations || []) {
      try {
        const regData = supabaseReg.registration_data;
        
        // Get selectedTickets or tickets from registration data
        const selectedTickets = regData?.selectedTickets || regData?.tickets || [];
        
        // Transform selectedTickets to tickets array with correct ownership
        const transformedTickets: TransformedTicket[] = [];
        
        if (selectedTickets.length > 0) {
          const isIndividual = supabaseReg.registration_type === 'individuals' || 
                              supabaseReg.registration_type === 'individual';
          
          selectedTickets.forEach((selectedTicket: any) => {
            const eventTicketId = selectedTicket.event_ticket_id || 
                                 selectedTicket.eventTicketId || 
                                 selectedTicket.ticketDefinitionId;
            
            if (!eventTicketId) {
              console.warn(`No event ticket ID found for ticket in registration ${supabaseReg.registration_id}`);
              return;
            }
            
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            const quantity = selectedTicket.quantity || 1;
            
            let ownerId: string;
            let ownerType: 'attendee' | 'lodge';
            
            if (isIndividual) {
              ownerType = 'attendee';
              ownerId = selectedTicket.attendeeId;
            } else {
              ownerType = 'lodge';
              ownerId = regData?.lodgeDetails?.lodgeId || 
                       regData?.lodgeId || 
                       supabaseReg.organisation_id ||
                       supabaseReg.registration_id;
            }
            
            transformedTickets.push({
              eventTicketId: eventTicketId,
              name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
              price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
              quantity: quantity,
              ownerType: ownerType,
              ownerId: ownerId
            });
          });
        }
        
        // Prepare MongoDB document
        const mongoRegistration = {
          registrationId: supabaseReg.registration_id,
          confirmationNumber: supabaseReg.confirmation_number,
          registrationType: supabaseReg.registration_type,
          functionId: supabaseReg.function_id,
          registrationData: {
            ...regData,
            tickets: transformedTickets,
            selectedTickets: undefined
          },
          attendeeCount: supabaseReg.attendee_count,
          totalAmountPaid: roundToTwoDecimals(supabaseReg.total_amount_paid),
          totalPricePaid: roundToTwoDecimals(supabaseReg.total_price_paid),
          paymentStatus: supabaseReg.payment_status,
          status: supabaseReg.status,
          stripePaymentIntentId: supabaseReg.stripe_payment_intent_id,
          squarePaymentId: supabaseReg.square_payment_id,
          createdAt: new Date(supabaseReg.created_at),
          updatedAt: new Date(supabaseReg.updated_at),
          registrationDate: supabaseReg.registration_date ? new Date(supabaseReg.registration_date) : null,
          primaryAttendeeId: regData?.attendees?.[0]?.attendeeId || supabaseReg.primary_attendee_id || null,
          customerId: supabaseReg.customer_id,
          organisationId: supabaseReg.organisation_id,
          connectedAccountId: supabaseReg.connected_account_id,
          platformFeeAmount: supabaseReg.platform_fee_amount,
          platformFeeId: supabaseReg.platform_fee_id,
          confirmationPdfUrl: supabaseReg.confirmation_pdf_url,
          subtotal: supabaseReg.subtotal,
          stripeFee: supabaseReg.stripe_fee,
          includesProcessingFee: supabaseReg.includes_processing_fee,
          authUserId: supabaseReg.auth_user_id,
          organisationName: supabaseReg.organisation_name,
          organisationNumber: supabaseReg.organisation_number,
          primaryAttendee: supabaseReg.primary_attendee,
          confirmationGeneratedAt: supabaseReg.confirmation_generated_at ? new Date(supabaseReg.confirmation_generated_at) : null,
          eventId: supabaseReg.event_id,
          bookingContactId: supabaseReg.booking_contact_id,
          squareFee: supabaseReg.square_fee,
          agreeToTerms: supabaseReg.agree_to_terms,
          importedAt: new Date(),
          importSource: 'csv-comparison-import'
        };
        
        // Insert into MongoDB
        const result = await registrationsCollection.insertOne(mongoRegistration);
        
        if (result.acknowledged) {
          successCount++;
          console.log(`✅ Imported ${supabaseReg.confirmation_number} - ${regData?.bookingContact?.firstName} ${regData?.bookingContact?.lastName} (${transformedTickets.length} tickets)`);
        } else {
          errorCount++;
          console.log(`❌ Failed to import ${supabaseReg.confirmation_number}`);
        }
        
      } catch (error) {
        errorCount++;
        console.log(`❌ Error importing ${supabaseReg.confirmation_number}:`, error);
      }
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Successfully imported: ${successCount} registrations`);
    console.log(`Errors: ${errorCount}`);
    
    // Not fetched from Supabase
    const notFetched = regIdsToImport.filter((id: string) => 
      !supabaseRegistrations?.some(r => r.registration_id === id)
    );
    
    if (notFetched.length > 0) {
      console.log(`\n⚠️  Could not fetch from Supabase: ${notFetched.length} registrations`);
      notFetched.forEach((id: string) => {
        const reg = missingData.registrations.find((r: any) => r.registrationId === id);
        console.log(`  - ${reg?.confirmationNumber} (${id})`);
      });
    }
    
    // Final verification
    const totalInMongo = await registrationsCollection.countDocuments();
    console.log(`\nTotal registrations in MongoDB: ${totalInMongo}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
importSpecificMissingRegistrations();