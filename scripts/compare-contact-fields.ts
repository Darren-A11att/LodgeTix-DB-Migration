import * as fs from 'fs';
import * as path from 'path';

interface ContactFields {
  bookingContactFields: Set<string>;
  billingDetailsFields: Set<string>;
  commonFields: Set<string>;
  bookingContactOnly: Set<string>;
  billingDetailsOnly: Set<string>;
}

function extractUniqueFields(obj: any, prefix = ''): Set<string> {
  const fields = new Set<string>();
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    fields.add(fieldPath);
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively extract nested fields
      const nestedFields = extractUniqueFields(value, fieldPath);
      nestedFields.forEach(field => fields.add(field));
    }
  }
  
  return fields;
}

function compareContactFields() {
  // Read the generated JSON files
  const bookingContactPath = path.join(__dirname, 'registrations-with-booking-contact.json');
  const billingDetailsPath = path.join(__dirname, 'registrations-with-billing-details.json');
  
  const bookingContactData = JSON.parse(fs.readFileSync(bookingContactPath, 'utf-8'));
  const billingDetailsData = JSON.parse(fs.readFileSync(billingDetailsPath, 'utf-8'));
  
  // Extract all unique fields from bookingContact
  const bookingContactFields = new Set<string>();
  bookingContactData.registrations.forEach((reg: any) => {
    if (reg.bookingContact) {
      const fields = extractUniqueFields(reg.bookingContact);
      fields.forEach(field => bookingContactFields.add(field));
    }
  });
  
  // Extract all unique fields from billingDetails
  const billingDetailsFields = new Set<string>();
  billingDetailsData.registrations.forEach((reg: any) => {
    if (reg.billingDetails) {
      const fields = extractUniqueFields(reg.billingDetails);
      fields.forEach(field => billingDetailsFields.add(field));
    }
  });
  
  // Find common fields
  const commonFields = new Set<string>();
  bookingContactFields.forEach(field => {
    if (billingDetailsFields.has(field)) {
      commonFields.add(field);
    }
  });
  
  // Find fields unique to each
  const bookingContactOnly = new Set<string>();
  bookingContactFields.forEach(field => {
    if (!billingDetailsFields.has(field)) {
      bookingContactOnly.add(field);
    }
  });
  
  const billingDetailsOnly = new Set<string>();
  billingDetailsFields.forEach(field => {
    if (!bookingContactFields.has(field)) {
      billingDetailsOnly.add(field);
    }
  });
  
  // Create comparison report
  const comparison = {
    summary: {
      totalBookingContactFields: bookingContactFields.size,
      totalBillingDetailsFields: billingDetailsFields.size,
      commonFieldsCount: commonFields.size,
      bookingContactOnlyCount: bookingContactOnly.size,
      billingDetailsOnlyCount: billingDetailsOnly.size
    },
    fields: {
      bookingContact: Array.from(bookingContactFields).sort(),
      billingDetails: Array.from(billingDetailsFields).sort(),
      common: Array.from(commonFields).sort(),
      bookingContactOnly: Array.from(bookingContactOnly).sort(),
      billingDetailsOnly: Array.from(billingDetailsOnly).sort()
    },
    fieldMapping: {
      // Common mappings between the two structures
      email: {
        bookingContact: 'email',
        billingDetails: 'emailAddress'
      },
      phone: {
        bookingContact: 'phone',
        billingDetails: 'phone'
      },
      mobile: {
        bookingContact: 'mobileNumber',
        billingDetails: 'mobileNumber'
      },
      addressLine1: {
        bookingContact: 'addressLine1',
        billingDetails: 'addressLine1'
      },
      businessName: {
        bookingContact: 'businessName',
        billingDetails: 'businessName'
      },
      country: {
        bookingContact: 'country',
        billingDetails: 'country.isoCode'
      },
      state: {
        bookingContact: 'stateProvince',
        billingDetails: 'stateTerritory.name'
      },
      postalCode: {
        bookingContact: 'postalCode',
        billingDetails: 'postcode'
      }
    }
  };
  
  // Write comparison to file
  const outputPath = path.join(__dirname, 'contact-fields-comparison.json');
  fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
  
  // Print summary
  console.log('\n=== Contact Fields Comparison ===\n');
  console.log(`Total BookingContact fields: ${bookingContactFields.size}`);
  console.log(`Total BillingDetails fields: ${billingDetailsFields.size}`);
  console.log(`Common fields: ${commonFields.size}`);
  console.log(`BookingContact-only fields: ${bookingContactOnly.size}`);
  console.log(`BillingDetails-only fields: ${billingDetailsOnly.size}`);
  
  console.log('\n=== Common Fields ===');
  Array.from(commonFields).sort().forEach(field => {
    console.log(`  - ${field}`);
  });
  
  console.log('\n=== BookingContact Only ===');
  Array.from(bookingContactOnly).sort().forEach(field => {
    console.log(`  - ${field}`);
  });
  
  console.log('\n=== BillingDetails Only ===');
  Array.from(billingDetailsOnly).sort().forEach(field => {
    console.log(`  - ${field}`);
  });
  
  console.log('\n=== Key Field Mappings ===');
  console.log('Email:');
  console.log('  - BookingContact: email, emailAddress');
  console.log('  - BillingDetails: emailAddress');
  console.log('\nState/Territory:');
  console.log('  - BookingContact: stateProvince');
  console.log('  - BillingDetails: stateTerritory.name');
  console.log('\nPostal Code:');
  console.log('  - BookingContact: postalCode');
  console.log('  - BillingDetails: postcode');
  console.log('\nCountry:');
  console.log('  - BookingContact: country (string)');
  console.log('  - BillingDetails: country.isoCode (nested object)');
  
  console.log(`\nComparison saved to: ${outputPath}`);
}

compareContactFields();