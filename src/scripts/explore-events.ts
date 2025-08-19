import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { EventsRepository } from '../repositories/events.repository';

async function exploreEvents() {
  try {
    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const eventsRepo = new EventsRepository(db);
    
    console.log('🔍 Exploring Events Collection\n');
    
    // 1. Count total documents
    const totalCount = await eventsRepo.count();
    console.log(`📊 Total events: ${totalCount}\n`);
    
    // 2. Get a sample event to see structure
    console.log('📄 Sample Event Structure:');
    const sampleEvent = await eventsRepo.findOne({});
    if (sampleEvent) {
      console.log(JSON.stringify(sampleEvent, null, 2));
      
      // Show all field names
      console.log('\n🔑 Fields found in this event:');
      Object.keys(sampleEvent).forEach(key => {
        const value = sampleEvent[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  - ${key}: ${type}`);
      });
    }
    
    // 3. Get first 5 events
    console.log('\n📋 First 5 Events:');
    const cursor = eventsRepo.find({});
    const events = await cursor.limit(5).toArray();
    events.forEach((event: any, index: number) => {
      console.log(`\n${index + 1}. ${event.name || 'Unnamed Event'}`);
      console.log(`   ID: ${event._id}`);
      if (event.start_date) console.log(`   Start: ${event.start_date}`);
      if (event.organisation_id) console.log(`   Org ID: ${event.organisation_id}`);
    });
    
    // 4. Find unique field names across all events
    console.log('\n🔍 Analyzing all events for unique fields...');
    const allCursor = eventsRepo.find({});
    const allEvents = await allCursor.toArray();
    const allFields = new Set<string>();
    
    allEvents.forEach((event: any) => {
      Object.keys(event).forEach(key => allFields.add(key));
    });
    
    console.log('\n📊 All unique fields in events collection:');
    Array.from(allFields).sort().forEach(field => {
      console.log(`  - ${field}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the exploration
exploreEvents();