import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI environment variable');
}

if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY environment variables');
}

// Use service role key if available for write operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

async function syncMongoDBTicketCountsToSupabase(dryRun = false) {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    // Connect to MongoDB
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    
    const db = mongoClient.db(MONGODB_DATABASE);
    console.log(`Using database: ${MONGODB_DATABASE}`);
    
    // Fetch data from eventTickets_computed view which includes ticket_counts data
    console.log('\nFetching ticket counts from MongoDB eventTickets_computed view...');
    const ticketCounts = await db.collection('eventTickets_computed')
      .find({})
      .toArray();
    
    console.log(`Found ${ticketCounts.length} event tickets to sync\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];
    
    // Update each event ticket in Supabase
    for (const ticket of ticketCounts) {
      try {
        console.log(`Updating ${ticket.name} (${ticket.eventTicketId})...`);
        console.log(`  - sold_count: ${ticket.soldCount}`);
        console.log(`  - reserved_count: ${ticket.reservedCount}`);
        console.log(`  - available_count: ${ticket.availableCount}`);
        console.log(`  - total_capacity: ${ticket.totalCapacity}`);
        console.log(`  - utilization_rate: ${ticket.utilizationRate}%`);
        
        const updateData = {
          sold_count: ticket.soldCount || 0,
          reserved_count: ticket.reservedCount || 0,
          available_count: ticket.availableCount || 0,
          total_capacity: ticket.totalCapacity || 0,
          updated_at: new Date().toISOString()
        };
        
        let data, error;
        
        if (!dryRun) {
          const result = await supabase
            .from('event_tickets')
            .update(updateData)
            .eq('event_ticket_id', ticket.eventTicketId)
            .select();
          
          data = result.data;
          error = result.error;
          
          // Check if update actually worked
          if (!error && data && data.length > 0) {
            const updated = data[0];
            if (updated.sold_count !== updateData.sold_count) {
              console.warn(`  ⚠️  Update returned success but values didn't change`);
              console.warn(`     Expected sold_count: ${updateData.sold_count}, Actual: ${updated.sold_count}`);
            }
          }
        } else {
          // In dry run, just check if the record exists
          const checkResult = await supabase
            .from('event_tickets')
            .select('event_ticket_id')
            .eq('event_ticket_id', ticket.eventTicketId);
          
          data = checkResult.data;
          error = checkResult.error;
        }
        
        if (error) {
          console.error(`  ❌ Error: ${error.message}`);
          errorCount++;
          errors.push({
            ticket: ticket.name,
            eventTicketId: ticket.eventTicketId,
            error: error.message
          });
        } else if (dryRun && (!data || data.length === 0)) {
          console.warn(`  ⚠️  No matching record found in Supabase`);
          errorCount++;
          errors.push({
            ticket: ticket.name,
            eventTicketId: ticket.eventTicketId,
            error: 'No matching record found in Supabase'
          });
        } else {
          if (dryRun) {
            console.log(`  ✅ Would update successfully`);
          } else {
            console.log(`  ✅ Updated successfully`);
          }
          successCount++;
        }
        
      } catch (error) {
        console.error(`  ❌ Unexpected error: ${error}`);
        errorCount++;
        errors.push({
          ticket: ticket.name,
          eventTicketId: ticket.eventTicketId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total tickets processed: ${ticketCounts.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nERROR DETAILS:');
      errors.forEach(err => {
        console.log(`- ${err.ticket} (${err.eventTicketId}): ${err.error}`);
      });
    }
    
    // Verify updates by fetching from Supabase
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION - Top 10 tickets by sold count:');
    console.log('='.repeat(50));
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('event_tickets')
      .select('event_ticket_id, name, sold_count, reserved_count, available_count, total_capacity')
      .order('sold_count', { ascending: false })
      .limit(10);
    
    if (verifyError) {
      console.error('Error verifying updates:', verifyError);
    } else if (verifyData) {
      verifyData.forEach(ticket => {
        console.log(`${ticket.name}:`);
        console.log(`  Sold: ${ticket.sold_count}, Reserved: ${ticket.reserved_count}, Available: ${ticket.available_count}/${ticket.total_capacity}`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await mongoClient.close();
    console.log('\nMongoDB connection closed');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Run the sync
console.log('Starting MongoDB to Supabase ticket counts sync...\n');
syncMongoDBTicketCountsToSupabase(dryRun)
  .then(() => console.log('\nSync completed successfully!'))
  .catch(err => {
    console.error('\nSync failed:', err);
    process.exit(1);
  });