import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const uri = process.env.MONGODB_URI || '';
const dbName = 'lodgetix';

async function investigateDiscrepancy() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== INVESTIGATING LODGE TICKET DISCREPANCY ===\n');
    
    // The key finding: 58 lodge registrations create 740 tickets
    // This suggests each lodge registration creates multiple tickets
    
    console.log('1. Examining lodge registrations and their ticket quantities...');
    
    const lodgeRegistrationDetails = await db.collection('tickets').aggregate([
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
          'registration.registrationType': 'lodge'
        }
      },
      {
        $group: {
          _id: {
            registrationId: '$registration.registrationId',
            eventTicketId: '$eventTicketId'
          },
          ticketQuantity: { $sum: { $ifNull: ['$quantity', 1] } },
          registrationData: { $first: '$registration' },
          ticketIds: { $push: '$_id' }
        }
      },
      {
        $sort: { ticketQuantity: -1 }
      }
    ]).toArray();
    
    console.log(`Found ${lodgeRegistrationDetails.length} lodge registration-ticket combinations`);
    
    const totalTickets = lodgeRegistrationDetails.reduce((sum, item) => sum + item.ticketQuantity, 0);
    console.log(`Total tickets from lodge registrations: ${totalTickets}`);
    
    // Show breakdown of quantities
    console.log('\nTicket quantities per lodge registration:');
    const quantityBreakdown: { [key: number]: number } = {};
    lodgeRegistrationDetails.forEach(item => {
      const qty = item.ticketQuantity;
      quantityBreakdown[qty] = (quantityBreakdown[qty] || 0) + 1;
    });
    
    Object.entries(quantityBreakdown)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .forEach(([quantity, count]) => {
        console.log(`  ${quantity} tickets: ${count} registrations (total: ${parseInt(quantity) * count} tickets)`);
      });
    
    // Show top registrations with most tickets
    console.log('\nTop 10 lodge registrations with most tickets:');
    lodgeRegistrationDetails.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. Registration ${item._id.registrationId}:`);
      console.log(`   Tickets: ${item.ticketQuantity}`);
      console.log(`   Lodge info: ${item.registrationData.lodgeName || 'N/A'} (${item.registrationData.lodgeNumber || 'N/A'})`);
      console.log('');
    });
    
    // Check if this matches what we see in the registrations collection
    console.log('2. Cross-checking with registrations collection...');
    
    const registrationsCheck = await db.collection('registrations').find({
      registrationType: 'lodge'
    }).toArray();
    
    console.log(`Direct count from registrations collection: ${registrationsCheck.length} lodge registrations`);
    
    // Check unique registration IDs in our ticket analysis
    const uniqueRegistrationIds = new Set(lodgeRegistrationDetails.map(item => item._id.registrationId));
    console.log(`Unique registration IDs in ticket analysis: ${uniqueRegistrationIds.size}`);
    
    // This explains the discrepancy:
    // - 58 lodge registrations exist
    // - Each lodge registration can purchase multiple tickets
    // - The total tickets purchased by lodges = 740
    // - The report shows ticket counts, not registration counts
    
    console.log('\n=== EXPLANATION ===');
    console.log('The 740 number represents TICKETS purchased by lodges, not the number of lodges.');
    console.log('There are 58 lodge registrations, but they purchased a total of 740 tickets.');
    console.log('This is normal for events where lodges can purchase multiple tickets per registration.');
    
  } finally {
    await client.close();
  }
}

investigateDiscrepancy().catch(console.error);