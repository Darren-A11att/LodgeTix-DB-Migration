import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Find registrations that truly have no tickets (empty arrays or missing)
 * And check if they have selectedTickets in Supabase that need to be converted
 */
async function findTrulyEmptyRegistrations() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== FINDING TRULY EMPTY REGISTRATIONS ===\n');
    
    // Get all registrations
    const allRegistrations = await registrationsCollection.find({}).toArray();
    
    const emptyRegistrations: any[] = [];
    const withSelectedTicketsInSupabase: any[] = [];
    
    console.log(`Checking ${allRegistrations.length} total registrations...\n`);
    
    for (const reg of allRegistrations) {
      const regData = reg.registrationData || reg.registration_data || {};
      const tickets = regData.tickets;
      
      // Check if tickets is truly empty (not exists, null, or empty array)
      const hasNoTickets = !tickets || (Array.isArray(tickets) && tickets.length === 0);
      
      if (hasNoTickets) {
        emptyRegistrations.push(reg);
        
        // Check Supabase for selectedTickets
        try {
          const { data: supabaseReg, error } = await supabase
            .from('registrations')
            .select('registration_data')
            .eq('registration_id', reg.registrationId || reg.registration_id)
            .single();
          
          if (!error && supabaseReg?.registration_data) {
            const selectedTickets = supabaseReg.registration_data.selectedTickets || 
                                  supabaseReg.registration_data.selected_tickets || [];
            
            if (selectedTickets.length > 0) {
              withSelectedTicketsInSupabase.push({
                ...reg,
                supabaseSelectedTickets: selectedTickets
              });
            }
          }
        } catch (err) {
          // Skip if can't fetch from Supabase
        }
      }
    }
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Total registrations checked: ${allRegistrations.length}`);
    console.log(`Registrations with NO tickets (truly empty): ${emptyRegistrations.length}`);
    console.log(`Of those, have selectedTickets in Supabase: ${withSelectedTicketsInSupabase.length}`);
    
    // Group by type
    const byType = new Map<string, number>();
    const byPaymentStatus = new Map<string, number>();
    
    emptyRegistrations.forEach(reg => {
      const type = reg.registrationType || 'unknown';
      byType.set(type, (byType.get(type) || 0) + 1);
      
      const status = reg.paymentStatus || 'unknown';
      byPaymentStatus.set(status, (byPaymentStatus.get(status) || 0) + 1);
    });
    
    console.log('\nBy registration type:');
    byType.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nBy payment status:');
    byPaymentStatus.forEach((count, status) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Show samples of fixable registrations
    if (withSelectedTicketsInSupabase.length > 0) {
      console.log('\n=== REGISTRATIONS THAT CAN BE FIXED ===');
      console.log(`Found ${withSelectedTicketsInSupabase.length} registrations with selectedTickets in Supabase\n`);
      
      const samples = withSelectedTicketsInSupabase.slice(0, 5);
      samples.forEach((reg, idx) => {
        console.log(`${idx + 1}. ${reg.confirmationNumber} (${reg.registrationId})`);
        console.log(`   Type: ${reg.registrationType}`);
        console.log(`   Payment: ${reg.paymentStatus} - $${reg.totalAmountPaid || 0}`);
        console.log(`   Attendees: ${reg.attendeeCount || 0}`);
        console.log(`   SelectedTickets in Supabase: ${reg.supabaseSelectedTickets.length}`);
        
        // Show first selectedTicket
        if (reg.supabaseSelectedTickets[0]) {
          const ticket = reg.supabaseSelectedTickets[0];
          console.log(`   Sample ticket: ${ticket.name || 'Unknown'} (qty: ${ticket.quantity || 1})`);
        }
        console.log();
      });
    }
    
    // Save results
    const outputDir = path.join(process.cwd(), 'script-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `truly-empty-registrations-${timestamp}.json`);
    
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRegistrations: allRegistrations.length,
        emptyRegistrations: emptyRegistrations.length,
        fixableWithSupabase: withSelectedTicketsInSupabase.length,
        byType: Object.fromEntries(byType),
        byPaymentStatus: Object.fromEntries(byPaymentStatus)
      },
      emptyRegistrations: emptyRegistrations.map(r => ({
        registrationId: r.registrationId,
        confirmationNumber: r.confirmationNumber,
        type: r.registrationType,
        paymentStatus: r.paymentStatus,
        totalAmount: r.totalAmountPaid,
        attendeeCount: r.attendeeCount || 0
      })),
      fixableRegistrations: withSelectedTicketsInSupabase.map(r => ({
        registrationId: r.registrationId,
        confirmationNumber: r.confirmationNumber,
        type: r.registrationType,
        paymentStatus: r.paymentStatus,
        totalAmount: r.totalAmountPaid,
        selectedTicketsCount: r.supabaseSelectedTickets.length,
        selectedTickets: r.supabaseSelectedTickets
      }))
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n✅ Results saved to: ${outputFile}`);
    
    return {
      emptyRegistrations,
      fixableRegistrations: withSelectedTicketsInSupabase
    };
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the analysis
if (require.main === module) {
  findTrulyEmptyRegistrations().catch(console.error);
}

export { findTrulyEmptyRegistrations };