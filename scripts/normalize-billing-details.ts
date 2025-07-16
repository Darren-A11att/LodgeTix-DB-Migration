import * as fs from 'fs';
import * as path from 'path';

function normalizeBillingDetails() {
  // Read the billingDetails JSON file
  const billingDetailsPath = path.join(__dirname, 'registrations-with-billing-details.json');
  const billingDetailsData = JSON.parse(fs.readFileSync(billingDetailsPath, 'utf-8'));
  
  let modifiedCount = 0;
  const fieldsNormalized = {
    country: 0,
    stateTerritory: 0
  };
  
  // Process each registration
  const updatedRegistrations = billingDetailsData.registrations.map((reg: any) => {
    if (reg.billingDetails) {
      // Create a copy of the registration
      const updatedReg = { ...reg };
      const billingDetails = { ...reg.billingDetails };
      
      let wasModified = false;
      
      // Normalize country field
      if (billingDetails.country && typeof billingDetails.country === 'object' && billingDetails.country.isoCode) {
        billingDetails.country = billingDetails.country.isoCode;
        fieldsNormalized.country++;
        wasModified = true;
      }
      
      // Normalize stateTerritory to stateProvince
      if (billingDetails.stateTerritory) {
        if (typeof billingDetails.stateTerritory === 'object' && billingDetails.stateTerritory.name) {
          billingDetails.stateProvince = billingDetails.stateTerritory.name;
        } else if (typeof billingDetails.stateTerritory === 'string') {
          billingDetails.stateProvince = billingDetails.stateTerritory;
        }
        delete billingDetails.stateTerritory;
        fieldsNormalized.stateTerritory++;
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
  
  console.log('\n=== BillingDetails Normalization Complete ===\n');
  console.log(`Total registrations processed: ${billingDetailsData.count}`);
  console.log(`Registrations modified: ${modifiedCount}`);
  console.log(`\nFields normalized:`);
  console.log(`  - country (object -> string): ${fieldsNormalized.country}`);
  console.log(`  - stateTerritory -> stateProvince: ${fieldsNormalized.stateTerritory}`);
  console.log(`\nFile updated: ${billingDetailsPath}`);
  
  // Show before/after example
  if (updatedRegistrations.length > 0 && billingDetailsData.registrations.length > 0) {
    const originalSample = billingDetailsData.registrations[0].billingDetails;
    const updatedSample = updatedRegistrations[0].billingDetails;
    
    console.log('\nExample transformation:');
    console.log('Before:');
    if (originalSample.country && typeof originalSample.country === 'object') {
      console.log(`  country: { isoCode: "${originalSample.country.isoCode}" }`);
    }
    if (originalSample.stateTerritory && typeof originalSample.stateTerritory === 'object') {
      console.log(`  stateTerritory: { name: "${originalSample.stateTerritory.name}" }`);
    }
    
    console.log('After:');
    console.log(`  country: "${updatedSample.country}"`);
    console.log(`  stateProvince: "${updatedSample.stateProvince}"`);
  }
}

normalizeBillingDetails();