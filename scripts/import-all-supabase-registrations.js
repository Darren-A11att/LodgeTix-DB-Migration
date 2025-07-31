require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

async function importAllSupabaseRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!uri || !supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return;
  }
  
  const mongoClient = new MongoClient(uri);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    
    console.log('=== COMPREHENSIVE SUPABASE REGISTRATION IMPORT ===\n');
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Import ID: ${importId}\n`);
    
    // Get existing registrations from MongoDB
    console.log('Checking existing registrations in MongoDB...');
    
    const existingRegistrations = await db.collection('registrations')
      .find({}, { projection: { confirmationNumber: 1, registrationId: 1 } })
      .toArray();
    
    const existingConfirmations = new Set(existingRegistrations.map(r => r.confirmationNumber).filter(cn => cn));
    const existingRegistrationIds = new Set(existingRegistrations.map(r => r.registrationId).filter(id => id));
    
    console.log(`Found ${existingRegistrations.length} registrations in MongoDB`);
    console.log(`  - With registrationId: ${existingRegistrationIds.size}`);
    console.log(`  - With confirmationNumber: ${existingConfirmations.size}\n`);
    
    // Also check registration_imports staging
    const existingImports = await db.collection('registration_imports')
      .find({}, { projection: { confirmationNumber: 1, registrationId: 1 } })
      .toArray();
    
    const stagingConfirmations = new Set(existingImports.map(r => r.confirmationNumber).filter(cn => cn));
    const stagingRegistrationIds = new Set(existingImports.map(r => r.registrationId).filter(id => id));
    console.log(`Found ${existingImports.length} in staging (registration_imports)`);
    console.log(`  - With registrationId: ${stagingRegistrationIds.size}`);
    console.log(`  - With confirmationNumber: ${stagingConfirmations.size}`);
    
    // Fetch ALL registrations from Supabase
    console.log('\nFetching ALL registrations from Supabase...');
    
    let allSupabaseRegistrations = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    // First, get the total count
    const { count: totalCount, error: countError } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting count:', countError);
      return;
    }
    
    console.log(`Total registrations in Supabase: ${totalCount}`);
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching from Supabase:', error);
        break;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allSupabaseRegistrations = allSupabaseRegistrations.concat(data);
        console.log(`Fetched batch: ${data.length} registrations (total so far: ${allSupabaseRegistrations.length}/${totalCount})`);
        offset += data.length;
        hasMore = allSupabaseRegistrations.length < totalCount;
      }
    }
    
    console.log(`\nTotal registrations fetched from Supabase: ${allSupabaseRegistrations.length}`);
    
    // Analyze the data
    const stats = {
      total: allSupabaseRegistrations.length,
      test: 0,
      real: 0,
      missing: 0,
      alreadyImported: 0,
      inStaging: 0,
      toImport: 0
    };
    
    const registrationsToImport = [];
    const missingRegistrations = [];
    
    for (const supabaseReg of allSupabaseRegistrations) {
      // Check if test registration
      if (supabaseReg.registration_type === 'TEST' || supabaseReg.test === true) {
        stats.test++;
        continue; // Skip test registrations
      }
      
      stats.real++;
      
      // Check if already in MongoDB
      if (existingConfirmations.has(supabaseReg.confirmation_number) || 
          existingRegistrationIds.has(supabaseReg.registration_id)) {
        stats.alreadyImported++;
        continue;
      }
      
      // Check if in staging
      if (stagingConfirmations.has(supabaseReg.confirmation_number)) {
        stats.inStaging++;
        continue;
      }
      
      // This registration is missing - prepare for import
      stats.missing++;
      missingRegistrations.push({
        confirmation: supabaseReg.confirmation_number,
        name: supabaseReg.primary_attendee?.name || 'Unknown',
        date: supabaseReg.created_at
      });
      
      // Transform Supabase registration to our format
      const registrationImport = {
        importId,
        importedAt: new Date(),
        importedBy: 'comprehensive-import-script',
        
        // Core fields
        registrationId: supabaseReg.registration_id,
        confirmationNumber: supabaseReg.confirmation_number,
        eventId: supabaseReg.event_id,
        functionId: supabaseReg.function_id,
        
        // Customer info
        customerId: supabaseReg.customer_id,
        authUserId: supabaseReg.auth_user_id,
        bookingContactId: supabaseReg.booking_contact_id,
        
        // Organization info
        organisationId: supabaseReg.organisation_id,
        organisationName: supabaseReg.organisation_name,
        organisationNumber: supabaseReg.organisation_number,
        connectedAccountId: supabaseReg.connected_account_id,
        
        // Registration details
        registrationDate: new Date(supabaseReg.registration_date),
        registrationType: supabaseReg.registration_type,
        status: supabaseReg.status,
        paymentStatus: supabaseReg.payment_status,
        
        // Attendee info
        primaryAttendeeId: supabaseReg.primary_attendee_id,
        primaryAttendee: supabaseReg.primary_attendee,
        attendeeCount: supabaseReg.attendee_count,
        
        // Financial info
        totalAmountPaid: supabaseReg.total_amount_paid,
        totalPricePaid: supabaseReg.total_price_paid,
        subtotal: supabaseReg.subtotal,
        platformFeeAmount: supabaseReg.platform_fee_amount,
        platformFeeId: supabaseReg.platform_fee_id,
        stripeFee: supabaseReg.stripe_fee,
        squareFee: supabaseReg.square_fee,
        includesProcessingFee: supabaseReg.includes_processing_fee,
        
        // Payment IDs
        stripePaymentIntentId: supabaseReg.stripe_payment_intent_id,
        squarePaymentId: supabaseReg.square_payment_id,
        
        // Other fields
        agreeToTerms: supabaseReg.agree_to_terms,
        confirmationPdfUrl: supabaseReg.confirmation_pdf_url,
        confirmationGeneratedAt: supabaseReg.confirmation_generated_at ? new Date(supabaseReg.confirmation_generated_at) : null,
        
        // Timestamps
        createdAt: new Date(supabaseReg.created_at),
        updatedAt: new Date(supabaseReg.updated_at),
        
        // Registration data (JSON) - Transform selectedTickets to tickets
        registrationData: await transformRegistrationData(supabaseReg.registration_data, supabaseReg.registration_type, db),
        
        // Processing status
        processed: false,
        processingStatus: 'pending'
      };
      
      registrationsToImport.push(registrationImport);
      stats.toImport++;
    }
    
    // Display statistics
    console.log('\n=== IMPORT ANALYSIS ===');
    console.log(`Total Supabase registrations: ${stats.total}`);
    console.log(`  - Test registrations: ${stats.test}`);
    console.log(`  - Real registrations: ${stats.real}`);
    console.log(`\nStatus of real registrations:`);
    console.log(`  - Already in MongoDB: ${stats.alreadyImported}`);
    console.log(`  - Already in staging: ${stats.inStaging}`);
    console.log(`  - Missing (to import): ${stats.missing}`);
    
    if (missingRegistrations.length > 0) {
      console.log('\n⚠️  Missing Registrations Sample:');
      missingRegistrations.slice(0, 10).forEach((reg, idx) => {
        console.log(`${idx + 1}. ${reg.confirmation} - ${reg.name} - ${new Date(reg.date).toLocaleDateString()}`);
      });
      if (missingRegistrations.length > 10) {
        console.log(`... and ${missingRegistrations.length - 10} more`);
      }
    }
    
    // Import missing registrations
    if (registrationsToImport.length > 0) {
      console.log(`\n📥 Importing ${registrationsToImport.length} missing registrations...`);
      
      // Insert in batches
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < registrationsToImport.length; i += batchSize) {
        const batch = registrationsToImport.slice(i, i + batchSize);
        await db.collection('registration_imports').insertMany(batch);
        imported += batch.length;
        console.log(`Imported ${imported}/${registrationsToImport.length} registrations`);
      }
      
      // Create import batch record
      await db.collection('import_batches').insertOne({
        batchId,
        importId,
        source: 'supabase',
        type: 'registrations',
        startedAt: new Date(),
        completedAt: new Date(),
        stats: stats,
        status: 'completed'
      });
      
      console.log('\n✅ Import completed successfully!');
    } else {
      console.log('\n✅ All Supabase registrations are already imported!');
    }
    
    // Final check
    const finalTotal = await db.collection('registrations').countDocuments();
    const finalStaging = await db.collection('registration_imports').countDocuments();
    
    console.log('\n=== FINAL STATUS ===');
    console.log(`Registrations in main collection: ${finalTotal}`);
    console.log(`Registrations in staging: ${finalStaging}`);
    console.log(`Total Supabase registrations: ${stats.total} (${stats.real} real, ${stats.test} test)`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoClient.close();
  }
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

/**
 * Transform registration data from Supabase format to MongoDB format
 * Converts selectedTickets to tickets array with proper ownership
 */
async function transformRegistrationData(registrationData, registrationType, db) {
  if (!registrationData) return registrationData;
  
  // If registrationData has selectedTickets, transform them to tickets
  if (registrationData.selectedTickets && registrationData.selectedTickets.length > 0 && (!registrationData.tickets || registrationData.tickets.length === 0)) {
    // Get event tickets for mapping names and prices
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    console.log(`Found ${eventTickets.length} eventTickets in database`);
    
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      // Handle MongoDB Decimal128 type
      let price = 0;
      if (ticket.price) {
        if (ticket.price.$numberDecimal) {
          price = parseFloat(ticket.price.$numberDecimal);
        } else if (ticket.price.toString) {
          // Handle Decimal128 object
          price = parseFloat(ticket.price.toString());
        } else {
          price = parsePrice(ticket.price);
        }
      }
      
      if (ticketId) {
        ticketMap.set(ticketId, {
          name: ticket.name,
          price: price,
          description: ticket.description || ''
        });
      }
    });
    
    console.log(`Created ticketMap with ${ticketMap.size} entries`);
    if (ticketMap.size === 0) {
      console.log('WARNING: No eventTickets found in database! Tickets will use fallback values.');
    }
    
    // Convert selectedTickets to tickets format
    const tickets = [];
    
    registrationData.selectedTickets.forEach(selectedTicket => {
      // Handle both eventTicketsId (with s) and eventTicketId (without s)
      const eventTicketId = selectedTicket.event_ticket_id || selectedTicket.eventTicketId || 
                           selectedTicket.eventTicketsId || selectedTicket.ticketDefinitionId;
      const ticketInfo = ticketMap.get(eventTicketId) || {};
      
      // Debug: Log if we're not finding the ticket in the map
      if (!ticketMap.has(eventTicketId)) {
        console.log(`WARNING: EventTicket ${eventTicketId} not found in ticketMap. Using fallback values.`);
      }
      
      const quantity = selectedTicket.quantity || 1;
      
      // Determine owner based on registration type
      const isIndividual = registrationType === 'individuals' || 
                         registrationType === 'individual';
      
      // Create ticket entries based on quantity
      for (let i = 0; i < quantity; i++) {
        const ticket = {
          eventTicketId: eventTicketId,
          name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
          price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
          quantity: 1,
          ownerType: isIndividual ? 'attendee' : 'lodge',
          status: 'sold'
        };
        
        // CRITICAL: Preserve attendeeId for individual registrations
        if (isIndividual && selectedTicket.attendeeId) {
          ticket.ownerId = selectedTicket.attendeeId; // Preserve the original attendeeId
        } else {
          // For lodge registrations, use lodge/organisation ID
          ticket.ownerId = registrationData?.lodgeDetails?.lodgeId || 
                          registrationData?.lodgeId || 
                          registrationData?.organisationId ||
                          registrationData?.registrationId || 
                          registrationData?.registration_id;
        }
        
        tickets.push(ticket);
      }
    });
    
    // Create a new object with tickets and without selectedTickets
    const transformedData = { ...registrationData };
    transformedData.tickets = tickets;
    delete transformedData.selectedTickets;
    
    return transformedData;
  }
  
  return registrationData;
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

// Run if called directly
if (require.main === module) {
  importAllSupabaseRegistrations()
    .then(() => {
      console.log('\n✅ Supabase registration import completed');
      console.log('\nNext steps:');
      console.log('1. Run "npm run process:registrations" to process the imports');
      console.log('2. Run "npm run match:payments" to match payments to registrations');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Supabase registration import failed:', error);
      process.exit(1);
    });
}

module.exports = { importAllSupabaseRegistrations };