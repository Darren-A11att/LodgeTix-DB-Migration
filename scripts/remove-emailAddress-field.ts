import * as fs from 'fs';
import * as path from 'path';

function removeEmailAddressField() {
  // Read the bookingContact JSON file
  const bookingContactPath = path.join(__dirname, 'registrations-with-booking-contact.json');
  const bookingContactData = JSON.parse(fs.readFileSync(bookingContactPath, 'utf-8'));
  
  let modifiedCount = 0;
  let fieldsRemoved = 0;
  
  // Process each registration
  const updatedRegistrations = bookingContactData.registrations.map((reg: any) => {
    if (reg.bookingContact && 'emailAddress' in reg.bookingContact) {
      // Create a copy of the registration
      const updatedReg = { ...reg };
      
      // Create a copy of bookingContact without emailAddress
      const { emailAddress, ...bookingContactWithoutEmailAddress } = reg.bookingContact;
      updatedReg.bookingContact = bookingContactWithoutEmailAddress;
      
      modifiedCount++;
      fieldsRemoved++;
      
      // If there's no email field but there was an emailAddress, preserve it as email
      if (!('email' in bookingContactWithoutEmailAddress) && emailAddress) {
        updatedReg.bookingContact.email = emailAddress;
        console.log(`Preserved emailAddress as email for ${reg.confirmationNumber}`);
      }
      
      return updatedReg;
    }
    return reg;
  });
  
  // Create updated data structure
  const updatedData = {
    count: bookingContactData.count,
    registrations: updatedRegistrations
  };
  
  // Write back to the same file
  fs.writeFileSync(bookingContactPath, JSON.stringify(updatedData, null, 2));
  
  console.log('\n=== EmailAddress Field Removal Complete ===\n');
  console.log(`Total registrations processed: ${bookingContactData.count}`);
  console.log(`Registrations modified: ${modifiedCount}`);
  console.log(`EmailAddress fields removed: ${fieldsRemoved}`);
  console.log(`\nFile updated: ${bookingContactPath}`);
  
  // Verify the changes by checking a sample
  if (updatedRegistrations.length > 0) {
    const sample = updatedRegistrations[0];
    console.log('\nSample updated bookingContact fields:');
    if (sample.bookingContact) {
      Object.keys(sample.bookingContact).forEach(field => {
        console.log(`  - ${field}`);
      });
    }
  }
}

removeEmailAddressField();