const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function investigateTicketOwnerIntegrity() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== INVESTIGATING TICKET OWNER INTEGRITY ISSUE ===\n');
    
    // Get all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    console.log(`Found ${registrations.length} total registrations\n`);
    
    let analysis = {
      totalRegistrations: registrations.length,
      individualsAnalyzed: 0,
      lodgesAnalyzed: 0,
      ownerIdMismatchCount: 0,
      correctOwnershipCount: 0,
      noTicketsCount: 0,
      noAttendeesCount: 0,
      patterns: {
        ownerIdMatchingRegistrationId: 0,
        ownerIdMatchingPrimaryAttendeeId: 0,
        ownerIdMatchingActualAttendeeId: 0,
        ownerIdMismatchedValues: []
      },
      examples: {
        correctPattern: [],
        incorrectPattern: [],
        suspiciousPattern: []
      }
    };
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        const isIndividual = registration.registrationType === 'individual' || 
                            registration.registrationType === 'individuals';
        const isLodge = registration.registrationType === 'lodge' || 
                       registration.registrationType === 'lodges';
        
        if (!regData) {
          continue;
        }
        
        if (isIndividual) {
          analysis.individualsAnalyzed++;
        } else if (isLodge) {
          analysis.lodgesAnalyzed++;
          continue; // Skip lodge analysis for now, focus on individuals
        } else {
          continue;
        }
        
        // Check if has tickets and attendees
        if (!regData.tickets) {
          analysis.noTicketsCount++;
          continue;
        }
        
        if (!regData.attendees || (Array.isArray(regData.attendees) && regData.attendees.length === 0)) {
          analysis.noAttendeesCount++;
          continue;
        }
        
        // Create set of actual attendee IDs
        const actualAttendeeIds = new Set();
        if (Array.isArray(regData.attendees)) {
          regData.attendees.forEach(attendee => {
            if (attendee.attendeeId) {
              actualAttendeeIds.add(attendee.attendeeId);
            }
          });
        }
        
        // Analyze tickets
        const tickets = Array.isArray(regData.tickets) ? regData.tickets : Object.values(regData.tickets);
        let hasOwnerMismatch = false;
        let hasCorrectOwnership = false;
        let ticketOwnerIds = new Set();
        
        for (const ticket of tickets) {
          if (ticket.ownerId) {
            ticketOwnerIds.add(ticket.ownerId);
            
            // Check if ownerId matches any actual attendeeId
            if (actualAttendeeIds.has(ticket.ownerId)) {
              hasCorrectOwnership = true;
            } else {
              hasOwnerMismatch = true;
              
              // Analyze the pattern of mismatch
              if (ticket.ownerId === registration.registrationId) {
                analysis.patterns.ownerIdMatchingRegistrationId++;
              } else if (ticket.ownerId === registration.primaryAttendeeId) {
                analysis.patterns.ownerIdMatchingPrimaryAttendeeId++;
              }
              
              // Store unique mismatched values
              const mismatchInfo = {
                confirmationNumber: registration.confirmationNumber,
                ticketOwnerId: ticket.ownerId,
                actualAttendeeIds: Array.from(actualAttendeeIds),
                primaryAttendeeId: registration.primaryAttendeeId,
                registrationId: registration.registrationId
              };
              
              analysis.patterns.ownerIdMismatchedValues.push(mismatchInfo);
            }
          }
        }
        
        // Categorize the registration
        if (hasOwnerMismatch && !hasCorrectOwnership) {
          analysis.ownerIdMismatchCount++;
          
          if (analysis.examples.incorrectPattern.length < 5) {
            analysis.examples.incorrectPattern.push({
              confirmationNumber: registration.confirmationNumber,
              registrationType: registration.registrationType,
              ticketOwnerIds: Array.from(ticketOwnerIds),
              actualAttendeeIds: Array.from(actualAttendeeIds),
              primaryAttendeeId: registration.primaryAttendeeId,
              registrationId: registration.registrationId,
              mismatchType: ticketOwnerIds.has(registration.registrationId) ? 'REGISTRATION_ID' :
                           ticketOwnerIds.has(registration.primaryAttendeeId) ? 'PRIMARY_ATTENDEE_ID' : 'UNKNOWN'
            });
          }
        } else if (hasCorrectOwnership && !hasOwnerMismatch) {
          analysis.correctOwnershipCount++;
          
          if (analysis.examples.correctPattern.length < 3) {
            analysis.examples.correctPattern.push({
              confirmationNumber: registration.confirmationNumber,
              registrationType: registration.registrationType,
              ticketOwnerIds: Array.from(ticketOwnerIds),
              actualAttendeeIds: Array.from(actualAttendeeIds)
            });
          }
        } else if (hasCorrectOwnership && hasOwnerMismatch) {
          // Mixed pattern - some tickets correct, some not
          if (analysis.examples.suspiciousPattern.length < 3) {
            analysis.examples.suspiciousPattern.push({
              confirmationNumber: registration.confirmationNumber,
              registrationType: registration.registrationType,
              ticketOwnerIds: Array.from(ticketOwnerIds),
              actualAttendeeIds: Array.from(actualAttendeeIds),
              note: 'Mixed ownership - some tickets correct, some incorrect'
            });
          }
        }
        
      } catch (error) {
        console.error(`Error analyzing registration ${registration._id}:`, error.message);
      }
    }
    
    // Generate report
    console.log('=== ANALYSIS RESULTS ===\n');
    
    console.log(`Total Registrations Checked: ${analysis.totalRegistrations}`);
    console.log(`  - Individual registrations analyzed: ${analysis.individualsAnalyzed}`);
    console.log(`  - Lodge registrations analyzed: ${analysis.lodgesAnalyzed}`);
    console.log(`  - Registrations without tickets: ${analysis.noTicketsCount}`);
    console.log(`  - Registrations without attendees: ${analysis.noAttendeesCount}`);
    
    console.log(`\nOWNERSHIP INTEGRITY:`);
    console.log(`  - Registrations with CORRECT ticket ownership: ${analysis.correctOwnershipCount}`);
    console.log(`  - Registrations with MISMATCHED ticket ownership: ${analysis.ownerIdMismatchCount}`);
    
    const totalAnalyzed = analysis.correctOwnershipCount + analysis.ownerIdMismatchCount;
    if (totalAnalyzed > 0) {
      const mismatchPercentage = ((analysis.ownerIdMismatchCount / totalAnalyzed) * 100).toFixed(1);
      console.log(`  - Mismatch percentage: ${mismatchPercentage}%`);
    }
    
    console.log(`\nMISMATCH PATTERNS:`);
    console.log(`  - Tickets with ownerId = registrationId: ${analysis.patterns.ownerIdMatchingRegistrationId}`);
    console.log(`  - Tickets with ownerId = primaryAttendeeId: ${analysis.patterns.ownerIdMatchingPrimaryAttendeeId}`);
    
    if (analysis.ownerIdMismatchCount > 0) {
      console.log(`\n⚠️  CRITICAL DATA INTEGRITY ISSUE DETECTED!`);
      console.log(`   ${analysis.ownerIdMismatchCount} registrations have tickets with incorrect ownerId values`);
      console.log(`   This suggests the ticket ownership migration was incomplete or partially reverted`);
    } else {
      console.log(`\n✅ NO DATA INTEGRITY ISSUES FOUND`);
      console.log(`   All ticket ownerId values correctly match attendee attendeeId values`);
    }
    
    // Show examples
    if (analysis.examples.incorrectPattern.length > 0) {
      console.log(`\n=== EXAMPLES OF INCORRECT PATTERNS ===`);
      analysis.examples.incorrectPattern.forEach((example, index) => {
        console.log(`\n${index + 1}. ${example.confirmationNumber} (${example.mismatchType}):`);
        console.log(`   Ticket ownerIds: [${example.ticketOwnerIds.join(', ')}]`);
        console.log(`   Actual attendeeIds: [${example.actualAttendeeIds.join(', ')}]`);
        console.log(`   Primary attendeeId: ${example.primaryAttendeeId}`);
        console.log(`   Registration ID: ${example.registrationId}`);
      });
    }
    
    if (analysis.examples.correctPattern.length > 0) {
      console.log(`\n=== EXAMPLES OF CORRECT PATTERNS ===`);
      analysis.examples.correctPattern.forEach((example, index) => {
        console.log(`\n${index + 1}. ${example.confirmationNumber}:`);
        console.log(`   Ticket ownerIds: [${example.ticketOwnerIds.join(', ')}]`);
        console.log(`   Actual attendeeIds: [${example.actualAttendeeIds.join(', ')}]`);
      });
    }
    
    if (analysis.examples.suspiciousPattern.length > 0) {
      console.log(`\n=== EXAMPLES OF MIXED PATTERNS ===`);
      analysis.examples.suspiciousPattern.forEach((example, index) => {
        console.log(`\n${index + 1}. ${example.confirmationNumber}:`);
        console.log(`   ${example.note}`);
        console.log(`   Ticket ownerIds: [${example.ticketOwnerIds.join(', ')}]`);
        console.log(`   Actual attendeeIds: [${example.actualAttendeeIds.join(', ')}]`);
      });
    }
    
    // Recommendations
    console.log(`\n=== RECOMMENDATIONS ===`);
    
    if (analysis.ownerIdMismatchCount > 0) {
      console.log(`1. IMMEDIATE ACTION REQUIRED: Fix ${analysis.ownerIdMismatchCount} registrations with mismatched ticket ownership`);
      
      if (analysis.patterns.ownerIdMatchingPrimaryAttendeeId > 0) {
        console.log(`2. Run the ticket ownership recovery script to fetch correct attendeeId values from Supabase`);
        console.log(`   File: /scripts/recover-ticket-ownership-from-supabase.js`);
      }
      
      if (analysis.patterns.ownerIdMatchingRegistrationId > 0) {
        console.log(`3. ${analysis.patterns.ownerIdMatchingRegistrationId} tickets are using registrationId instead of attendeeId`);
        console.log(`   This suggests the initial migration script had incorrect logic`);
      }
      
      console.log(`4. After fixing, re-run this analysis to verify all data integrity issues are resolved`);
      console.log(`5. Consider adding validation to prevent future ticket ownership corruption`);
    } else {
      console.log(`1. ✅ Data integrity is good - no immediate action required`);
      console.log(`2. Consider adding automated validation to detect future ownership issues`);
      console.log(`3. Document the correct ticket ownership patterns for future reference`);
    }
    
    // Save detailed analysis
    const detailedReport = {
      analysisDate: new Date().toISOString(),
      summary: analysis,
      recommendations: analysis.ownerIdMismatchCount > 0 ? 'CRITICAL_FIXES_NEEDED' : 'NO_ACTION_REQUIRED'
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, 'outputs', 'ticket-owner-integrity-analysis.json'),
      JSON.stringify(detailedReport, null, 2)
    );
    
    console.log(`\nDetailed analysis saved to: outputs/ticket-owner-integrity-analysis.json`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

investigateTicketOwnerIntegrity().catch(console.error);