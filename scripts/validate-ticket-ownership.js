#!/usr/bin/env node

/**
 * Validate ticket ownership to detect data loss
 * This script checks for common data loss scenarios in ticket transformations
 */

const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function validateTicketOwnership() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== TICKET OWNERSHIP VALIDATION ===\n');
    
    const issues = {
      registrationIdAsOwner: [],
      duplicateOwnerIds: [],
      missingOwnerIds: [],
      mismatchedAttendeeIds: [],
      suspiciousPatterns: []
    };
    
    // Get all individual registrations
    const registrations = await db.collection('registrations').find({
      registrationType: { $in: ['individuals', 'individual'] },
      'registrationData.tickets': { $exists: true }
    }).toArray();
    
    console.log(`Checking ${registrations.length} individual registrations...\n`);
    
    let checkedCount = 0;
    let supabaseChecks = 0;
    
    for (const registration of registrations) {
      checkedCount++;
      
      const regData = registration.registrationData || registration.registration_data;
      const tickets = regData?.tickets || [];
      
      if (tickets.length === 0) continue;
      
      // Check 1: Registration ID used as owner ID (common data loss indicator)
      const ticketsWithRegIdAsOwner = tickets.filter(t => 
        t.ownerId === registration.registrationId || 
        t.ownerId === registration.registration_id ||
        t.ownerId === registration._id?.toString()
      );
      
      if (ticketsWithRegIdAsOwner.length > 0) {
        issues.registrationIdAsOwner.push({
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          affectedTickets: ticketsWithRegIdAsOwner.length,
          totalTickets: tickets.length
        });
      }
      
      // Check 2: All tickets have the same owner ID (suspicious for multiple tickets)
      if (tickets.length > 1) {
        const uniqueOwnerIds = new Set(tickets.map(t => t.ownerId));
        if (uniqueOwnerIds.size === 1) {
          issues.duplicateOwnerIds.push({
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            ticketCount: tickets.length,
            sharedOwnerId: tickets[0].ownerId
          });
          
          // For suspicious cases, check against Supabase
          if (supabaseChecks < 10) { // Limit API calls
            supabaseChecks++;
            try {
              const { data: supabaseReg } = await supabase
                .from('registrations')
                .select('registration_data')
                .eq('registration_id', registration.registrationId)
                .single();
              
              if (supabaseReg?.registration_data?.selectedTickets) {
                const selectedTickets = supabaseReg.registration_data.selectedTickets;
                const uniqueAttendeeIds = new Set(
                  selectedTickets.map(t => t.attendeeId).filter(Boolean)
                );
                
                if (uniqueAttendeeIds.size > 1) {
                  // Data loss confirmed - multiple attendeeIds collapsed to one
                  issues.mismatchedAttendeeIds.push({
                    registrationId: registration.registrationId,
                    confirmationNumber: registration.confirmationNumber,
                    originalUniqueAttendees: uniqueAttendeeIds.size,
                    currentUniqueOwners: uniqueOwnerIds.size,
                    dataLoss: true
                  });
                }
              }
            } catch (err) {
              console.warn(`Could not verify ${registration.registrationId} against Supabase`);
            }
          }
        }
      }
      
      // Check 3: Missing owner IDs
      const ticketsWithoutOwner = tickets.filter(t => !t.ownerId);
      if (ticketsWithoutOwner.length > 0) {
        issues.missingOwnerIds.push({
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          ticketsWithoutOwner: ticketsWithoutOwner.length
        });
      }
      
      // Check 4: Suspicious patterns
      const primaryAttendeeId = registration.primaryAttendeeId || 
                               regData?.attendees?.[0]?.attendeeId;
      
      if (primaryAttendeeId && tickets.every(t => t.ownerId === primaryAttendeeId)) {
        issues.suspiciousPatterns.push({
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          pattern: 'all_tickets_assigned_to_primary_attendee',
          ticketCount: tickets.length
        });
      }
      
      // Progress indicator
      if (checkedCount % 100 === 0) {
        console.log(`Progress: ${checkedCount}/${registrations.length} registrations checked`);
      }
    }
    
    // Generate report
    console.log('\n=== VALIDATION REPORT ===\n');
    
    console.log('1. CRITICAL: Registration ID used as Owner ID');
    console.log(`   Found: ${issues.registrationIdAsOwner.length} registrations`);
    if (issues.registrationIdAsOwner.length > 0) {
      console.log('   Sample affected registrations:');
      issues.registrationIdAsOwner.slice(0, 5).forEach(issue => {
        console.log(`   - ${issue.confirmationNumber}: ${issue.affectedTickets}/${issue.totalTickets} tickets affected`);
      });
    }
    
    console.log('\n2. SUSPICIOUS: Duplicate Owner IDs (multiple tickets, same owner)');
    console.log(`   Found: ${issues.duplicateOwnerIds.length} registrations`);
    if (issues.duplicateOwnerIds.length > 0) {
      console.log('   Sample affected registrations:');
      issues.duplicateOwnerIds.slice(0, 5).forEach(issue => {
        console.log(`   - ${issue.confirmationNumber}: ${issue.ticketCount} tickets all assigned to ${issue.sharedOwnerId}`);
      });
    }
    
    console.log('\n3. CONFIRMED DATA LOSS: Mismatched Attendee IDs');
    console.log(`   Found: ${issues.mismatchedAttendeeIds.length} registrations`);
    if (issues.mismatchedAttendeeIds.length > 0) {
      issues.mismatchedAttendeeIds.forEach(issue => {
        console.log(`   - ${issue.confirmationNumber}: ${issue.originalUniqueAttendees} attendees → ${issue.currentUniqueOwners} owner`);
      });
    }
    
    console.log('\n4. ERROR: Missing Owner IDs');
    console.log(`   Found: ${issues.missingOwnerIds.length} registrations`);
    
    console.log('\n5. SUSPICIOUS PATTERNS');
    console.log(`   Found: ${issues.suspiciousPatterns.length} registrations`);
    const patternCounts = {};
    issues.suspiciousPatterns.forEach(issue => {
      patternCounts[issue.pattern] = (patternCounts[issue.pattern] || 0) + 1;
    });
    Object.entries(patternCounts).forEach(([pattern, count]) => {
      console.log(`   - ${pattern}: ${count} registrations`);
    });
    
    // Summary
    const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
    console.log('\n=== SUMMARY ===');
    console.log(`Total registrations checked: ${registrations.length}`);
    console.log(`Total issues found: ${totalIssues}`);
    console.log(`Supabase verifications performed: ${supabaseChecks}`);
    
    // Recommendations
    if (totalIssues > 0) {
      console.log('\n=== RECOMMENDATIONS ===');
      console.log('1. Run fix-ticket-owner-ids.ts to correct owner IDs from Supabase data');
      console.log('2. Review registrations with suspicious patterns manually');
      console.log('3. Consider re-importing affected registrations with correct transformation logic');
      console.log('4. Enable audit logging for all future imports');
    }
    
    // Save detailed report
    if (totalIssues > 0) {
      const report = {
        timestamp: new Date(),
        totalRegistrations: registrations.length,
        issues: issues,
        summary: {
          totalIssues: totalIssues,
          criticalDataLoss: issues.mismatchedAttendeeIds.length,
          likelyDataLoss: issues.registrationIdAsOwner.length + issues.duplicateOwnerIds.length
        }
      };
      
      await db.collection('validation_reports').insertOne(report);
      console.log('\nDetailed report saved to validation_reports collection');
    }
    
  } catch (error) {
    console.error('Validation error:', error);
  } finally {
    await client.close();
  }
}

// Run validation
if (require.main === module) {
  validateTicketOwnership().catch(console.error);
}