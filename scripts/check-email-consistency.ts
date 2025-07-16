import * as fs from 'fs';
import * as path from 'path';

interface EmailAnalysis {
  totalRegistrations: number;
  hasBothFields: number;
  sameEmailInBothFields: number;
  differentEmailInFields: number;
  onlyEmail: number;
  onlyEmailAddress: number;
  neitherField: number;
  examples: {
    sameEmail: Array<{
      registrationId: string;
      confirmationNumber: string;
      email: string;
      emailAddress: string;
    }>;
    differentEmail: Array<{
      registrationId: string;
      confirmationNumber: string;
      email: string;
      emailAddress: string;
    }>;
  };
}

function analyzeEmailFields() {
  // Read the bookingContact JSON file
  const bookingContactPath = path.join(__dirname, 'registrations-with-booking-contact.json');
  const bookingContactData = JSON.parse(fs.readFileSync(bookingContactPath, 'utf-8'));
  
  const analysis: EmailAnalysis = {
    totalRegistrations: bookingContactData.count,
    hasBothFields: 0,
    sameEmailInBothFields: 0,
    differentEmailInFields: 0,
    onlyEmail: 0,
    onlyEmailAddress: 0,
    neitherField: 0,
    examples: {
      sameEmail: [],
      differentEmail: []
    }
  };
  
  // Analyze each registration
  bookingContactData.registrations.forEach((reg: any) => {
    const contact = reg.bookingContact;
    if (!contact) return;
    
    const hasEmail = 'email' in contact && contact.email !== null && contact.email !== undefined;
    const hasEmailAddress = 'emailAddress' in contact && contact.emailAddress !== null && contact.emailAddress !== undefined;
    
    if (hasEmail && hasEmailAddress) {
      analysis.hasBothFields++;
      
      // Check if they're the same (case-insensitive)
      if (contact.email.toLowerCase() === contact.emailAddress.toLowerCase()) {
        analysis.sameEmailInBothFields++;
        
        // Add example (limit to first 5)
        if (analysis.examples.sameEmail.length < 5) {
          analysis.examples.sameEmail.push({
            registrationId: reg.registrationId,
            confirmationNumber: reg.confirmationNumber,
            email: contact.email,
            emailAddress: contact.emailAddress
          });
        }
      } else {
        analysis.differentEmailInFields++;
        
        // Add example (limit to first 5)
        if (analysis.examples.differentEmail.length < 5) {
          analysis.examples.differentEmail.push({
            registrationId: reg.registrationId,
            confirmationNumber: reg.confirmationNumber,
            email: contact.email,
            emailAddress: contact.emailAddress
          });
        }
      }
    } else if (hasEmail && !hasEmailAddress) {
      analysis.onlyEmail++;
    } else if (!hasEmail && hasEmailAddress) {
      analysis.onlyEmailAddress++;
    } else {
      analysis.neitherField++;
    }
  });
  
  // Calculate percentages
  const percentages = {
    hasBothFields: ((analysis.hasBothFields / analysis.totalRegistrations) * 100).toFixed(2),
    sameEmail: analysis.hasBothFields > 0 ? ((analysis.sameEmailInBothFields / analysis.hasBothFields) * 100).toFixed(2) : '0',
    differentEmail: analysis.hasBothFields > 0 ? ((analysis.differentEmailInFields / analysis.hasBothFields) * 100).toFixed(2) : '0'
  };
  
  // Write detailed analysis to file
  const outputPath = path.join(__dirname, 'email-consistency-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    ...analysis,
    percentages
  }, null, 2));
  
  // Print summary
  console.log('\n=== Email Field Consistency Analysis ===\n');
  console.log(`Total registrations with bookingContact: ${analysis.totalRegistrations}`);
  console.log(`\nField presence:`);
  console.log(`  - Has both email & emailAddress: ${analysis.hasBothFields} (${percentages.hasBothFields}%)`);
  console.log(`  - Only email field: ${analysis.onlyEmail}`);
  console.log(`  - Only emailAddress field: ${analysis.onlyEmailAddress}`);
  console.log(`  - Neither field: ${analysis.neitherField}`);
  
  console.log(`\nFor registrations with both fields (${analysis.hasBothFields}):`);
  console.log(`  - Same value in both: ${analysis.sameEmailInBothFields} (${percentages.sameEmail}%)`);
  console.log(`  - Different values: ${analysis.differentEmailInFields} (${percentages.differentEmail}%)`);
  
  if (analysis.examples.sameEmail.length > 0) {
    console.log('\nExamples where email === emailAddress:');
    analysis.examples.sameEmail.forEach(ex => {
      console.log(`  - ${ex.confirmationNumber}: "${ex.email}"`);
    });
  }
  
  if (analysis.examples.differentEmail.length > 0) {
    console.log('\nExamples where email !== emailAddress:');
    analysis.examples.differentEmail.forEach(ex => {
      console.log(`  - ${ex.confirmationNumber}:`);
      console.log(`    email: "${ex.email}"`);
      console.log(`    emailAddress: "${ex.emailAddress}"`);
    });
  }
  
  console.log(`\nDetailed analysis saved to: ${outputPath}`);
}

analyzeEmailFields();