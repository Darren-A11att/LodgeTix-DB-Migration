import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const uri = process.env.MONGODB_URI || '';
const dbName = 'lodgetix';

async function investigateLodgeCount() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== INVESTIGATING LODGE COUNT IN EVENT TICKETS REPORT ===\n');
    
    // Check tickets collection with lodge registrations
    console.log('1. Checking tickets with lodge registrations...');
    const ticketsByType = await db.collection('tickets').aggregate([
      {
        $lookup: {
          from: 'registrations',
          localField: 'details.registrationId',
          foreignField: 'registrationId',
          as: 'registration'
        }
      },
      {
        $unwind: '$registration'
      },
      {
        $match: {
          'registration.registrationType': { $in: ['lodges', 'lodge', 'Lodge', 'Lodges'] }
        }
      },
      {
        $group: {
          _id: {
            eventTicketId: '$eventTicketId',
            registrationType: '$registration.registrationType'
          },
          count: { $sum: { $ifNull: ['$quantity', 1] } },
          tickets: { $push: '$_id' }
        }
      },
      {
        $group: {
          _id: '$_id.eventTicketId',
          totalLodgeTickets: { $sum: '$count' },
          registrationTypes: { $push: { type: '$_id.registrationType', count: '$count' } }
        }
      },
      {
        $sort: { totalLodgeTickets: -1 }
      }
    ]).toArray();
    
    console.log(`Found ${ticketsByType.length} event tickets with lodge registrations`);
    
    const totalLodgeTickets = ticketsByType.reduce((sum, item) => sum + item.totalLodgeTickets, 0);
    console.log(`Total lodge tickets across all event tickets: ${totalLodgeTickets}`);
    
    // Show top 10 event tickets with most lodge tickets
    console.log('\nTop 10 event tickets with most lodge tickets:');
    ticketsByType.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. Event Ticket ID: ${item._id}`);
      console.log(`   Lodge tickets: ${item.totalLodgeTickets}`);
      console.log(`   Registration types: ${JSON.stringify(item.registrationTypes)}`);
      console.log('');
    });
    
    // Check what registration types exist
    console.log('2. Checking all registration types in the system...');
    const allRegTypes = await db.collection('registrations').aggregate([
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    console.log('All registration types:');
    allRegTypes.forEach(type => {
      console.log(`- ${type._id}: ${type.count} registrations`);
    });
    
    // Check specific case sensitivity
    console.log('\n3. Checking case variations of lodge registration types...');
    const lodgeVariations = await db.collection('registrations').aggregate([
      {
        $match: {
          registrationType: { $regex: /lodge/i }
        }
      },
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('Lodge registration type variations:');
    lodgeVariations.forEach(type => {
      console.log(`- "${type._id}": ${type.count} registrations`);
    });
    
    // Check how the current report calculation works
    console.log('\n4. Testing the exact aggregation used in the report...');
    const reportAggregation = await db.collection('tickets').aggregate([
      {
        $lookup: {
          from: 'registrations',
          localField: 'details.registrationId',
          foreignField: 'registrationId',
          as: 'registration'
        }
      },
      {
        $unwind: '$registration'
      },
      {
        $group: {
          _id: {
            eventTicketId: '$eventTicketId',
            registrationType: '$registration.registrationType'
          },
          count: { $sum: { $ifNull: ['$quantity', 1] } }
        }
      },
      {
        $group: {
          _id: '$_id.eventTicketId',
          types: {
            $push: {
              type: '$_id.registrationType',
              count: '$count'
            }
          }
        }
      }
    ]).toArray();
    
    // Process like the report does
    let totalLodges = 0;
    let totalIndividuals = 0;
    let totalDelegations = 0;
    
    reportAggregation.forEach(item => {
      item.types.forEach((t: any) => {
        const type = (t.type || '').toLowerCase();
        if (type === 'lodges' || type === 'lodge') {
          totalLodges += t.count;
        } else if (type === 'individuals' || type === 'individual') {
          totalIndividuals += t.count;
        } else if (type === 'delegations' || type === 'delegation') {
          totalDelegations += t.count;
        }
      });
    });
    
    console.log('\nReport calculation results:');
    console.log(`Total lodges: ${totalLodges}`);
    console.log(`Total individuals: ${totalIndividuals}`);
    console.log(`Total delegations: ${totalDelegations}`);
    
  } finally {
    await client.close();
  }
}

investigateLodgeCount().catch(console.error);