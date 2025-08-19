import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const LODGETIX_DB = 'LodgeTix-migration-test-1';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!LODGETIX_DB) {
  throw new Error('MONGODB_DB environment variable is required');
}

async function createSampleData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(LODGETIX_DB);
    
    console.log('\n🎨 Creating Sample LodgeTix Data\n');
    console.log('═'.repeat(60));
    
    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await db.collection('functions').deleteMany({});
    await db.collection('events').deleteMany({});
    await db.collection('eventTickets').deleteMany({});
    await db.collection('packages').deleteMany({});
    
    // Create sample functions
    console.log('\n📋 Creating Functions...');
    const functions = [
      {
        _id: new ObjectId(),
        name: 'Annual Grand Ball 2024',
        description: 'The most prestigious masonic event of the year',
        venue: 'Grand Hotel Ballroom',
        startDate: '2024-12-31',
        endDate: '2024-12-31',
        organizer: 'United Grand Lodge of NSW & ACT',
        organizerEmail: 'events@masons.au'
      },
      {
        _id: new ObjectId(),
        name: 'Spring Charity Gala',
        description: 'A charitable fundraising event for community projects',
        venue: 'Sydney Opera House',
        startDate: '2024-09-15',
        endDate: '2024-09-15',
        organizer: 'Lodge Harmony',
        organizerEmail: 'charity@harmony.org.au'
      },
      {
        _id: new ObjectId(),
        name: 'Installation Ceremony 2024',
        description: 'Annual installation of new officers',
        venue: 'Masonic Centre',
        startDate: '2024-06-20',
        endDate: '2024-06-20',
        organizer: 'Lodge Excellence',
        organizerEmail: 'secretary@excellence.lodge'
      }
    ];
    
    await db.collection('functions').insertMany(functions);
    console.log(`   ✅ Created ${functions.length} functions`);
    
    // Create events for each function
    console.log('\n📅 Creating Events...');
    const events = [];
    
    // Events for Annual Grand Ball
    events.push(
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'Cocktail Reception',
        date: '2024-12-31',
        time: '18:00',
        description: 'Welcome drinks and canapés',
        maxAttendees: 300
      },
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'Gala Dinner',
        date: '2024-12-31',
        time: '19:30',
        description: 'Five-course dinner with entertainment',
        maxAttendees: 250
      },
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'After Party',
        date: '2024-12-31',
        time: '23:00',
        description: 'DJ and dancing until late',
        maxAttendees: 200
      }
    );
    
    // Events for Spring Charity Gala
    events.push(
      {
        _id: new ObjectId(),
        functionId: functions[1]._id.toString(),
        name: 'Charity Auction',
        date: '2024-09-15',
        time: '17:00',
        description: 'Silent and live auction for charity',
        maxAttendees: 150
      },
      {
        _id: new ObjectId(),
        functionId: functions[1]._id.toString(),
        name: 'Gala Dinner',
        date: '2024-09-15',
        time: '19:00',
        description: 'Three-course dinner',
        maxAttendees: 150
      }
    );
    
    // Event for Installation Ceremony
    events.push(
      {
        _id: new ObjectId(),
        functionId: functions[2]._id.toString(),
        name: 'Installation Ceremony',
        date: '2024-06-20',
        time: '14:00',
        description: 'Formal installation ceremony',
        maxAttendees: 100
      },
      {
        _id: new ObjectId(),
        functionId: functions[2]._id.toString(),
        name: 'Festive Board',
        date: '2024-06-20',
        time: '17:00',
        description: 'Traditional festive board dinner',
        maxAttendees: 100
      }
    );
    
    await db.collection('events').insertMany(events);
    console.log(`   ✅ Created ${events.length} events`);
    
    // Create tickets for each event
    console.log('\n🎫 Creating Event Tickets...');
    const tickets = [];
    
    // Tickets for Cocktail Reception
    tickets.push(
      {
        _id: new ObjectId(),
        eventId: events[0]._id.toString(),
        name: 'Standard Entry',
        price: 150,
        quantity: 250,
        description: 'Access to cocktail reception',
        earlyBird: true,
        earlyBirdPrice: 120,
        earlyBirdEndDate: '2024-11-30'
      },
      {
        _id: new ObjectId(),
        eventId: events[0]._id.toString(),
        name: 'VIP Entry',
        price: 250,
        quantity: 50,
        description: 'Premium bar access and reserved seating',
        earlyBird: true,
        earlyBirdPrice: 200,
        earlyBirdEndDate: '2024-11-30'
      }
    );
    
    // Tickets for Gala Dinner (Grand Ball)
    tickets.push(
      {
        _id: new ObjectId(),
        eventId: events[1]._id.toString(),
        name: 'Standard Seat',
        price: 350,
        quantity: 200,
        description: 'Dinner and entertainment',
        earlyBird: true,
        earlyBirdPrice: 300,
        earlyBirdEndDate: '2024-11-30'
      },
      {
        _id: new ObjectId(),
        eventId: events[1]._id.toString(),
        name: 'Premium Table',
        price: 500,
        quantity: 50,
        description: 'Premium table position with wine',
        earlyBird: true,
        earlyBirdPrice: 450,
        earlyBirdEndDate: '2024-11-30'
      }
    );
    
    // Tickets for After Party
    tickets.push(
      {
        _id: new ObjectId(),
        eventId: events[2]._id.toString(),
        name: 'Party Entry',
        price: 100,
        quantity: 200,
        description: 'After party access',
        earlyBird: false
      }
    );
    
    // Tickets for Charity events
    tickets.push(
      {
        _id: new ObjectId(),
        eventId: events[3]._id.toString(),
        name: 'Auction Entry',
        price: 50,
        quantity: 150,
        description: 'Access to charity auction',
        earlyBird: false
      },
      {
        _id: new ObjectId(),
        eventId: events[4]._id.toString(),
        name: 'Charity Dinner',
        price: 200,
        quantity: 150,
        description: 'Three-course dinner for charity',
        earlyBird: true,
        earlyBirdPrice: 180,
        earlyBirdEndDate: '2024-08-31'
      }
    );
    
    // Tickets for Installation
    tickets.push(
      {
        _id: new ObjectId(),
        eventId: events[5]._id.toString(),
        name: 'Member Ticket',
        price: 0,
        quantity: 80,
        description: 'Free for lodge members',
        earlyBird: false
      },
      {
        _id: new ObjectId(),
        eventId: events[5]._id.toString(),
        name: 'Guest Ticket',
        price: 50,
        quantity: 20,
        description: 'Guest attendance',
        earlyBird: false
      },
      {
        _id: new ObjectId(),
        eventId: events[6]._id.toString(),
        name: 'Festive Board',
        price: 80,
        quantity: 100,
        description: 'Traditional dinner',
        earlyBird: true,
        earlyBirdPrice: 70,
        earlyBirdEndDate: '2024-05-31'
      }
    );
    
    await db.collection('eventTickets').insertMany(tickets);
    console.log(`   ✅ Created ${tickets.length} ticket types`);
    
    // Create packages
    console.log('\n📦 Creating Packages...');
    const packages = [
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'Full Experience Package',
        description: 'Access to all three events - save $100!',
        tickets: [
          { eventId: events[0]._id.toString(), ticketId: tickets[0]._id.toString(), quantity: 1 },
          { eventId: events[1]._id.toString(), ticketId: tickets[2]._id.toString(), quantity: 1 },
          { eventId: events[2]._id.toString(), ticketId: tickets[4]._id.toString(), quantity: 1 }
        ],
        price: 500,
        savings: 100
      },
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'Couples Package',
        description: 'Perfect for couples - 2x Gala Dinner tickets',
        tickets: [
          { eventId: events[1]._id.toString(), ticketId: tickets[2]._id.toString(), quantity: 2 }
        ],
        price: 650,
        savings: 50
      },
      {
        _id: new ObjectId(),
        functionId: functions[0]._id.toString(),
        name: 'VIP All Access',
        description: 'VIP access to all events',
        tickets: [
          { eventId: events[0]._id.toString(), ticketId: tickets[1]._id.toString(), quantity: 1 },
          { eventId: events[1]._id.toString(), ticketId: tickets[3]._id.toString(), quantity: 1 },
          { eventId: events[2]._id.toString(), ticketId: tickets[4]._id.toString(), quantity: 1 }
        ],
        price: 800,
        savings: 50
      },
      {
        _id: new ObjectId(),
        functionId: functions[1]._id.toString(),
        name: 'Charity Complete Package',
        description: 'Auction and dinner combo',
        tickets: [
          { eventId: events[3]._id.toString(), ticketId: tickets[5]._id.toString(), quantity: 1 },
          { eventId: events[4]._id.toString(), ticketId: tickets[6]._id.toString(), quantity: 1 }
        ],
        price: 230,
        savings: 20
      }
    ];
    
    await db.collection('packages').insertMany(packages);
    console.log(`   ✅ Created ${packages.length} packages`);
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ Sample Data Created Successfully!\n');
    console.log('   Summary:');
    console.log(`   - ${functions.length} Functions`);
    console.log(`   - ${events.length} Events`);
    console.log(`   - ${tickets.length} Ticket types`);
    console.log(`   - ${packages.length} Packages`);
    console.log('\n   Database: LodgeTix-migration-test-1');
    console.log('\n   You can now run the migration:');
    console.log('   npm run migrate:lodgetix');
    console.log('\n   NOTE: This script creates sample data. For real migration,');
    console.log('   the LodgeTix-migration-test-1 database should contain actual data.');
    
  } catch (error) {
    console.error('\n❌ Error creating sample data:', error);
  } finally {
    await client.close();
  }
}

// Run the script
createSampleData().catch(console.error);