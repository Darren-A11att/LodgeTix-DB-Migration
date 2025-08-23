import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function analyzeDataRelationships(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    const db = client.db();
    
    // Get sample data for analysis
    const registrations = await db.collection('registrations').find({}).limit(5).toArray();
    const attendees = await db.collection('attendees').find({}).limit(5).toArray();
    const tickets = await db.collection('tickets').find({}).limit(5).toArray();
    
    console.log('\n🔍 DATA STRUCTURE ANALYSIS');
    console.log('='.repeat(50));
    
    // Analyze registration structure
    console.log('\n📋 SAMPLE REGISTRATION:');
    if (registrations[0]) {
      const reg = registrations[0];
      console.log(`ID: ${reg._id}`);
      console.log(`Registration ID: ${reg.registrationId}`);
      console.log(`Primary Attendee ID: ${reg.primaryAttendeeId}`);
      console.log(`Event ID: ${reg.eventId}`);
      console.log(`Payment Status: ${reg.paymentStatus}`);
      console.log(`Total Amount: ${reg.totalAmountPaid}`);
      
      // Look for related attendees
      console.log('\n🔗 LOOKING FOR RELATED ATTENDEES:');
      const relatedAttendees = await db.collection('attendees').find({
        $or: [
          { attendeeId: reg.primaryAttendeeId },
          { registrations: reg.registrationId }
        ]
      }).toArray();
      console.log(`Found ${relatedAttendees.length} related attendees`);
      
      if (relatedAttendees.length > 0) {
        const attendee = relatedAttendees[0];
        console.log(`  - ${attendee.firstName} ${attendee.lastName}`);
        console.log(`  - Attendee ID: ${attendee.attendeeId}`);
        console.log(`  - Registrations: ${JSON.stringify(attendee.registrations)}`);
      }
      
      // Look for related tickets
      console.log('\n🎫 LOOKING FOR RELATED TICKETS:');
      const relatedTickets = await db.collection('tickets').find({
        ticketOwner: reg.registrationId
      }).toArray();
      console.log(`Found ${relatedTickets.length} related tickets`);
      
      if (relatedTickets.length > 0) {
        relatedTickets.forEach((ticket, index) => {
          console.log(`  Ticket ${index + 1}:`);
          console.log(`    - ID: ${ticket._id}`);
          console.log(`    - Ticket ID: ${ticket.ticketId}`);
          console.log(`    - Owner: ${ticket.ticketOwner}`);
          console.log(`    - Event Ticket ID: ${ticket.eventTicketId}`);
          console.log(`    - Price: ${ticket.price}`);
        });
      }
    }
    
    // Analyze attendee structure
    console.log('\n👤 SAMPLE ATTENDEE:');
    if (attendees[0]) {
      const att = attendees[0];
      console.log(`ID: ${att._id}`);
      console.log(`Attendee ID: ${att.attendeeId}`);
      console.log(`Name: ${att.firstName} ${att.lastName}`);
      console.log(`Email: ${att.email}`);
      console.log(`Registrations: ${JSON.stringify(att.registrations)}`);
    }
    
    // Analyze ticket structure
    console.log('\n🎫 SAMPLE TICKET:');
    if (tickets[0]) {
      const ticket = tickets[0];
      console.log(`ID: ${ticket._id}`);
      console.log(`Ticket ID: ${ticket.ticketId}`);
      console.log(`Owner: ${ticket.ticketOwner}`);
      console.log(`Holder: ${JSON.stringify(ticket.ticketHolder)}`);
      console.log(`Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`Price: ${ticket.price}`);
    }
    
    // Check relationship patterns
    console.log('\n🔗 RELATIONSHIP PATTERN ANALYSIS:');
    console.log('='.repeat(50));
    
    // Registration -> Attendee relationships
    let regToAttendeeMatches = 0;
    let totalRegsWithPrimaryAttendee = 0;
    
    for (const reg of await db.collection('registrations').find({}).toArray()) {
      if (reg.primaryAttendeeId) {
        totalRegsWithPrimaryAttendee++;
        
        // Check if attendee exists with this ID
        const attendee = await db.collection('attendees').findOne({
          attendeeId: reg.primaryAttendeeId
        });
        
        if (attendee) {
          regToAttendeeMatches++;
        }
      }
    }
    
    console.log(`Registration -> Attendee Links:`);
    console.log(`  Total registrations with primaryAttendeeId: ${totalRegsWithPrimaryAttendee}`);
    console.log(`  Matching attendees found: ${regToAttendeeMatches}`);
    console.log(`  Match rate: ${totalRegsWithPrimaryAttendee > 0 ? ((regToAttendeeMatches / totalRegsWithPrimaryAttendee) * 100).toFixed(1) : 0}%`);
    
    // Ticket -> Registration relationships
    let ticketToRegMatches = 0;
    let totalTicketsWithOwner = 0;
    
    for (const ticket of await db.collection('tickets').find({}).toArray()) {
      if (ticket.ticketOwner) {
        totalTicketsWithOwner++;
        
        // Check if registration exists with this ID
        const registration = await db.collection('registrations').findOne({
          registrationId: ticket.ticketOwner
        });
        
        if (registration) {
          ticketToRegMatches++;
        }
      }
    }
    
    console.log(`\nTicket -> Registration Links:`);
    console.log(`  Total tickets with ticketOwner: ${totalTicketsWithOwner}`);
    console.log(`  Matching registrations found: ${ticketToRegMatches}`);
    console.log(`  Match rate: ${totalTicketsWithOwner > 0 ? ((ticketToRegMatches / totalTicketsWithOwner) * 100).toFixed(1) : 0}%`);
    
    // Check unique field distributions
    console.log('\n📊 DATA QUALITY METRICS:');
    console.log('='.repeat(50));
    
    const regStats = await db.collection('registrations').aggregate([
      {
        $group: {
          _id: null,
          totalRegs: { $sum: 1 },
          withRegistrationId: { $sum: { $cond: [{ $ne: ['$registrationId', null] }, 1, 0] } },
          withPrimaryAttendeeId: { $sum: { $cond: [{ $ne: ['$primaryAttendeeId', null] }, 1, 0] } },
          withEventId: { $sum: { $cond: [{ $ne: ['$eventId', null] }, 1, 0] } },
          withPaymentStatus: { $sum: { $cond: [{ $ne: ['$paymentStatus', null] }, 1, 0] } },
          withTotalAmount: { $sum: { $cond: [{ $ne: ['$totalAmountPaid', null] }, 1, 0] } }
        }
      }
    ]).toArray();
    
    if (regStats[0]) {
      const stats = regStats[0];
      console.log(`Registration Data Completeness:`);
      console.log(`  Registration ID: ${((stats.withRegistrationId / stats.totalRegs) * 100).toFixed(1)}%`);
      console.log(`  Primary Attendee ID: ${((stats.withPrimaryAttendeeId / stats.totalRegs) * 100).toFixed(1)}%`);
      console.log(`  Event ID: ${((stats.withEventId / stats.totalRegs) * 100).toFixed(1)}%`);
      console.log(`  Payment Status: ${((stats.withPaymentStatus / stats.totalRegs) * 100).toFixed(1)}%`);
      console.log(`  Total Amount: ${((stats.withTotalAmount / stats.totalRegs) * 100).toFixed(1)}%`);
    }
    
    const attStats = await db.collection('attendees').aggregate([
      {
        $group: {
          _id: null,
          totalAtts: { $sum: 1 },
          withAttendeeId: { $sum: { $cond: [{ $ne: ['$attendeeId', null] }, 1, 0] } },
          withFirstName: { $sum: { $cond: [{ $ne: ['$firstName', null] }, 1, 0] } },
          withLastName: { $sum: { $cond: [{ $ne: ['$lastName', null] }, 1, 0] } },
          withEmail: { $sum: { $cond: [{ $ne: ['$email', null] }, 1, 0] } }
        }
      }
    ]).toArray();
    
    if (attStats[0]) {
      const stats = attStats[0];
      console.log(`\nAttendee Data Completeness:`);
      console.log(`  Attendee ID: ${((stats.withAttendeeId / stats.totalAtts) * 100).toFixed(1)}%`);
      console.log(`  First Name: ${((stats.withFirstName / stats.totalAtts) * 100).toFixed(1)}%`);
      console.log(`  Last Name: ${((stats.withLastName / stats.totalAtts) * 100).toFixed(1)}%`);
      console.log(`  Email: ${((stats.withEmail / stats.totalAtts) * 100).toFixed(1)}%`);
    }
    
    // Final recommendations
    console.log('\n💡 DETAILED RECOMMENDATIONS:');
    console.log('='.repeat(50));
    console.log('1. 🔧 Fix ID field inconsistencies:');
    console.log('   - Registration.primaryAttendeeId should match Attendee.attendeeId');
    console.log('   - Ticket.ticketOwner should match Registration.registrationId');
    
    console.log('\n2. 📊 Data Issues to Address:');
    if (regToAttendeeMatches === 0) {
      console.log('   - CRITICAL: No registration->attendee links working');
    }
    if (ticketToRegMatches === 0) {
      console.log('   - CRITICAL: No ticket->registration links working');
    }
    
    console.log('\n3. 🚀 Migration Strategy:');
    console.log('   - Implement data normalization script first');
    console.log('   - Create proper FK relationships');
    console.log('   - Then proceed with cart structure migration');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute automatically
analyzeDataRelationships().catch(console.error);