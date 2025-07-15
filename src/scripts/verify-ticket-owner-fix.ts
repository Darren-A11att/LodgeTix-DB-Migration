import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';

async function verifyTicketOwnerFix() {
  console.log('Verifying ticket owner fix...\n');
  
  try {
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Find all individual registrations
    const individualRegistrations = await registrationsCollection.find({
      registrationType: 'individuals',
      'registrationData.tickets': { $exists: true }
    }).toArray();
    
    console.log(`Total individual registrations: ${individualRegistrations.length}`);
    
    let correctCount = 0;
    let incorrectCount = 0;
    let noTicketsCount = 0;
    const incorrectRegistrations: string[] = [];
    
    for (const registration of individualRegistrations) {
      const tickets = registration.registrationData.tickets || [];
      
      if (tickets.length === 0) {
        noTicketsCount++;
        continue;
      }
      
      // Check if any ticket still has registrationId as ownerId
      const hasIncorrectOwner = tickets.some((ticket: any) => 
        ticket.ownerId === registration.registrationId
      );
      
      if (hasIncorrectOwner) {
        incorrectCount++;
        incorrectRegistrations.push(registration.registrationId);
      } else {
        correctCount++;
      }
    }
    
    console.log('\n=== Verification Summary ===');
    console.log(`Registrations with correct owner IDs: ${correctCount}`);
    console.log(`Registrations with incorrect owner IDs: ${incorrectCount}`);
    console.log(`Registrations with no tickets: ${noTicketsCount}`);
    
    if (incorrectCount > 0) {
      console.log('\n=== Registrations Still Needing Fix ===');
      incorrectRegistrations.forEach((regId, index) => {
        console.log(`${index + 1}. ${regId}`);
      });
      
      console.log('\nTo fix these registrations, run: npm run fix-ticket-owners');
    } else {
      console.log('\n✅ All individual registrations have correct ticket owner IDs!');
    }
    
    // Sample check - show details of first 3 registrations
    console.log('\n=== Sample Registration Details (First 3) ===');
    const sampleRegistrations = individualRegistrations.slice(0, 3);
    
    for (const reg of sampleRegistrations) {
      console.log(`\nRegistration: ${reg.registrationId}`);
      console.log(`Attendees: ${reg.registrationData.attendees?.length || 0}`);
      console.log(`Tickets: ${reg.registrationData.tickets?.length || 0}`);
      
      if (reg.registrationData.tickets?.length > 0) {
        console.log('Ticket Owner IDs:');
        reg.registrationData.tickets.forEach((ticket: any, index: number) => {
          console.log(`  ${index + 1}. ${ticket.name} -> ${ticket.ownerId}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the verification
if (require.main === module) {
  verifyTicketOwnerFix().catch(console.error);
}