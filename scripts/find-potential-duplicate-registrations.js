const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findPotentialDuplicates() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING POTENTIAL DUPLICATE REGISTRATIONS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Get all registrations
    const allRegistrations = await registrationsCollection.find({}).toArray();
    console.log(`Total registrations in database: ${allRegistrations.length}\n`);
    
    // Maps to track potential duplicates
    const individualDuplicates = new Map(); // Key: email+ticketSignature
    const lodgeDuplicates = new Map(); // Key: email+lodgeName+lodgeNumber+ticketSignature
    
    // Helper function to create ticket signature
    function createTicketSignature(tickets) {
      if (!tickets || !Array.isArray(tickets)) return '';
      
      // Sort tickets by eventTicketId and create a signature
      const signature = tickets
        .map(t => `${t.eventTicketId || t.ticketDefinitionId || 'unknown'}`)
        .sort()
        .join('|');
      
      return signature;
    }
    
    // Helper function to get contact info
    function getContactInfo(regData) {
      const contact = regData?.bookingContact || regData?.billingDetails || {};
      return {
        email: (contact.emailAddress || '').toLowerCase().trim(),
        firstName: (contact.firstName || '').toLowerCase().trim(),
        lastName: (contact.lastName || '').toLowerCase().trim(),
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().trim()
      };
    }
    
    // Process each registration
    for (const reg of allRegistrations) {
      const regData = reg.registrationData || reg.registration_data || {};
      const contact = getContactInfo(regData);
      const tickets = regData.tickets || [];
      const ticketSignature = createTicketSignature(tickets);
      
      if (!contact.email || !ticketSignature) continue;
      
      const regInfo = {
        _id: reg._id,
        confirmationNumber: reg.confirmationNumber,
        registrationId: reg.registrationId,
        createdAt: reg.createdAt,
        totalAmountPaid: reg.totalAmountPaid,
        paymentId: reg.paymentId,
        contact: contact,
        ticketCount: tickets.length,
        ticketSignature: ticketSignature
      };
      
      if (reg.registrationType === 'individuals' || reg.registrationType === 'individual') {
        // For individuals: check email + tickets
        const key = `${contact.email}|${ticketSignature}`;
        
        if (!individualDuplicates.has(key)) {
          individualDuplicates.set(key, []);
        }
        individualDuplicates.get(key).push(regInfo);
        
      } else if (reg.registrationType === 'lodge' || reg.registrationType === 'lodges') {
        // For lodges: check email + lodge details + tickets
        const lodgeDetails = regData.lodgeDetails || {};
        const lodgeName = (lodgeDetails.lodgeName || '').toLowerCase().trim();
        const lodgeNumber = (lodgeDetails.lodgeNumber || '').toString().trim();
        
        regInfo.lodgeName = lodgeName;
        regInfo.lodgeNumber = lodgeNumber;
        
        const key = `${contact.email}|${lodgeName}|${lodgeNumber}|${ticketSignature}`;
        
        if (!lodgeDuplicates.has(key)) {
          lodgeDuplicates.set(key, []);
        }
        lodgeDuplicates.get(key).push(regInfo);
      }
    }
    
    // Find actual duplicates (more than 1 registration with same key)
    console.log('=== INDIVIDUAL REGISTRATION DUPLICATES ===\n');
    console.log('(Same email + same tickets)\n');
    
    let individualDupCount = 0;
    for (const [key, registrations] of individualDuplicates) {
      if (registrations.length > 1) {
        individualDupCount++;
        console.log(`Duplicate Group ${individualDupCount}:`);
        console.log(`Email: ${registrations[0].contact.email}`);
        console.log(`Name: ${registrations[0].contact.fullName}`);
        console.log(`Ticket Count: ${registrations[0].ticketCount}`);
        console.log(`Registrations (${registrations.length}):`);
        
        for (const reg of registrations) {
          console.log(`  - Confirmation: ${reg.confirmationNumber}`);
          console.log(`    ID: ${reg._id}`);
          console.log(`    Registration ID: ${reg.registrationId || 'N/A'}`);
          console.log(`    Created: ${reg.createdAt}`);
          console.log(`    Amount Paid: $${reg.totalAmountPaid || 0}`);
          console.log(`    Payment ID: ${reg.paymentId || 'N/A'}`);
        }
        console.log('');
      }
    }
    
    if (individualDupCount === 0) {
      console.log('No duplicate individual registrations found.\n');
    } else {
      console.log(`Total individual duplicate groups: ${individualDupCount}\n`);
    }
    
    console.log('\n=== LODGE REGISTRATION DUPLICATES ===\n');
    console.log('(Same email + same lodge name/number + same tickets)\n');
    
    let lodgeDupCount = 0;
    for (const [key, registrations] of lodgeDuplicates) {
      if (registrations.length > 1) {
        lodgeDupCount++;
        console.log(`Duplicate Group ${lodgeDupCount}:`);
        console.log(`Email: ${registrations[0].contact.email}`);
        console.log(`Contact Name: ${registrations[0].contact.fullName}`);
        console.log(`Lodge: ${registrations[0].lodgeName} #${registrations[0].lodgeNumber}`);
        console.log(`Ticket Count: ${registrations[0].ticketCount}`);
        console.log(`Registrations (${registrations.length}):`);
        
        for (const reg of registrations) {
          console.log(`  - Confirmation: ${reg.confirmationNumber}`);
          console.log(`    ID: ${reg._id}`);
          console.log(`    Registration ID: ${reg.registrationId || 'N/A'}`);
          console.log(`    Created: ${reg.createdAt}`);
          console.log(`    Amount Paid: $${reg.totalAmountPaid || 0}`);
          console.log(`    Payment ID: ${reg.paymentId || 'N/A'}`);
        }
        console.log('');
      }
    }
    
    if (lodgeDupCount === 0) {
      console.log('No duplicate lodge registrations found.\n');
    } else {
      console.log(`Total lodge duplicate groups: ${lodgeDupCount}\n`);
    }
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total registrations analyzed: ${allRegistrations.length}`);
    console.log(`Individual duplicate groups found: ${individualDupCount}`);
    console.log(`Lodge duplicate groups found: ${lodgeDupCount}`);
    
    // Also check for same confirmation numbers
    console.log('\n=== CHECKING FOR DUPLICATE CONFIRMATION NUMBERS ===\n');
    
    const confirmationNumbers = new Map();
    for (const reg of allRegistrations) {
      if (reg.confirmationNumber) {
        if (!confirmationNumbers.has(reg.confirmationNumber)) {
          confirmationNumbers.set(reg.confirmationNumber, []);
        }
        confirmationNumbers.get(reg.confirmationNumber).push({
          _id: reg._id,
          registrationId: reg.registrationId,
          email: getContactInfo(reg.registrationData || reg.registration_data).email,
          type: reg.registrationType
        });
      }
    }
    
    let dupConfirmationCount = 0;
    for (const [confNum, regs] of confirmationNumbers) {
      if (regs.length > 1) {
        dupConfirmationCount++;
        console.log(`Confirmation ${confNum} appears ${regs.length} times:`);
        for (const reg of regs) {
          console.log(`  - ID: ${reg._id}, Type: ${reg.type}, Email: ${reg.email}`);
        }
        console.log('');
      }
    }
    
    if (dupConfirmationCount === 0) {
      console.log('No duplicate confirmation numbers found.');
    } else {
      console.log(`Total duplicate confirmation numbers: ${dupConfirmationCount}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findPotentialDuplicates();