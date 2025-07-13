const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function recoverTicketOwnership() {
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
    console.log('=== RECOVERING TICKET OWNERSHIP FROM SUPABASE ===\n');
    
    // Get all registrations from MongoDB to match with Supabase
    const mongoRegistrations = await db.collection('registrations').find({
      registrationType: { $in: ['individual', 'individuals'] }
    }).toArray();
    
    console.log(`Found ${mongoRegistrations.length} individual registrations in MongoDB\n`);
    
    // Create a map for quick lookup
    const mongoRegMap = new Map();
    mongoRegistrations.forEach(reg => {
      // Use various possible identifiers
      if (reg.confirmationNumber) mongoRegMap.set(reg.confirmationNumber, reg);
      if (reg.registrationId) mongoRegMap.set(reg.registrationId, reg);
    });
    
    console.log('Fetching registration data from Supabase...\n');
    
    // Fetch all registrations from Supabase with their registration_data
    const { data: supabaseRegistrations, error } = await supabase
      .from('registrations')
      .select('registration_id, confirmation_number, registration_data')
      .not('registration_data', 'is', null);
    
    if (error) {
      console.error('Error fetching from Supabase:', error);
      return;
    }
    
    console.log(`Fetched ${supabaseRegistrations.length} registrations from Supabase\n`);
    
    let recoveredCount = 0;
    let noMatchCount = 0;
    let noTicketsCount = 0;
    
    // Process each Supabase registration
    for (const supabaseReg of supabaseRegistrations) {
      try {
        // Find matching MongoDB registration
        const mongoReg = mongoRegMap.get(supabaseReg.confirmation_number) || 
                        mongoRegMap.get(supabaseReg.registration_id);
        
        if (!mongoReg) {
          noMatchCount++;
          continue;
        }
        
        const supabaseData = supabaseReg.registration_data;
        const mongoData = mongoReg.registrationData || mongoReg.registration_data;
        
        // Check if Supabase has tickets with attendeeId
        if (!supabaseData.tickets || 
            (Array.isArray(supabaseData.tickets) && supabaseData.tickets.length === 0) ||
            (typeof supabaseData.tickets === 'object' && Object.keys(supabaseData.tickets).length === 0)) {
          noTicketsCount++;
          continue;
        }
        
        // Create a map of ticket ownership from Supabase data
        const ticketOwnershipMap = new Map();
        
        if (Array.isArray(supabaseData.tickets)) {
          supabaseData.tickets.forEach(ticket => {
            if (ticket.attendeeId && ticket.eventTicketId) {
              if (!ticketOwnershipMap.has(ticket.eventTicketId)) {
                ticketOwnershipMap.set(ticket.eventTicketId, []);
              }
              ticketOwnershipMap.get(ticket.eventTicketId).push(ticket.attendeeId);
            }
          });
        } else {
          Object.values(supabaseData.tickets).forEach(ticket => {
            if (ticket.attendeeId && ticket.eventTicketId) {
              if (!ticketOwnershipMap.has(ticket.eventTicketId)) {
                ticketOwnershipMap.set(ticket.eventTicketId, []);
              }
              ticketOwnershipMap.get(ticket.eventTicketId).push(ticket.attendeeId);
            }
          });
        }
        
        // Update MongoDB tickets with correct ownership
        let updatedTickets;
        let hasUpdates = false;
        
        if (Array.isArray(mongoData.tickets)) {
          updatedTickets = mongoData.tickets.map((ticket, index) => {
            const owners = ticketOwnershipMap.get(ticket.eventTicketId) || [];
            if (owners[index]) {
              hasUpdates = true;
              return {
                ...ticket,
                ownerType: 'attendee',
                ownerId: owners[index]
              };
            }
            return ticket;
          });
        } else {
          updatedTickets = {};
          let ticketIndex = {};
          
          Object.entries(mongoData.tickets).forEach(([ticketKey, ticket]) => {
            const eventTicketId = ticket.eventTicketId;
            if (!ticketIndex[eventTicketId]) ticketIndex[eventTicketId] = 0;
            
            const owners = ticketOwnershipMap.get(eventTicketId) || [];
            const ownerIndex = ticketIndex[eventTicketId]++;
            
            if (owners[ownerIndex]) {
              hasUpdates = true;
              updatedTickets[ticketKey] = {
                ...ticket,
                ownerType: 'attendee',
                ownerId: owners[ownerIndex]
              };
            } else {
              updatedTickets[ticketKey] = ticket;
            }
          });
        }
        
        if (hasUpdates) {
          // Update MongoDB with recovered ownership
          const updatePath = mongoReg.registrationData ? 'registrationData' : 'registration_data';
          
          await db.collection('registrations').updateOne(
            { _id: mongoReg._id },
            { 
              $set: { 
                [`${updatePath}.tickets`]: updatedTickets 
              }
            }
          );
          
          recoveredCount++;
          
          if (recoveredCount <= 5) {
            console.log(`Recovered ownership for ${mongoReg.confirmationNumber}:`);
            console.log(`  Ticket ownership map:`, Object.fromEntries(ticketOwnershipMap));
          }
        }
        
      } catch (error) {
        console.error(`Error processing registration ${supabaseReg.registration_id}:`, error.message);
      }
    }
    
    console.log('\n=== RECOVERY COMPLETE ===');
    console.log(`Total registrations with recovered ownership: ${recoveredCount}`);
    console.log(`No MongoDB match found: ${noMatchCount}`);
    console.log(`No tickets in Supabase data: ${noTicketsCount}`);
    
    // Verify recovery
    console.log('\n=== VERIFICATION ===');
    
    const sampleRecovered = await db.collection('registrations').findOne({
      registrationType: { $in: ['individual', 'individuals'] },
      'registrationData.tickets': { $exists: true }
    });
    
    if (sampleRecovered) {
      const tickets = sampleRecovered.registrationData?.tickets || sampleRecovered.registration_data?.tickets;
      console.log('\nSample recovered registration:');
      console.log(`Confirmation: ${sampleRecovered.confirmationNumber}`);
      
      // Show ticket ownership
      const ticketOwners = new Set();
      if (Array.isArray(tickets)) {
        tickets.forEach(t => ticketOwners.add(t.ownerId));
      } else {
        Object.values(tickets).forEach(t => ticketOwners.add(t.ownerId));
      }
      
      console.log(`Unique ticket owners: ${ticketOwners.size}`);
      console.log('Sample tickets:', JSON.stringify(
        Array.isArray(tickets) ? tickets.slice(0, 3) : Object.values(tickets).slice(0, 3), 
        null, 
        2
      ));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

recoverTicketOwnership().catch(console.error);