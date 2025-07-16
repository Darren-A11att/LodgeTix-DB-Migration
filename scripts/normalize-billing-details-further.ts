import * as fs from 'fs';
import * as path from 'path';

function normalizeBillingDetailsFurther() {
  // Read the billingDetails JSON file
  const billingDetailsPath = path.join(__dirname, 'registrations-with-billing-details.json');
  const billingDetailsData = JSON.parse(fs.readFileSync(billingDetailsPath, 'utf-8'));
  
  let modifiedCount = 0;
  const changes = {
    suburbToCity: 0,
    businessNumberAdded: 0,
    addressLine2Added: 0
  };
  
  // Process each registration
  const updatedRegistrations = billingDetailsData.registrations.map((reg: any) => {
    if (reg.billingDetails) {
      // Create a copy of the registration
      const updatedReg = { ...reg };
      const billingDetails = { ...reg.billingDetails };
      
      let wasModified = false;
      
      // Rename suburb to city
      if ('suburb' in billingDetails) {
        billingDetails.city = billingDetails.suburb;
        delete billingDetails.suburb;
        changes.suburbToCity++;
        wasModified = true;
      }
      
      // Add businessNumber if it doesn't exist
      if (!('businessNumber' in billingDetails)) {
        billingDetails.businessNumber = "";
        changes.businessNumberAdded++;
        wasModified = true;
      }
      
      // Add addressLine2 if it doesn't exist
      if (!('addressLine2' in billingDetails)) {
        billingDetails.addressLine2 = "";
        changes.addressLine2Added++;
        wasModified = true;
      }
      
      if (wasModified) {
        modifiedCount++;
        updatedReg.billingDetails = billingDetails;
      }
      
      return updatedReg;
    }
    return reg;
  });
  
  // Create updated data structure
  const updatedData = {
    count: billingDetailsData.count,
    registrations: updatedRegistrations
  };
  
  // Write back to the same file
  fs.writeFileSync(billingDetailsPath, JSON.stringify(updatedData, null, 2));
  
  console.log('\n=== Additional BillingDetails Normalization Complete ===\n');
  console.log(`Total registrations processed: ${billingDetailsData.count}`);
  console.log(`Registrations modified: ${modifiedCount}`);
  console.log(`\nChanges made:`);
  console.log(`  - suburb → city: ${changes.suburbToCity}`);
  console.log(`  - businessNumber added: ${changes.businessNumberAdded}`);
  console.log(`  - addressLine2 added: ${changes.addressLine2Added}`);
  console.log(`\nFile updated: ${billingDetailsPath}`);
  
  // Show a sample of the updated structure
  if (updatedRegistrations.length > 0) {
    const sample = updatedRegistrations[0].billingDetails;
    console.log('\nSample billingDetails structure:');
    const orderedFields = [
      'firstName', 'lastName', 'title', 'email', 'emailAddress', 
      'phone', 'mobileNumber', 'businessName', 'businessNumber',
      'addressLine1', 'addressLine2', 'city', 'stateProvince', 
      'postcode', 'country'
    ];
    
    orderedFields.forEach(field => {
      if (field in sample) {
        console.log(`  ${field}: "${sample[field]}"`);
      }
    });
  }
}

normalizeBillingDetailsFurther();