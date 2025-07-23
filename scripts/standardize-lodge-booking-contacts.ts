import fs from 'fs';
import path from 'path';

interface BookingContact {
  city: string;
  email: string;
  phone: string;
  title: string;
  country: string;
  lastName: string;
  firstName: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  businessName: string;
  emailAddress: string;
  mobileNumber: string;
  stateProvince: string;
  businessNumber: string;
  rank?: string;
  state?: string;
  mobile?: string;
  postcode?: string;
}

interface Registration {
  registrationId: string;
  confirmationNumber: string;
  registrationType: string;
  registrationDate: string;
  bookingContact: Partial<BookingContact>;
  lodgeDetails?: {
    lodgeId: string;
    lodgeName: string;
  };
}

interface RegistrationsData {
  count: number;
  registrations: Registration[];
}

const filePath = path.join(__dirname, 'registrations-with-booking-contact.json');
const outputPath = path.join(__dirname, 'registrations-with-booking-contact-updated.json');
const lodgeMappingPath = path.join(__dirname, 'lodge-details-mapping.json');

console.log('Reading lodge details mapping...');
const lodgeMapping: Record<string, string> = JSON.parse(fs.readFileSync(lodgeMappingPath, 'utf-8'));

console.log('Reading registrations file...');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const data: RegistrationsData = JSON.parse(fileContent);

console.log(`Found ${data.count} total registrations`);

let lodgeRegistrationCount = 0;
let updatedCount = 0;
let lodgeNamesFoundCount = 0;

data.registrations = data.registrations.map((registration) => {
  if (registration.registrationType === 'lodge') {
    lodgeRegistrationCount++;
    
    const oldBookingContact = registration.bookingContact;
    const lodgeName = lodgeMapping[registration.registrationId] || registration.lodgeDetails?.lodgeName || '';
    
    if (lodgeName) {
      lodgeNamesFoundCount++;
    }
    
    const standardizedBookingContact: BookingContact = {
      city: oldBookingContact.city || '',
      email: oldBookingContact.email || oldBookingContact.emailAddress || '',
      phone: oldBookingContact.phone || oldBookingContact.mobile || '',
      title: oldBookingContact.title || '',
      country: oldBookingContact.country || '',
      lastName: oldBookingContact.lastName || '',
      firstName: oldBookingContact.firstName || '',
      postalCode: oldBookingContact.postalCode || oldBookingContact.postcode || '',
      addressLine1: oldBookingContact.addressLine1 || '',
      addressLine2: oldBookingContact.addressLine2 || '',
      businessName: lodgeName,
      emailAddress: oldBookingContact.emailAddress || oldBookingContact.email || '',
      mobileNumber: oldBookingContact.mobileNumber || oldBookingContact.mobile || '',
      stateProvince: oldBookingContact.stateProvince || oldBookingContact.state || '',
      businessNumber: oldBookingContact.businessNumber || ''
    };
    
    if (oldBookingContact.rank) {
      (standardizedBookingContact as any).rank = oldBookingContact.rank;
    }
    
    registration.bookingContact = standardizedBookingContact;
    updatedCount++;
  }
  
  return registration;
});

console.log(`\nSummary:`);
console.log(`- Total registrations: ${data.count}`);
console.log(`- Lodge registrations found: ${lodgeRegistrationCount}`);
console.log(`- Lodge booking contacts updated: ${updatedCount}`);
console.log(`- Lodge names found and populated: ${lodgeNamesFoundCount}`);

console.log('\nWriting updated file...');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`\nUpdated file saved to: ${outputPath}`);

const sampleLodgeRegistration = data.registrations.find(r => r.registrationType === 'lodge');
if (sampleLodgeRegistration) {
  console.log('\nSample updated lodge booking contact:');
  console.log(JSON.stringify(sampleLodgeRegistration.bookingContact, null, 2));
}