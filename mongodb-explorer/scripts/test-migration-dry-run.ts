import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const LODGETIX_DB = process.env.LODGETIX_SOURCE_DB || 'LodgeTix-migration-test-1';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

async function analyzeLodgeTixData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(LODGETIX_DB);
    
    console.log('\n🔍 Analyzing LodgeTix Data for Migration\n');
    console.log('═'.repeat(60));
    
    // Analyze functions
    console.log('\n📋 Functions:');
    const functions = await db.collection('functions').find({}).toArray();
    console.log(`   Total: ${functions.length}`);
    
    if (functions.length > 0) {
      console.log('\n   Sample functions:');
      functions.slice(0, 3).forEach(func => {
        console.log(`   - ${func.name}`);
        console.log(`     Venue: ${func.venue || 'Not specified'}`);
        console.log(`     Dates: ${func.startDate} to ${func.endDate}`);
        console.log(`     Organizer: ${func.organizer || 'Not specified'}`);
      });
    }
    
    // Analyze events
    console.log('\n📅 Events:');
    const events = await db.collection('events').find({}).toArray();
    console.log(`   Total: ${events.length}`);
    
    // Group events by function
    const eventsByFunction: Record<string, number> = {};
    events.forEach(event => {
      const funcId = event.functionId || 'no-function';
      eventsByFunction[funcId] = (eventsByFunction[funcId] || 0) + 1;
    });
    
    console.log(`   Functions with events: ${Object.keys(eventsByFunction).length}`);
    console.log(`   Average events per function: ${(events.length / functions.length).toFixed(1)}`);
    
    // Analyze tickets
    console.log('\n🎫 Event Tickets:');
    const tickets = await db.collection('eventTickets').find({}).toArray();
    console.log(`   Total: ${tickets.length}`);
    
    // Group tickets by event
    const ticketsByEvent: Record<string, number> = {};
    tickets.forEach(ticket => {
      const eventId = ticket.eventId || 'no-event';
      ticketsByEvent[eventId] = (ticketsByEvent[eventId] || 0) + 1;
    });
    
    console.log(`   Events with tickets: ${Object.keys(ticketsByEvent).length}`);
    console.log(`   Average tickets per event: ${(tickets.length / events.length).toFixed(1)}`);
    
    // Price analysis
    const prices = tickets.map(t => t.price || 0).filter(p => p > 0);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      console.log(`   Price range: R${minPrice} - R${maxPrice}`);
      console.log(`   Average price: R${avgPrice.toFixed(2)}`);
    }
    
    // Analyze packages
    console.log('\n📦 Packages:');
    const packages = await db.collection('packages').find({}).toArray();
    console.log(`   Total: ${packages.length}`);
    
    if (packages.length > 0) {
      console.log('\n   Sample packages:');
      packages.slice(0, 3).forEach(pkg => {
        console.log(`   - ${pkg.name}`);
        console.log(`     Price: R${pkg.price || 0}`);
        console.log(`     Tickets: ${pkg.tickets?.length || 0} items`);
      });
    }
    
    // Migration preview
    console.log('\n' + '═'.repeat(60));
    console.log('\n🎯 Migration Preview:\n');
    console.log('   This migration will create:');
    console.log(`   - ${functions.length} Product Collections (from functions)`);
    console.log(`   - ${events.length} Products (from events)`);
    console.log(`   - ${tickets.length} Product Variants (from tickets)`);
    console.log(`   - ${packages.length} Bundle Products (from packages)`);
    console.log(`   - ${functions.length} Vendors (from organizers)`);
    console.log(`   - ${functions.length} Stock Locations (from venues)`);
    console.log(`   - ${tickets.length * 2} Inventory records (items + levels)`);
    
    // Check for potential issues
    console.log('\n⚠️  Potential Issues:');
    
    // Check for orphaned events
    const functionIds = new Set(functions.map(f => f._id.toString()));
    const orphanedEvents = events.filter(e => !functionIds.has(e.functionId));
    if (orphanedEvents.length > 0) {
      console.log(`   - ${orphanedEvents.length} events without valid function`);
    }
    
    // Check for orphaned tickets
    const eventIds = new Set(events.map(e => e._id.toString()));
    const orphanedTickets = tickets.filter(t => !eventIds.has(t.eventId));
    if (orphanedTickets.length > 0) {
      console.log(`   - ${orphanedTickets.length} tickets without valid event`);
    }
    
    // Check for missing prices
    const ticketsWithoutPrice = tickets.filter(t => !t.price || t.price === 0);
    if (ticketsWithoutPrice.length > 0) {
      console.log(`   - ${ticketsWithoutPrice.length} tickets without price`);
    }
    
    // Check for missing quantities
    const ticketsWithoutQuantity = tickets.filter(t => !t.quantity || t.quantity === 0);
    if (ticketsWithoutQuantity.length > 0) {
      console.log(`   - ${ticketsWithoutQuantity.length} tickets without quantity`);
    }
    
    if (orphanedEvents.length === 0 && orphanedTickets.length === 0 && 
        ticketsWithoutPrice.length === 0 && ticketsWithoutQuantity.length === 0) {
      console.log('   ✅ No issues detected!');
    }
    
    console.log('\n💡 To run the actual migration:');
    console.log('   npm run migrate:lodgetix');
    console.log('\n   To clear existing data first:');
    console.log('   npm run migrate:lodgetix -- --clear');
    
  } catch (error) {
    console.error('Error analyzing data:', error);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeLodgeTixData().catch(console.error);