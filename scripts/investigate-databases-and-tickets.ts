import { MongoClient, Db } from 'mongodb';
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

class DatabaseTicketInvestigator {
  private client: MongoClient;

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    console.log('✅ Connected to MongoDB Atlas');
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  async investigate() {
    console.log('\n🔍 DATABASE AND TICKET INVESTIGATION');
    console.log('═'.repeat(60));
    console.log(`Event Ticket ID: ${EVENT_TICKET_ID}`);
    console.log('═'.repeat(60));

    // First, list all available databases
    await this.listDatabases();

    // Check tickets in potential database names
    const potentialDbs = [
      'test',
      'lodgetix', 
      'LodgeTix-test',
      'LodgeTix-migration-test-1',
      'LodgeTix-production',
      'commerce-test'
    ];

    for (const dbName of potentialDbs) {
      await this.checkTicketsInDatabase(dbName);
    }

    // Also check for tickets with similar event IDs or field variations
    await this.searchForSimilarTickets();
  }

  private async listDatabases() {
    console.log('\n📚 AVAILABLE DATABASES:');
    console.log('─'.repeat(30));
    
    try {
      const adminDb = this.client.db('admin');
      const databasesList = await adminDb.admin().listDatabases();
      
      for (const dbInfo of databasesList.databases) {
        console.log(`  📁 ${dbInfo.name} (${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (error) {
      console.error(`  ❌ Error listing databases: ${error.message}`);
    }
  }

  private async checkTicketsInDatabase(dbName: string) {
    console.log(`\n🎫 CHECKING TICKETS IN: ${dbName}`);
    console.log('─'.repeat(40));
    
    try {
      const db = this.client.db(dbName);
      
      // First, check if tickets collection exists
      const collections = await db.listCollections({ name: 'tickets' }).toArray();
      if (collections.length === 0) {
        console.log(`  ⚠️  No 'tickets' collection found in ${dbName}`);
        
        // List all collections in this database
        const allCollections = await db.listCollections().toArray();
        if (allCollections.length > 0) {
          console.log(`  📂 Available collections: ${allCollections.map(c => c.name).join(', ')}`);
        }
        return;
      }

      // Check total tickets in collection
      const totalTickets = await db.collection('tickets').countDocuments();
      console.log(`  📊 Total tickets in ${dbName}: ${totalTickets}`);

      // Check tickets with exact eventTicketId match
      const exactMatches = await db.collection('tickets')
        .countDocuments({ eventTicketId: EVENT_TICKET_ID });
      console.log(`  🎯 Exact eventTicketId matches: ${exactMatches}`);

      // Check for different field name variations
      const fieldVariations = [
        'eventTicketId',
        'event_ticket_id', 
        'eventId',
        'event_id',
        'ticketId',
        'ticket_id'
      ];

      for (const field of fieldVariations) {
        const count = await db.collection('tickets')
          .countDocuments({ [field]: EVENT_TICKET_ID });
        if (count > 0) {
          console.log(`  ✓ Found ${count} tickets with ${field}: ${EVENT_TICKET_ID}`);
          
          // Get sample tickets to examine structure
          const samples = await db.collection('tickets')
            .find({ [field]: EVENT_TICKET_ID })
            .limit(3)
            .toArray();
          
          console.log(`  📋 Sample ticket fields: ${Object.keys(samples[0] || {}).join(', ')}`);
          
          // Calculate quantity sum for this field
          const quantitySum = samples.reduce((sum, ticket) => {
            return sum + (ticket.quantity || 1);
          }, 0) * (count / Math.min(samples.length, count));
          
          console.log(`  📊 Estimated quantity sum: ${quantitySum.toFixed(0)}`);
        }
      }

      // Also check for partial matches (in case of UUID variations)
      const partialMatch = EVENT_TICKET_ID.substring(0, 8);
      const partialMatches = await db.collection('tickets')
        .find({ eventTicketId: { $regex: partialMatch } })
        .limit(5)
        .toArray();

      if (partialMatches.length > 0) {
        console.log(`  🔍 Found ${partialMatches.length} tickets with partial eventTicketId match:`);
        partialMatches.forEach(ticket => {
          console.log(`    - ${ticket.eventTicketId} (${ticket.quantity || 1} qty)`);
        });
      }

    } catch (error) {
      console.log(`  ❌ Error checking ${dbName}: ${error.message}`);
    }
  }

  private async searchForSimilarTickets() {
    console.log(`\n🔍 SEARCHING FOR SIMILAR EVENT TICKET IDs`);
    console.log('─'.repeat(50));

    const databases = ['test', 'lodgetix'];
    
    for (const dbName of databases) {
      try {
        const db = this.client.db(dbName);
        
        // Get unique eventTicketIds to see what's available
        const uniqueIds = await db.collection('tickets')
          .distinct('eventTicketId');
        
        console.log(`\n📋 Unique eventTicketIds in ${dbName} (showing first 10):`);
        uniqueIds.slice(0, 10).forEach(id => {
          console.log(`  - ${id}`);
        });
        
        if (uniqueIds.length > 10) {
          console.log(`  ... and ${uniqueIds.length - 10} more`);
        }

        // Look for any IDs that might be related to "Proclamation" or "Banquet"
        console.log(`\n🔍 Searching for Proclamation/Banquet related tickets:`);
        
        const nameSearchResults = await db.collection('tickets')
          .find({ 
            $or: [
              { name: { $regex: /proclamation/i } },
              { name: { $regex: /banquet/i } },
              { title: { $regex: /proclamation/i } },
              { title: { $regex: /banquet/i } }
            ]
          })
          .limit(5)
          .toArray();
        
        if (nameSearchResults.length > 0) {
          console.log(`  ✓ Found ${nameSearchResults.length} tickets matching Proclamation/Banquet:`);
          nameSearchResults.forEach(ticket => {
            console.log(`    - ID: ${ticket.eventTicketId} | Name: ${ticket.name || ticket.title} | Qty: ${ticket.quantity || 1}`);
          });
        } else {
          console.log(`  ℹ️  No tickets found with Proclamation/Banquet in name/title`);
        }

      } catch (error) {
        console.log(`  ❌ Error searching ${dbName}: ${error.message}`);
      }
    }
  }
}

async function main() {
  const investigator = new DatabaseTicketInvestigator();
  
  try {
    await investigator.connect();
    await investigator.investigate();
  } finally {
    await investigator.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { DatabaseTicketInvestigator };