#!/usr/bin/env node

/**
 * Find all registrations with 'TEST' in names or '@allatt.me' email addresses
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function findTestRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== FINDING TEST REGISTRATIONS ===\n');
    
    // Build query for TEST in names or @allatt.me emails
    const query = {
      $or: [
        // Check primary attendee name
        { 'primaryAttendee.name': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.primaryAttendee.name': { $regex: 'TEST', $options: 'i' } },
        
        // Check booking contact name
        { 'registrationData.bookingContact.name': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.bookingContact.firstName': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.bookingContact.lastName': { $regex: 'TEST', $options: 'i' } },
        
        // Check attendees array
        { 'registrationData.attendees.name': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.attendees.firstName': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.attendees.lastName': { $regex: 'TEST', $options: 'i' } },
        
        // Check emails with @allatt.me
        { 'primaryAttendee.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.primaryAttendee.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.bookingContact.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.attendees.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'customerEmail': { $regex: '@allatt\\.me', $options: 'i' } },
        
        // Check billing details (old schema)
        { 'registrationData.billingDetails.name': { $regex: 'TEST', $options: 'i' } },
        { 'registrationData.billingDetails.email': { $regex: '@allatt\\.me', $options: 'i' } }
      ]
    };
    
    const testRegistrations = await db.collection('registrations').find(query).toArray();
    
    console.log(`Found ${testRegistrations.length} test registrations\n`);
    
    // Group by reason
    const byTestName = [];
    const byAllattEmail = [];
    const byBoth = [];
    
    for (const reg of testRegistrations) {
      let hasTestName = false;
      let hasAllattEmail = false;
      let testNameLocations = [];
      let allattEmailLocations = [];
      
      // Check all possible name fields
      const nameFields = [
        { path: 'primaryAttendee.name', value: reg.primaryAttendee?.name },
        { path: 'registrationData.primaryAttendee.name', value: reg.registrationData?.primaryAttendee?.name },
        { path: 'registrationData.bookingContact.name', value: reg.registrationData?.bookingContact?.name },
        { path: 'registrationData.bookingContact.firstName', value: reg.registrationData?.bookingContact?.firstName },
        { path: 'registrationData.bookingContact.lastName', value: reg.registrationData?.bookingContact?.lastName },
        { path: 'registrationData.billingDetails.name', value: reg.registrationData?.billingDetails?.name }
      ];
      
      // Check attendees array
      if (reg.registrationData?.attendees) {
        reg.registrationData.attendees.forEach((att, idx) => {
          if (att.name) nameFields.push({ path: `attendees[${idx}].name`, value: att.name });
          if (att.firstName) nameFields.push({ path: `attendees[${idx}].firstName`, value: att.firstName });
          if (att.lastName) nameFields.push({ path: `attendees[${idx}].lastName`, value: att.lastName });
        });
      }
      
      // Check for TEST in names
      nameFields.forEach(field => {
        if (field.value && field.value.toUpperCase().includes('TEST')) {
          hasTestName = true;
          testNameLocations.push(`${field.path}: "${field.value}"`);
        }
      });
      
      // Check all possible email fields
      const emailFields = [
        { path: 'customerEmail', value: reg.customerEmail },
        { path: 'primaryAttendee.email', value: reg.primaryAttendee?.email },
        { path: 'registrationData.primaryAttendee.email', value: reg.registrationData?.primaryAttendee?.email },
        { path: 'registrationData.bookingContact.email', value: reg.registrationData?.bookingContact?.email },
        { path: 'registrationData.billingDetails.email', value: reg.registrationData?.billingDetails?.email }
      ];
      
      // Check attendees emails
      if (reg.registrationData?.attendees) {
        reg.registrationData.attendees.forEach((att, idx) => {
          if (att.email) emailFields.push({ path: `attendees[${idx}].email`, value: att.email });
        });
      }
      
      // Check for @allatt.me emails
      emailFields.forEach(field => {
        if (field.value && field.value.toLowerCase().includes('@allatt.me')) {
          hasAllattEmail = true;
          allattEmailLocations.push(`${field.path}: "${field.value}"`);
        }
      });
      
      const regInfo = {
        confirmationNumber: reg.confirmationNumber,
        registrationId: reg.registrationId,
        registrationType: reg.registrationType,
        status: reg.status,
        createdAt: reg.createdAt,
        totalAmountPaid: reg.totalAmountPaid,
        testNameLocations,
        allattEmailLocations
      };
      
      if (hasTestName && hasAllattEmail) {
        byBoth.push(regInfo);
      } else if (hasTestName) {
        byTestName.push(regInfo);
      } else if (hasAllattEmail) {
        byAllattEmail.push(regInfo);
      }
    }
    
    // Display results
    console.log('=== REGISTRATIONS WITH "TEST" IN NAME ===');
    console.log(`Count: ${byTestName.length}\n`);
    byTestName.slice(0, 5).forEach(reg => {
      console.log(`${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`  Status: ${reg.status}, Amount: $${reg.totalAmountPaid || 0}`);
      reg.testNameLocations.forEach(loc => console.log(`  - ${loc}`));
      console.log();
    });
    if (byTestName.length > 5) console.log(`... and ${byTestName.length - 5} more\n`);
    
    console.log('=== REGISTRATIONS WITH @allatt.me EMAIL ===');
    console.log(`Count: ${byAllattEmail.length}\n`);
    byAllattEmail.slice(0, 5).forEach(reg => {
      console.log(`${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`  Status: ${reg.status}, Amount: $${reg.totalAmountPaid || 0}`);
      reg.allattEmailLocations.forEach(loc => console.log(`  - ${loc}`));
      console.log();
    });
    if (byAllattEmail.length > 5) console.log(`... and ${byAllattEmail.length - 5} more\n`);
    
    console.log('=== REGISTRATIONS WITH BOTH ===');
    console.log(`Count: ${byBoth.length}\n`);
    byBoth.forEach(reg => {
      console.log(`${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`  Status: ${reg.status}, Amount: $${reg.totalAmountPaid || 0}`);
      console.log('  TEST names:');
      reg.testNameLocations.forEach(loc => console.log(`    - ${loc}`));
      console.log('  @allatt.me emails:');
      reg.allattEmailLocations.forEach(loc => console.log(`    - ${loc}`));
      console.log();
    });
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total test registrations found: ${testRegistrations.length}`);
    console.log(`  - With "TEST" in name only: ${byTestName.length}`);
    console.log(`  - With @allatt.me email only: ${byAllattEmail.length}`);
    console.log(`  - With both: ${byBoth.length}`);
    
    // Export to file
    const exportData = testRegistrations.map(reg => ({
      confirmationNumber: reg.confirmationNumber,
      registrationId: reg.registrationId,
      type: reg.registrationType,
      status: reg.status,
      amount: reg.totalAmountPaid,
      createdAt: reg.createdAt,
      primaryName: reg.primaryAttendee?.name || reg.registrationData?.primaryAttendee?.name || reg.registrationData?.bookingContact?.name,
      primaryEmail: reg.primaryAttendee?.email || reg.registrationData?.primaryAttendee?.email || reg.customerEmail
    }));
    
    require('fs').writeFileSync(
      'test-registrations-export.json',
      JSON.stringify(exportData, null, 2)
    );
    console.log('\nExported to test-registrations-export.json');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the search
findTestRegistrations();