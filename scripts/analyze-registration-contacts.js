const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeRegistrationContacts() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('Analyzing registration contact fields...\n');
    
    // Get all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    
    // Initialize counters
    const stats = {
      total: registrations.length,
      withBookingContact: 0,
      withBillingContact: 0,
      withBoth: 0,
      withNeither: 0,
      byType: {
        individuals: {
          total: 0,
          withBookingContact: 0,
          withBillingContact: 0,
          withBoth: 0,
          withNeither: 0
        },
        lodges: {
          total: 0,
          withBookingContact: 0,
          withBillingContact: 0,
          withBoth: 0,
          withNeither: 0
        }
      },
      samples: {
        bookingOnly: [],
        billingOnly: [],
        both: [],
        neither: []
      }
    };
    
    // Analyze each registration
    registrations.forEach(registration => {
      const regType = (registration.registrationType || registration.registration_type || '').toLowerCase();
      const regData = registration.registrationData || registration.registration_data;
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number;
      
      // Check for contact fields (both in registrationData and at root level)
      const hasBookingContact = !!(
        (regData?.bookingContact && Object.keys(regData.bookingContact).length > 0) ||
        (regData?.booking_contact && Object.keys(regData.booking_contact).length > 0) ||
        (registration.bookingContact && Object.keys(registration.bookingContact).length > 0) ||
        (registration.booking_contact && Object.keys(registration.booking_contact).length > 0)
      );
      
      const hasBillingContact = !!(
        (regData?.billingContact && Object.keys(regData.billingContact).length > 0) ||
        (regData?.billing_contact && Object.keys(regData.billing_contact).length > 0) ||
        (registration.billingContact && Object.keys(registration.billingContact).length > 0) ||
        (registration.billing_contact && Object.keys(registration.billing_contact).length > 0)
      );
      
      // Update overall stats
      if (hasBookingContact && hasBillingContact) {
        stats.withBoth++;
        if (stats.samples.both.length < 3) {
          stats.samples.both.push(confirmationNumber);
        }
      } else if (hasBookingContact) {
        stats.withBookingContact++;
        if (stats.samples.bookingOnly.length < 3) {
          stats.samples.bookingOnly.push(confirmationNumber);
        }
      } else if (hasBillingContact) {
        stats.withBillingContact++;
        if (stats.samples.billingOnly.length < 3) {
          stats.samples.billingOnly.push(confirmationNumber);
        }
      } else {
        stats.withNeither++;
        if (stats.samples.neither.length < 3) {
          stats.samples.neither.push(confirmationNumber);
        }
      }
      
      // Update stats by type
      if (regType === 'individuals' || regType === 'individual') {
        stats.byType.individuals.total++;
        if (hasBookingContact && hasBillingContact) {
          stats.byType.individuals.withBoth++;
        } else if (hasBookingContact) {
          stats.byType.individuals.withBookingContact++;
        } else if (hasBillingContact) {
          stats.byType.individuals.withBillingContact++;
        } else {
          stats.byType.individuals.withNeither++;
        }
      } else if (regType === 'lodge' || regType === 'lodges') {
        stats.byType.lodges.total++;
        if (hasBookingContact && hasBillingContact) {
          stats.byType.lodges.withBoth++;
        } else if (hasBookingContact) {
          stats.byType.lodges.withBookingContact++;
        } else if (hasBillingContact) {
          stats.byType.lodges.withBillingContact++;
        } else {
          stats.byType.lodges.withNeither++;
        }
      }
    });
    
    // Display results
    console.log('=== OVERALL STATISTICS ===');
    console.log(`Total registrations: ${stats.total}`);
    console.log(`With bookingContact only: ${stats.withBookingContact}`);
    console.log(`With billingContact only: ${stats.withBillingContact}`);
    console.log(`With both contacts: ${stats.withBoth}`);
    console.log(`With neither contact: ${stats.withNeither}`);
    
    console.log('\n=== INDIVIDUALS REGISTRATIONS ===');
    console.log(`Total: ${stats.byType.individuals.total}`);
    console.log(`With bookingContact only: ${stats.byType.individuals.withBookingContact}`);
    console.log(`With billingContact only: ${stats.byType.individuals.withBillingContact}`);
    console.log(`With both contacts: ${stats.byType.individuals.withBoth}`);
    console.log(`With neither contact: ${stats.byType.individuals.withNeither}`);
    
    console.log('\n=== LODGE REGISTRATIONS ===');
    console.log(`Total: ${stats.byType.lodges.total}`);
    console.log(`With bookingContact only: ${stats.byType.lodges.withBookingContact}`);
    console.log(`With billingContact only: ${stats.byType.lodges.withBillingContact}`);
    console.log(`With both contacts: ${stats.byType.lodges.withBoth}`);
    console.log(`With neither contact: ${stats.byType.lodges.withNeither}`);
    
    console.log('\n=== SAMPLE REGISTRATIONS ===');
    if (stats.samples.bookingOnly.length > 0) {
      console.log(`\nWith bookingContact only: ${stats.samples.bookingOnly.join(', ')}`);
    }
    if (stats.samples.billingOnly.length > 0) {
      console.log(`With billingContact only: ${stats.samples.billingOnly.join(', ')}`);
    }
    if (stats.samples.both.length > 0) {
      console.log(`With both contacts: ${stats.samples.both.join(', ')}`);
    }
    if (stats.samples.neither.length > 0) {
      console.log(`With neither contact: ${stats.samples.neither.join(', ')}`);
    }
    
    // Check location of contacts (in registrationData vs root)
    console.log('\n\n=== CONTACT LOCATION ANALYSIS ===');
    let inRegData = 0;
    let atRoot = 0;
    let inBoth = 0;
    
    registrations.forEach(registration => {
      const regData = registration.registrationData || registration.registration_data;
      
      const hasContactInRegData = !!(
        regData?.bookingContact || regData?.booking_contact ||
        regData?.billingContact || regData?.billing_contact
      );
      
      const hasContactAtRoot = !!(
        registration.bookingContact || registration.booking_contact ||
        registration.billingContact || registration.billing_contact
      );
      
      if (hasContactInRegData && hasContactAtRoot) {
        inBoth++;
      } else if (hasContactInRegData) {
        inRegData++;
      } else if (hasContactAtRoot) {
        atRoot++;
      }
    });
    
    console.log(`Contacts in registrationData: ${inRegData}`);
    console.log(`Contacts at root level: ${atRoot}`);
    console.log(`Contacts in both locations: ${inBoth}`);
    
    // Sample contact structure
    console.log('\n\n=== SAMPLE CONTACT STRUCTURES ===');
    const sampleWithBooking = registrations.find(r => {
      const regData = r.registrationData || r.registration_data;
      return regData?.bookingContact || regData?.booking_contact;
    });
    
    if (sampleWithBooking) {
      const regData = sampleWithBooking.registrationData || sampleWithBooking.registration_data;
      const bookingContact = regData.bookingContact || regData.booking_contact;
      console.log(`\nSample bookingContact (${sampleWithBooking.confirmationNumber || sampleWithBooking.confirmation_number}):`);
      console.log(JSON.stringify(bookingContact, null, 2));
    }
    
    const sampleWithBilling = registrations.find(r => {
      const regData = r.registrationData || r.registration_data;
      return regData?.billingContact || regData?.billing_contact;
    });
    
    if (sampleWithBilling) {
      const regData = sampleWithBilling.registrationData || sampleWithBilling.registration_data;
      const billingContact = regData.billingContact || regData.billing_contact;
      console.log(`\nSample billingContact (${sampleWithBilling.confirmationNumber || sampleWithBilling.confirmation_number}):`);
      console.log(JSON.stringify(billingContact, null, 2));
    }
    
  } finally {
    await client.close();
  }
}

analyzeRegistrationContacts().catch(console.error);