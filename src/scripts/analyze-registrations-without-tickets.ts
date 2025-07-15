import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Analyze registrations without tickets
 * Search for ticket-related information in their data
 */
async function analyzeRegistrationsWithoutTickets() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== ANALYZING REGISTRATIONS WITHOUT TICKETS ===\n');
    
    // Find registrations without tickets
    const registrationsWithoutTickets = await registrationsCollection.find({
      $and: [
        {
          $or: [
            { 'registrationData.tickets': { $exists: false } },
            { 'registrationData.tickets': { $size: 0 } },
            { 'registrationData.tickets': null },
            { 'registration_data.tickets': { $exists: false } },
            { 'registration_data.tickets': { $size: 0 } },
            { 'registration_data.tickets': null }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithoutTickets.length} registrations without tickets\n`);
    
    // Categorize by registration type
    const byType = new Map<string, number>();
    registrationsWithoutTickets.forEach(reg => {
      const type = reg.registrationType || 'unknown';
      byType.set(type, (byType.get(type) || 0) + 1);
    });
    
    console.log('By registration type:');
    byType.forEach((count, type) => {
      console.log(`  ${type}: ${count} registrations`);
    });
    console.log();
    
    // Analyze each registration for ticket-related information
    const analysisResults: any[] = [];
    const sampleSize = Math.min(10, registrationsWithoutTickets.length);
    
    console.log(`\n=== ANALYZING FIRST ${sampleSize} REGISTRATIONS ===\n`);
    
    for (let i = 0; i < sampleSize; i++) {
      const reg = registrationsWithoutTickets[i];
      const regData = reg.registrationData || reg.registration_data || {};
      
      console.log(`\n${i + 1}. ${reg.confirmationNumber} (${reg.registrationId})`);
      console.log(`   Type: ${reg.registrationType}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Total Amount: $${reg.totalAmountPaid || 0}`);
      
      // Search for ticket-related fields using regex
      const ticketPatterns = [
        /ticket/i,
        /selectedTicket/i,
        /event.*ticket/i,
        /ticket.*id/i,
        /ticket.*price/i,
        /ticket.*quantity/i
      ];
      
      const foundTicketFields: any = {};
      const searchInObject = (obj: any, path: string = '') => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          const fullPath = path ? `${path}.${key}` : key;
          
          // Check if key matches any ticket pattern
          if (ticketPatterns.some(pattern => pattern.test(key))) {
            foundTicketFields[fullPath] = obj[key];
          }
          
          // Recursively search nested objects
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            searchInObject(obj[key], fullPath);
          }
        });
      };
      
      searchInObject(regData);
      
      // Check specific known fields
      const hasSelectedTickets = !!(regData.selectedTickets && regData.selectedTickets.length > 0);
      const hasTickets = !!(regData.tickets && regData.tickets.length > 0);
      const attendeeCount = reg.attendeeCount || regData.attendees?.length || 0;
      
      console.log(`   Attendee Count: ${attendeeCount}`);
      console.log(`   Has selectedTickets: ${hasSelectedTickets}`);
      if (hasSelectedTickets) {
        console.log(`     - Count: ${regData.selectedTickets.length}`);
      }
      console.log(`   Has tickets: ${hasTickets}`);
      
      if (Object.keys(foundTicketFields).length > 0) {
        console.log(`   Found ticket-related fields:`);
        Object.entries(foundTicketFields).forEach(([field, value]) => {
          console.log(`     - ${field}: ${JSON.stringify(value)}`);
        });
      }
      
      // Fetch from Supabase to see if there's data there
      try {
        const { data: supabaseReg, error } = await supabase
          .from('registrations')
          .select('registration_data')
          .eq('registration_id', reg.registrationId || reg.registration_id)
          .single();
        
        if (!error && supabaseReg?.registration_data) {
          const supData = supabaseReg.registration_data;
          const supSelectedTickets = supData.selectedTickets || supData.selected_tickets || [];
          const supTickets = supData.tickets || [];
          
          console.log(`   Supabase data:`);
          console.log(`     - selectedTickets: ${supSelectedTickets.length}`);
          console.log(`     - tickets: ${supTickets.length}`);
          
          if (supSelectedTickets.length > 0) {
            console.log(`     ⚠️  Has selectedTickets in Supabase but not in MongoDB!`);
          }
        }
      } catch (err) {
        console.log(`   Could not fetch from Supabase`);
      }
      
      // Store analysis result
      analysisResults.push({
        registrationId: reg.registrationId,
        confirmationNumber: reg.confirmationNumber,
        registrationType: reg.registrationType,
        paymentStatus: reg.paymentStatus,
        totalAmountPaid: reg.totalAmountPaid,
        attendeeCount,
        hasSelectedTickets,
        selectedTicketsCount: regData.selectedTickets?.length || 0,
        hasTickets,
        ticketsCount: regData.tickets?.length || 0,
        foundTicketFields: Object.keys(foundTicketFields).length > 0 ? foundTicketFields : null,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt
      });
    }
    
    // Summary statistics
    console.log('\n=== SUMMARY ===');
    console.log(`Total registrations without tickets: ${registrationsWithoutTickets.length}`);
    
    const withSelectedTickets = registrationsWithoutTickets.filter(reg => {
      const regData = reg.registrationData || reg.registration_data || {};
      return regData.selectedTickets && regData.selectedTickets.length > 0;
    });
    
    console.log(`Registrations with selectedTickets but no tickets: ${withSelectedTickets.length}`);
    
    const paidButNoTickets = registrationsWithoutTickets.filter(reg => 
      reg.paymentStatus === 'completed' || reg.paymentStatus === 'paid'
    );
    
    console.log(`Paid registrations without tickets: ${paidButNoTickets.length}`);
    
    // Save results to JSON
    const outputDir = path.join(process.cwd(), 'script-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `registrations-without-tickets-${timestamp}.json`);
    
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        totalWithoutTickets: registrationsWithoutTickets.length,
        byType: Object.fromEntries(byType),
        withSelectedTickets: withSelectedTickets.length,
        paidButNoTickets: paidButNoTickets.length
      },
      sampleAnalysis: analysisResults,
      allRegistrationIds: registrationsWithoutTickets.map(r => ({
        registrationId: r.registrationId,
        confirmationNumber: r.confirmationNumber,
        type: r.registrationType,
        paymentStatus: r.paymentStatus,
        hasSelectedTickets: !!((r.registrationData || r.registration_data)?.selectedTickets?.length)
      }))
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n✅ Analysis results saved to: ${outputFile}`);
    
    // Show which ones might be fixable
    console.log('\n=== POTENTIALLY FIXABLE ===');
    console.log(`Registrations with selectedTickets that could be converted: ${withSelectedTickets.length}`);
    if (withSelectedTickets.length > 0) {
      console.log('\nFirst 5 examples:');
      withSelectedTickets.slice(0, 5).forEach(reg => {
        const regData = reg.registrationData || reg.registration_data || {};
        console.log(`  - ${reg.confirmationNumber}: ${regData.selectedTickets.length} selectedTickets`);
      });
    }
    
    return {
      registrationsWithoutTickets,
      analysisResults
    };
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the analysis
if (require.main === module) {
  analyzeRegistrationsWithoutTickets().catch(console.error);
}

export { analyzeRegistrationsWithoutTickets };