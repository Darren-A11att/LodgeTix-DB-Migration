import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix-reconcile';

async function verifyTicketCounts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    const eventTickets = db.collection('eventTickets');
    
    console.log('🔍 Verifying ticket counts...\n');
    
    // 1. Count tickets using different methods
    console.log('=== TICKET COUNT METHODS ===');
    
    // Method 1: Count all tickets in registrationData.tickets arrays
    const allRegistrations = await registrations.find({}).toArray();
    let manualTicketCount = 0;
    let ticketsWithOwnerIds = 0;
    let ticketsWithoutOwnerIds = 0;
    
    const ticketsByEvent = new Map<string, number>();
    
    allRegistrations.forEach(reg => {
      if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
        reg.registrationData.tickets.forEach((ticket: any) => {
          manualTicketCount++;
          
          // Count by event ticket ID
          const eventTicketId = ticket.eventTicketId;
          if (eventTicketId) {
            ticketsByEvent.set(eventTicketId, (ticketsByEvent.get(eventTicketId) || 0) + 1);
          }
          
          // Check for owner IDs
          if (ticket.ownerId || ticket.attendeeId) {
            ticketsWithOwnerIds++;
          } else {
            ticketsWithoutOwnerIds++;
          }
        });
      }
    });
    
    console.log(`Method 1 - Manual count of all tickets: ${manualTicketCount}`);
    console.log(`  - Tickets with owner IDs: ${ticketsWithOwnerIds}`);
    console.log(`  - Tickets without owner IDs: ${ticketsWithoutOwnerIds}`);
    
    // Method 2: Using aggregation to sum quantities
    const quantitySum = await registrations.aggregate([
      { $unwind: '$registrationData.tickets' },
      { 
        $group: { 
          _id: null, 
          totalQuantity: { 
            $sum: { 
              $ifNull: ['$registrationData.tickets.quantity', 1] 
            } 
          },
          ticketCount: { $sum: 1 }
        } 
      }
    ]).toArray();
    
    console.log(`\nMethod 2 - Aggregation count: ${quantitySum[0]?.ticketCount || 0}`);
    console.log(`  - Total quantity sum: ${quantitySum[0]?.totalQuantity || 0}`);
    
    // Method 3: Count unique tickets by different criteria
    const uniqueTicketNumbers = new Set<string>();
    const ticketsWithNumbers = new Set<string>();
    
    allRegistrations.forEach(reg => {
      if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
        reg.registrationData.tickets.forEach((ticket: any) => {
          if (ticket.ticketNumber) {
            uniqueTicketNumbers.add(ticket.ticketNumber);
            ticketsWithNumbers.add(ticket.ticketNumber);
          }
        });
      }
    });
    
    console.log(`\nMethod 3 - Unique ticket numbers: ${uniqueTicketNumbers.size}`);
    
    // 2. Break down by event ticket type
    console.log('\n=== TICKETS BY EVENT TYPE ===');
    const eventTicketDocs = await eventTickets.find({}).toArray();
    
    for (const [eventTicketId, count] of ticketsByEvent.entries()) {
      const eventTicket = eventTicketDocs.find(et => 
        et.eventTicketId === eventTicketId || 
        et._id?.toString() === eventTicketId
      );
      const name = eventTicket?.name || 'Unknown Event';
      console.log(`${name}: ${count} tickets`);
    }
    
    // 3. Check for potential issues that could affect counts
    console.log('\n=== POTENTIAL COUNTING ISSUES ===');
    
    // Check registrations without tickets
    const regsWithoutTickets = await registrations.countDocuments({
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': { $size: 0 } }
      ]
    });
    console.log(`Registrations without tickets: ${regsWithoutTickets}`);
    
    // Check for registrations that might be filtered out in reports
    const unpaidRegs = await registrations.countDocuments({
      $and: [
        { 'registrationData.tickets': { $exists: true, $ne: [] } },
        { $or: [
          { paymentStatus: { $ne: 'paid' } },
          { 'payment.status': { $ne: 'paid' } }
        ]}
      ]
    });
    console.log(`Registrations with tickets but not paid: ${unpaidRegs}`);
    
    // 4. Compare with attendeeCount field
    const attendeeCountSum = await registrations.aggregate([
      { $group: { _id: null, total: { $sum: '$attendeeCount' } } }
    ]).toArray();
    
    console.log(`\n=== ATTENDEE COUNT COMPARISON ===`);
    console.log(`Sum of attendeeCount fields: ${attendeeCountSum[0]?.total || 0}`);
    console.log(`Total tickets counted: ${manualTicketCount}`);
    console.log(`Difference: ${(attendeeCountSum[0]?.total || 0) - manualTicketCount}`);
    
    // 5. Check for refunded payments that might exclude tickets
    const refundedPaymentIds = new Set<string>();
    const payments = db.collection('payments');
    const refundedPayments = await payments.find({ status: 'refunded' }).toArray();
    
    refundedPayments.forEach(payment => {
      if (payment.paymentId) refundedPaymentIds.add(payment.paymentId);
      if (payment.transactionId) refundedPaymentIds.add(payment.transactionId);
    });
    
    let ticketsWithRefundedPayments = 0;
    allRegistrations.forEach(reg => {
      const paymentId = reg.stripePaymentIntentId || reg.squarePaymentId || 
                       reg.registrationData?.stripePaymentIntentId || 
                       reg.registrationData?.square_payment_id;
      
      if (paymentId && refundedPaymentIds.has(paymentId)) {
        if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
          ticketsWithRefundedPayments += reg.registrationData.tickets.length;
        }
      }
    });
    
    console.log(`\nTickets associated with refunded payments: ${ticketsWithRefundedPayments}`);
    
    // Generate detailed report
    const report = `# Ticket Count Verification Report
Generated: ${new Date().toISOString()}

## Summary

### Total Ticket Counts (Different Methods)
- Manual count of all tickets: ${manualTicketCount}
- Aggregation pipeline count: ${quantitySum[0]?.ticketCount || 0}
- Sum of ticket quantities: ${quantitySum[0]?.totalQuantity || 0}
- Unique ticket numbers: ${uniqueTicketNumbers.size}
- Sum of attendeeCount fields: ${attendeeCountSum[0]?.total || 0}

### Ticket Owner Information
- Tickets with owner IDs: ${ticketsWithOwnerIds} (${((ticketsWithOwnerIds/manualTicketCount)*100).toFixed(1)}%)
- Tickets without owner IDs: ${ticketsWithoutOwnerIds} (${((ticketsWithoutOwnerIds/manualTicketCount)*100).toFixed(1)}%)

### Potential Issues
- Registrations without tickets: ${regsWithoutTickets}
- Registrations with unpaid status: ${unpaidRegs}
- Tickets with refunded payments: ${ticketsWithRefundedPayments}

### Tickets by Event Type
${Array.from(ticketsByEvent.entries()).map(([eventId, count]) => {
  const eventTicket = eventTicketDocs.find(et => 
    et.eventTicketId === eventId || et._id?.toString() === eventId
  );
  return `- ${eventTicket?.name || 'Unknown Event'}: ${count} tickets`;
}).join('\n')}

## Analysis

The primary issue appears to be that **${ticketsWithoutOwnerIds} tickets (${((ticketsWithoutOwnerIds/manualTicketCount)*100).toFixed(1)}%)** are missing ownerId/attendeeId fields. This could cause these tickets to be excluded from certain reports or displays that filter based on owner information.

### Recommendations:
1. Fix the ${ticketsWithoutOwnerIds} tickets that are missing owner IDs
2. Ensure all ticket counting logic uses consistent methods
3. Consider whether refunded payments should exclude tickets from counts
4. Verify that unpaid registrations should be excluded from ticket counts

### Query to Find Tickets Without Owner IDs:
\`\`\`javascript
db.registrations.aggregate([
  { $unwind: '$registrationData.tickets' },
  { $match: {
    $and: [
      { 'registrationData.tickets.ownerId': { $exists: false } },
      { 'registrationData.tickets.attendeeId': { $exists: false } }
    ]
  }},
  { $project: {
    registrationId: 1,
    confirmationNumber: 1,
    ticket: '$registrationData.tickets'
  }}
])
\`\`\`
`;
    
    await fs.writeFile('/tmp/ticket-count-verification.md', report);
    console.log('\n✅ Detailed report saved to /tmp/ticket-count-verification.md');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run the verification
verifyTicketCounts();