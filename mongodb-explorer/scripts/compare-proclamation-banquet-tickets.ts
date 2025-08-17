import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

const EVENT_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
const TEST_DB = 'LodgeTix-migration-test-1';
const LODGETIX_DB = 'lodgetix';

class ProclamationBanquetTicketComparer {
  private client: MongoClient;
  private testDb: Db;
  private lodgetixDb: Db;

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    this.testDb = this.client.db(TEST_DB);
    this.lodgetixDb = this.client.db(LODGETIX_DB);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`   Test DB: ${TEST_DB}`);
    console.log(`   Production DB: ${LODGETIX_DB}`);
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  async compareTickets() {
    console.log('\n🎫 PROCLAMATION BANQUET TICKET COMPARISON');
    console.log('═'.repeat(60));
    console.log(`Event Ticket ID: ${EVENT_TICKET_ID}`);
    console.log('═'.repeat(60));

    // Get tickets from both databases
    const testTickets = await this.getTicketsFromDb(this.testDb, 'TEST');
    const lodgetixTickets = await this.getTicketsFromDb(this.lodgetixDb, 'LODGETIX');

    // Calculate summaries
    const testSummary = this.calculateSummary(testTickets, 'TEST');
    const lodgetixSummary = this.calculateSummary(lodgetixTickets, 'LODGETIX');

    // Display summaries
    this.displaySummary(testSummary);
    this.displaySummary(lodgetixSummary);

    // Find missing tickets
    console.log('\n🔍 FINDING MISSING TICKETS');
    console.log('─'.repeat(40));
    
    const missingTickets = this.findMissingTickets(testTickets, lodgetixTickets);
    
    if (missingTickets.length > 0) {
      console.log(`\n❌ FOUND ${missingTickets.length} TICKETS IN TEST BUT NOT IN LODGETIX:`);
      console.log('─'.repeat(60));
      
      for (const ticket of missingTickets) {
        console.log(`\nMissing Ticket:`);
        console.log(`  ID: ${ticket._id}`);
        console.log(`  Registration ID: ${ticket.registrationId || 'N/A'}`);
        console.log(`  Quantity: ${ticket.quantity || 1}`);
        console.log(`  Price: ${ticket.price || 'N/A'}`);
        console.log(`  Attendee ID: ${ticket.attendeeId || 'N/A'}`);
        console.log(`  Created: ${ticket.createdAt || 'N/A'}`);
      }

      // Analyze missing ticket patterns
      await this.analyzeRegistrationPatterns(missingTickets);
    } else {
      console.log('✅ No missing tickets found - all test tickets exist in lodgetix');
    }

    // Final analysis
    this.displayFinalAnalysis(testSummary, lodgetixSummary, missingTickets.length);
  }

  private async getTicketsFromDb(db: Db, dbName: string) {
    console.log(`\n🔍 Querying ${dbName} database...`);
    
    try {
      const tickets = await db.collection('tickets')
        .find({ eventTicketId: EVENT_TICKET_ID })
        .sort({ createdAt: 1 })
        .toArray();
      
      console.log(`  ✓ Found ${tickets.length} tickets in ${dbName}`);
      return tickets;
    } catch (error) {
      console.error(`  ❌ Error querying ${dbName}: ${error.message}`);
      return [];
    }
  }

  private calculateSummary(tickets: any[], dbName: string) {
    const documentCount = tickets.length;
    const quantitySum = tickets.reduce((sum, ticket) => {
      const quantity = ticket.quantity || 1;
      return sum + quantity;
    }, 0);

    const registrationIds = [...new Set(tickets.map(t => t.registrationId).filter(Boolean))];
    const attendeeIds = [...new Set(tickets.map(t => t.attendeeId).filter(Boolean))];

    return {
      dbName,
      documentCount,
      quantitySum,
      uniqueRegistrations: registrationIds.length,
      uniqueAttendees: attendeeIds.length,
      registrationIds,
      attendeeIds,
      tickets
    };
  }

  private displaySummary(summary: any) {
    console.log(`\n📊 ${summary.dbName} DATABASE SUMMARY:`);
    console.log('─'.repeat(30));
    console.log(`  Document Count: ${summary.documentCount}`);
    console.log(`  Quantity Sum: ${summary.quantitySum}`);
    console.log(`  Unique Registrations: ${summary.uniqueRegistrations}`);
    console.log(`  Unique Attendees: ${summary.uniqueAttendees}`);
  }

  private findMissingTickets(testTickets: any[], lodgetixTickets: any[]) {
    const lodgetixIds = new Set(lodgetixTickets.map(t => t._id.toString()));
    return testTickets.filter(ticket => !lodgetixIds.has(ticket._id.toString()));
  }

  private async analyzeRegistrationPatterns(missingTickets: any[]) {
    console.log(`\n🔬 ANALYZING MISSING TICKET PATTERNS`);
    console.log('─'.repeat(40));

    // Group by registration ID
    const byRegistration = new Map();
    missingTickets.forEach(ticket => {
      const regId = ticket.registrationId || 'NO_REG_ID';
      if (!byRegistration.has(regId)) {
        byRegistration.set(regId, []);
      }
      byRegistration.get(regId).push(ticket);
    });

    console.log(`\n📋 Missing tickets grouped by Registration ID:`);
    for (const [regId, tickets] of byRegistration) {
      const totalQuantity = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      console.log(`  ${regId}: ${tickets.length} tickets, ${totalQuantity} total quantity`);
    }

    // Check for date patterns
    const withDates = missingTickets.filter(t => t.createdAt).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (withDates.length > 0) {
      console.log(`\n📅 Date range of missing tickets:`);
      console.log(`  Earliest: ${withDates[0].createdAt}`);
      console.log(`  Latest: ${withDates[withDates.length - 1].createdAt}`);
    }

    // Check if these registrations exist in Supabase (if available)
    await this.checkRegistrationsInSupabase(Array.from(byRegistration.keys()));
  }

  private async checkRegistrationsInSupabase(registrationIds: string[]) {
    console.log(`\n🔗 CHECKING REGISTRATIONS IN SUPABASE`);
    console.log('─'.repeat(40));

    const validRegIds = registrationIds.filter(id => id !== 'NO_REG_ID');
    if (validRegIds.length === 0) {
      console.log('  ⚠️  No valid registration IDs to check');
      return;
    }

    try {
      // This would require Supabase client, but for now we'll just note what should be checked
      console.log(`\n📝 RECOMMENDED SUPABASE CHECKS:`);
      console.log(`  Check these registration IDs in the registrations table:`);
      for (const regId of validRegIds.slice(0, 10)) { // Show first 10
        console.log(`    - ${regId}`);
      }
      if (validRegIds.length > 10) {
        console.log(`    ... and ${validRegIds.length - 10} more`);
      }
      
      console.log(`\n  Look for patterns in:`);
      console.log(`    - payment_status (failed, pending, completed)`);
      console.log(`    - registration_type`);
      console.log(`    - created_at timestamps`);
      console.log(`    - registration_data structure`);
    } catch (error) {
      console.log(`  ⚠️  Cannot check Supabase: ${error.message}`);
    }
  }

  private displayFinalAnalysis(testSummary: any, lodgetixSummary: any, missingCount: number) {
    console.log(`\n🎯 FINAL ANALYSIS`);
    console.log('═'.repeat(50));
    
    const documentDiff = testSummary.documentCount - lodgetixSummary.documentCount;
    const quantityDiff = testSummary.quantitySum - lodgetixSummary.quantitySum;
    
    console.log(`\n📈 DIFFERENCES:`);
    console.log(`  Document Count Difference: ${documentDiff} (${testSummary.documentCount} - ${lodgetixSummary.documentCount})`);
    console.log(`  Quantity Sum Difference: ${quantityDiff} (${testSummary.quantitySum} - ${lodgetixSummary.quantitySum})`);
    console.log(`  Missing Tickets Found: ${missingCount}`);

    console.log(`\n🔍 LIKELY CAUSES:`);
    if (documentDiff > 0) {
      console.log(`  1. Data sync incomplete - ${documentDiff} tickets not migrated`);
      console.log(`  2. Registration processing failures during migration`);
      console.log(`  3. Failed/cancelled registrations included in test but filtered out in lodgetix`);
      console.log(`  4. Duplicate tickets in test database`);
    }

    if (quantityDiff !== documentDiff) {
      console.log(`  5. Quantity field inconsistencies between databases`);
    }

    console.log(`\n💡 RECOMMENDATIONS:`);
    console.log(`  1. Review the missing registration IDs in Supabase`);
    console.log(`  2. Check sync logs for failed/skipped registrations`);
    console.log(`  3. Verify data consistency rules between test and production`);
    console.log(`  4. Consider running incremental sync for missing tickets`);
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Test DB has ${testSummary.documentCount} documents (${testSummary.quantitySum} quantity)`);
    console.log(`  Lodgetix DB has ${lodgetixSummary.documentCount} documents (${lodgetixSummary.quantitySum} quantity)`);
    console.log(`  Difference: ${documentDiff} documents (${quantityDiff} quantity)`);
  }
}

async function main() {
  const comparer = new ProclamationBanquetTicketComparer();
  
  try {
    await comparer.connect();
    await comparer.compareTickets();
  } finally {
    await comparer.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ProclamationBanquetTicketComparer };