import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix-reconcile';

interface DataIssue {
  registrationId: string;
  confirmationNumber?: string;
  issue: string;
  details: any;
}

async function checkTicketDataConsistency() {
  const client = new MongoClient(MONGODB_URI);
  const issues: DataIssue[] = [];
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    const eventTickets = db.collection('eventTickets');
    
    console.log('🔍 Starting data consistency check...\n');
    
    // 1. Get all registrations
    const allRegistrations = await registrations.find({}).toArray();
    console.log(`Total registrations in database: ${allRegistrations.length}`);
    
    // Statistics
    let totalTicketsFromRegistrations = 0;
    let registrationsWithoutTickets = 0;
    let registrationsWithEmptyTickets = 0;
    let ticketsWithoutStatus = 0;
    let ticketsWithInvalidQuantity = 0;
    let duplicateRegistrations = 0;
    let registrationsWithoutRegistrationData = 0;
    let ticketsWithMissingOwnerId = 0;
    let ticketsWithMissingOwnerType = 0;
    
    // Check each registration
    for (const registration of allRegistrations) {
      const regId = registration.registrationId || registration._id?.toString();
      const confirmationNum = registration.confirmationNumber;
      
      // Check if registrationData exists
      if (!registration.registrationData) {
        registrationsWithoutRegistrationData++;
        issues.push({
          registrationId: regId,
          confirmationNumber: confirmationNum,
          issue: 'Missing registrationData',
          details: { hasRegistrationData: false }
        });
        continue;
      }
      
      const tickets = registration.registrationData.tickets;
      
      // Check for missing tickets field
      if (!tickets) {
        registrationsWithoutTickets++;
        issues.push({
          registrationId: regId,
          confirmationNumber: confirmationNum,
          issue: 'No tickets field in registrationData',
          details: { hasTicketsField: false }
        });
      } else if (!Array.isArray(tickets)) {
        issues.push({
          registrationId: regId,
          confirmationNumber: confirmationNum,
          issue: 'Tickets field is not an array',
          details: { ticketsType: typeof tickets, tickets }
        });
      } else if (tickets.length === 0) {
        registrationsWithEmptyTickets++;
        issues.push({
          registrationId: regId,
          confirmationNumber: confirmationNum,
          issue: 'Empty tickets array',
          details: { ticketCount: 0 }
        });
      } else {
        // Check each ticket
        tickets.forEach((ticket: any, index: number) => {
          totalTicketsFromRegistrations++;
          
          // Check for missing status (should default to "sold")
          if (!ticket.status) {
            ticketsWithoutStatus++;
            issues.push({
              registrationId: regId,
              confirmationNumber: confirmationNum,
              issue: `Ticket ${index} missing status field`,
              details: { ticketIndex: index, ticket }
            });
          }
          
          // Check for invalid quantity
          const quantity = ticket.quantity;
          if (quantity === undefined || quantity === null || quantity === 0 || isNaN(quantity)) {
            ticketsWithInvalidQuantity++;
            issues.push({
              registrationId: regId,
              confirmationNumber: confirmationNum,
              issue: `Ticket ${index} has invalid quantity`,
              details: { ticketIndex: index, quantity, ticket }
            });
          }
          
          // Check for missing ownerId
          if (!ticket.ownerId && !ticket.attendeeId) {
            ticketsWithMissingOwnerId++;
            issues.push({
              registrationId: regId,
              confirmationNumber: confirmationNum,
              issue: `Ticket ${index} missing ownerId/attendeeId`,
              details: { ticketIndex: index, ticket }
            });
          }
          
          // Check for missing ownerType
          if (!ticket.ownerType) {
            ticketsWithMissingOwnerType++;
            issues.push({
              registrationId: regId,
              confirmationNumber: confirmationNum,
              issue: `Ticket ${index} missing ownerType`,
              details: { ticketIndex: index, ticket }
            });
          }
        });
      }
    }
    
    // 2. Check for duplicate registrations by confirmation number
    const confirmationNumbers = new Map<string, string[]>();
    allRegistrations.forEach(reg => {
      const confNum = reg.confirmationNumber;
      if (confNum) {
        if (!confirmationNumbers.has(confNum)) {
          confirmationNumbers.set(confNum, []);
        }
        confirmationNumbers.get(confNum)!.push(reg.registrationId || reg._id?.toString());
      }
    });
    
    confirmationNumbers.forEach((regIds, confNum) => {
      if (regIds.length > 1) {
        duplicateRegistrations += regIds.length;
        issues.push({
          registrationId: regIds.join(', '),
          confirmationNumber: confNum,
          issue: 'Duplicate confirmation number',
          details: { registrationIds: regIds, count: regIds.length }
        });
      }
    });
    
    // 3. Compare with eventTickets collection
    const totalEventTickets = await eventTickets.countDocuments();
    console.log(`\nTotal event tickets (product templates): ${totalEventTickets}`);
    
    // 4. Check registrations that might be excluded from ticket counts
    const paidRegistrations = await registrations.countDocuments({
      $or: [
        { paymentStatus: 'paid' },
        { status: 'paid' },
        { 'payment.status': 'paid' }
      ]
    });
    
    const unpaidRegistrations = allRegistrations.length - paidRegistrations;
    
    // Generate report
    const report = `# Data Consistency Check Report
Generated: ${new Date().toISOString()}

## Summary Statistics

### Registration Counts
- Total registrations: ${allRegistrations.length}
- Paid registrations: ${paidRegistrations}
- Unpaid registrations: ${unpaidRegistrations}
- Registrations without registrationData: ${registrationsWithoutRegistrationData}
- Registrations without tickets field: ${registrationsWithoutTickets}
- Registrations with empty tickets array: ${registrationsWithEmptyTickets}
- Duplicate registrations (by confirmation number): ${duplicateRegistrations}

### Ticket Counts
- Total tickets from registrations: ${totalTicketsFromRegistrations}
- Total event ticket templates: ${totalEventTickets}
- Tickets missing status field: ${ticketsWithoutStatus}
- Tickets with invalid quantity: ${ticketsWithInvalidQuantity}
- Tickets missing ownerId/attendeeId: ${ticketsWithMissingOwnerId}
- Tickets missing ownerType: ${ticketsWithMissingOwnerType}

## Issues Found (${issues.length} total)

${issues.slice(0, 100).map(issue => `
### ${issue.issue}
- Registration ID: ${issue.registrationId}
- Confirmation Number: ${issue.confirmationNumber || 'N/A'}
- Details: ${JSON.stringify(issue.details, null, 2)}
`).join('\n')}

${issues.length > 100 ? `\n... and ${issues.length - 100} more issues` : ''}

## Recommendations

1. **Missing Status Field**: ${ticketsWithoutStatus} tickets are missing the status field. These should default to "sold".

2. **Invalid Quantities**: ${ticketsWithInvalidQuantity} tickets have invalid quantities (null, undefined, 0, or NaN).

3. **Missing Owner Information**: ${ticketsWithMissingOwnerId} tickets are missing ownerId/attendeeId, and ${ticketsWithMissingOwnerType} are missing ownerType.

4. **Empty Ticket Arrays**: ${registrationsWithEmptyTickets} registrations have empty ticket arrays, which might cause them to be excluded from counts.

5. **Missing Registration Data**: ${registrationsWithoutRegistrationData} registrations are missing the registrationData field entirely.

6. **Duplicate Registrations**: Found ${duplicateRegistrations} registrations sharing confirmation numbers, which could cause double-counting.

## Query to Find Problem Registrations

\`\`\`javascript
// Find registrations with data issues
db.registrations.find({
  $or: [
    { 'registrationData': { $exists: false } },
    { 'registrationData.tickets': { $exists: false } },
    { 'registrationData.tickets': { $size: 0 } },
    { 'registrationData.tickets.status': { $exists: false } },
    { 'registrationData.tickets.quantity': { $in: [null, 0, NaN] } }
  ]
})
\`\`\`
`;
    
    // Save report
    await fs.writeFile('/tmp/data-consistency-check.md', report);
    console.log('✅ Report saved to /tmp/data-consistency-check.md');
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`- Total issues found: ${issues.length}`);
    console.log(`- Tickets missing status: ${ticketsWithoutStatus}`);
    console.log(`- Tickets with invalid quantity: ${ticketsWithInvalidQuantity}`);
    console.log(`- Registrations with empty tickets: ${registrationsWithEmptyTickets}`);
    console.log(`- Duplicate registrations: ${duplicateRegistrations}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkTicketDataConsistency();