import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';

interface EventTicket {
  _id?: any;
  eventTicketId: string;
  name: string;
  price: number;
  eventId: string;
  [key: string]: any;
}

interface IncludedItem {
  eventTicketId: string;
  quantity: number;
  // Fields to be added
  name?: string;
  price?: number;
  eventId?: string;
}

interface Package {
  _id: any;
  packageId: string;
  includedItems: IncludedItem[];
  [key: string]: any;
}

async function enrichPackageIncludedItems() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔄 Starting to enrich includedItems in packages...\n');
    
    // Connect to MongoDB
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Step 1: Fetch all eventTickets and create lookup map
    console.log('\n📋 Fetching all eventTickets...');
    const eventTickets = await eventTicketsCollection.find({}).toArray() as EventTicket[];
    console.log(`✅ Found ${eventTickets.length} eventTickets`);
    
    // Create lookup map for fast access
    const ticketLookup = new Map<string, EventTicket>();
    eventTickets.forEach(ticket => {
      // Try both eventTicketId and event_ticket_id for compatibility
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      if (ticketId) {
        ticketLookup.set(ticketId, ticket);
      }
    });
    console.log(`✅ Created lookup map with ${ticketLookup.size} tickets\n`);
    
    // Step 2: Fetch all packages
    console.log('📦 Fetching all packages...');
    const packages = await packagesCollection.find({}).toArray() as Package[];
    console.log(`✅ Found ${packages.length} packages\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let itemsEnrichedCount = 0;
    let itemsNotFoundCount = 0;
    
    // Step 3: Process each package
    console.log('🔄 Processing packages...');
    console.log('='.repeat(60));
    
    for (const pkg of packages) {
      try {
        console.log(`\n📦 Processing package: ${pkg.name || pkg.packageId}`);
        
        if (!pkg.includedItems || !Array.isArray(pkg.includedItems)) {
          console.log('   ⚠️  No includedItems array found, skipping...');
          continue;
        }
        
        console.log(`   Found ${pkg.includedItems.length} included items`);
        
        // Enrich each included item
        let enrichedCount = 0;
        const enrichedItems = pkg.includedItems.map(item => {
          const ticket = ticketLookup.get(item.eventTicketId);
          
          if (ticket) {
            // Add the requested fields
            const enrichedItem: IncludedItem = {
              ...item,
              name: ticket.name,
              price: ticket.price,
              eventId: ticket.eventId || ticket.event_id
            };
            
            console.log(`   ✅ Enriched: ${ticket.name} (${item.eventTicketId})`);
            enrichedCount++;
            itemsEnrichedCount++;
            
            return enrichedItem;
          } else {
            console.log(`   ❌ Ticket not found: ${item.eventTicketId}`);
            itemsNotFoundCount++;
            return item; // Keep original if not found
          }
        });
        
        // Update the package with enriched items
        const result = await packagesCollection.updateOne(
          { _id: pkg._id },
          { 
            $set: { 
              includedItems: enrichedItems,
              lastEnriched: new Date().toISOString()
            } 
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`   ✅ Package updated with ${enrichedCount} enriched items`);
          successCount++;
        } else {
          console.log(`   ℹ️  Package not modified (may already be enriched)`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing package ${pkg.packageId}:`, error);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ENRICHMENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${successCount} packages`);
    console.log(`❌ Errors encountered: ${errorCount} packages`);
    console.log(`📦 Total packages: ${packages.length}`);
    console.log(`✅ Items enriched: ${itemsEnrichedCount}`);
    console.log(`❌ Items not found: ${itemsNotFoundCount}`);
    console.log('='.repeat(60));
    
    // Sample verification
    if (successCount > 0) {
      console.log('\n🔍 Verifying a sample enriched package...');
      const samplePackage = await packagesCollection.findOne({ lastEnriched: { $exists: true } });
      
      if (samplePackage && samplePackage.includedItems && samplePackage.includedItems.length > 0) {
        console.log('\nSample enriched includedItems:');
        const sampleItem = samplePackage.includedItems[0];
        console.log('- Event Ticket ID:', sampleItem.eventTicketId);
        console.log('- Name:', sampleItem.name);
        console.log('- Price:', sampleItem.price);
        console.log('- Event ID:', sampleItem.eventId);
        console.log('- Quantity:', sampleItem.quantity);
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error during enrichment:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the enrichment
console.log('🚀 Package IncludedItems Enrichment Script');
console.log('='.repeat(60));
enrichPackageIncludedItems().catch(console.error);