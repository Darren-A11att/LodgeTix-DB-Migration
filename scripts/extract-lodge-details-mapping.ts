import fs from 'fs';
import path from 'path';

interface LodgeDetails {
  lodgeId: string;
  lodgeName: string;
}

interface Registration {
  registrationId: string;
  registrationType: string;
  registrationData?: {
    lodgeDetails?: LodgeDetails;
  };
}

const registrationsPath = path.join(__dirname, 'registrations.json');
const outputPath = path.join(__dirname, 'lodge-details-mapping.json');

console.log('Reading registrations file...');
const fileContent = fs.readFileSync(registrationsPath, 'utf-8');
const registrations: Registration[] = JSON.parse(fileContent);

console.log(`Found ${registrations.length} total registrations`);

// Extract lodge details mapping
const lodgeDetailsMapping: Record<string, string> = {};
let lodgeRegistrationCount = 0;
let lodgeDetailsFoundCount = 0;

registrations.forEach((registration) => {
  if (registration.registrationType === 'lodge') {
    lodgeRegistrationCount++;
    
    if (registration.registrationData?.lodgeDetails?.lodgeName) {
      lodgeDetailsMapping[registration.registrationId] = registration.registrationData.lodgeDetails.lodgeName;
      lodgeDetailsFoundCount++;
    }
  }
});

console.log(`\nSummary:`);
console.log(`- Total registrations: ${registrations.length}`);
console.log(`- Lodge registrations found: ${lodgeRegistrationCount}`);
console.log(`- Lodge details found: ${lodgeDetailsFoundCount}`);

// Save the mapping
fs.writeFileSync(outputPath, JSON.stringify(lodgeDetailsMapping, null, 2));
console.log(`\nLodge details mapping saved to: ${outputPath}`);

// Display a few examples
console.log('\nSample lodge details mapping:');
const sampleEntries = Object.entries(lodgeDetailsMapping).slice(0, 5);
sampleEntries.forEach(([registrationId, lodgeName]) => {
  console.log(`  ${registrationId}: ${lodgeName}`);
});