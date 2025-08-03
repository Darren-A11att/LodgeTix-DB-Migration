require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createUnenrichedAttendeesFinalReport() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== CREATING FINAL REPORT FOR UNENRICHED ATTENDEES ===\n');
    
    // Find attendees that were NOT enriched by the complete enrichment script
    const unenrichedAttendees = await db.collection('attendees').find({
      'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
    }).toArray();
    
    console.log(`Found ${unenrichedAttendees.length} unenriched attendees\n`);
    
    // Create comprehensive report
    const report = {
      reportMetadata: {
        generatedAt: new Date().toISOString(),
        totalUnenriched: unenrichedAttendees.length,
        mongoDatabase: 'LodgeTix-migration-test-1',
        analysisComplete: true
      },
      summary: {
        totalAttendees: 0,
        byEnrichmentFailureReason: {
          noRegistrationInMongoDB: 0,
          registrationNotInSupabase: 0,
          noAttendeesInRegistration: 0,
          attendeeNotFoundInRegistrationData: 0,
          noSourceDataAvailable: 0
        },
        byOriginalDataSource: {
          registrations: 0,
          tickets: 0,
          manualCreation: 0,
          unknown: 0
        }
      },
      registrationAnalysis: {
        missingFromSupabase: [],
        missingFromMongoDB: [],
        hasDataButNoAttendees: []
      },
      attendees: []
    };
    
    // Get total attendee count
    report.summary.totalAttendees = await db.collection('attendees').countDocuments();
    
    console.log('Analyzing each unenriched attendee...\n');
    
    // Analyze each attendee
    for (const attendee of unenrichedAttendees) {
      const attendeeReport = {
        _id: attendee._id.toString(),
        attendeeId: attendee.attendeeId,
        name: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Unknown',
        currentData: {
          email: attendee.email || null,
          phone: attendee.phone || null,
          attendeeType: attendee.attendeeType || null,
          hasRegistrations: !!(attendee.registrations && attendee.registrations.length > 0),
          hasTickets: !!(attendee.event_tickets && attendee.event_tickets.length > 0),
          modificationHistory: attendee.modificationHistory ? attendee.modificationHistory.length : 0
        },
        registrationInfo: null,
        enrichmentFailureReason: null,
        dataSource: null,
        recommendedAction: null
      };
      
      // Check registration info
      const registrationInfo = attendee.registrations && attendee.registrations[0];
      if (registrationInfo) {
        attendeeReport.registrationInfo = {
          registrationId: registrationInfo.registrationId,
          confirmationNumber: registrationInfo.confirmationNumber,
          functionName: registrationInfo.functionName || 'Unknown'
        };
        
        // Check if registration exists in MongoDB
        const mongoRegistration = await db.collection('registration_imports').findOne({
          registrationId: registrationInfo.registrationId
        });
        
        if (!mongoRegistration) {
          // Check if it exists in Supabase
          const { data: supabaseReg, error } = await supabase
            .from('registrations')
            .select('*')
            .eq('registration_id', registrationInfo.registrationId)
            .single();
          
          if (error || !supabaseReg) {
            attendeeReport.enrichmentFailureReason = 'registration_not_in_supabase';
            attendeeReport.recommendedAction = 'Registration does not exist in Supabase. Likely test data or deleted registration.';
            report.summary.byEnrichmentFailureReason.registrationNotInSupabase++;
            
            if (!report.registrationAnalysis.missingFromSupabase.includes(registrationInfo.registrationId)) {
              report.registrationAnalysis.missingFromSupabase.push(registrationInfo.registrationId);
            }
          } else {
            attendeeReport.enrichmentFailureReason = 'registration_not_imported';
            attendeeReport.recommendedAction = 'Registration exists in Supabase but not in MongoDB imports. Re-run import.';
            report.summary.byEnrichmentFailureReason.noRegistrationInMongoDB++;
            
            if (!report.registrationAnalysis.missingFromMongoDB.includes(registrationInfo.registrationId)) {
              report.registrationAnalysis.missingFromMongoDB.push({
                registrationId: registrationInfo.registrationId,
                confirmationNumber: supabaseReg.confirmation_number,
                customerName: supabaseReg.customer_name
              });
            }
          }
        } else {
          // Registration exists, check for attendees
          const attendees = mongoRegistration.registrationData?.attendees || mongoRegistration.attendees || [];
          
          if (attendees.length === 0) {
            attendeeReport.enrichmentFailureReason = 'no_attendees_in_registration';
            attendeeReport.recommendedAction = 'Registration has no attendee data. May need manual data entry.';
            report.summary.byEnrichmentFailureReason.noAttendeesInRegistration++;
            
            report.registrationAnalysis.hasDataButNoAttendees.push({
              registrationId: registrationInfo.registrationId,
              confirmationNumber: registrationInfo.confirmationNumber
            });
          } else {
            // Check if this specific attendee exists in the registration data
            const foundAttendee = attendees.find(a => 
              a.attendeeId === attendee.attendeeId ||
              a.id === attendee.attendeeId ||
              (a.firstName === attendee.firstName && a.lastName === attendee.lastName)
            );
            
            if (!foundAttendee) {
              attendeeReport.enrichmentFailureReason = 'attendee_not_found_in_registration';
              attendeeReport.recommendedAction = 'Attendee not found in registration data. May be incorrectly linked.';
              report.summary.byEnrichmentFailureReason.attendeeNotFoundInRegistrationData++;
            } else {
              attendeeReport.enrichmentFailureReason = 'unknown_enrichment_failure';
              attendeeReport.recommendedAction = 'Data exists but enrichment failed. Investigate manually.';
              report.summary.byEnrichmentFailureReason.noSourceDataAvailable++;
            }
          }
        }
      } else {
        // No registration info at all
        attendeeReport.enrichmentFailureReason = 'no_registration_reference';
        attendeeReport.recommendedAction = 'Attendee has no registration reference. Likely created manually or from tickets.';
        report.summary.byEnrichmentFailureReason.noSourceDataAvailable++;
      }
      
      // Determine data source
      if (attendee.modificationHistory && attendee.modificationHistory.length > 0) {
        const firstMod = attendee.modificationHistory[0];
        if (firstMod.source) {
          attendeeReport.dataSource = firstMod.source;
          if (firstMod.source.includes('ticket')) {
            report.summary.byOriginalDataSource.tickets++;
          } else if (firstMod.source.includes('registration') || firstMod.source.includes('extract')) {
            report.summary.byOriginalDataSource.registrations++;
          } else if (firstMod.source === 'manual' || firstMod.source.includes('user')) {
            report.summary.byOriginalDataSource.manualCreation++;
          } else {
            report.summary.byOriginalDataSource.unknown++;
          }
        }
      } else {
        report.summary.byOriginalDataSource.unknown++;
      }
      
      // Add missing fields analysis
      const missingFields = [];
      if (!attendee.email) missingFields.push('email');
      if (!attendee.phone) missingFields.push('phone');
      if (!attendee.contactPreference) missingFields.push('contactPreference');
      if (!attendee.membership) missingFields.push('membership');
      if (!attendee.rank) missingFields.push('rank');
      if (!attendee.relationship && attendee.attendeeType === 'guest') missingFields.push('relationship');
      
      attendeeReport.missingFields = missingFields;
      
      report.attendees.push(attendeeReport);
    }
    
    // Sort attendees by enrichment failure reason
    report.attendees.sort((a, b) => {
      if (a.enrichmentFailureReason < b.enrichmentFailureReason) return -1;
      if (a.enrichmentFailureReason > b.enrichmentFailureReason) return 1;
      return 0;
    });
    
    // Add recommendations summary
    report.recommendations = {
      immediate: [],
      investigation: [],
      manual: []
    };
    
    if (report.registrationAnalysis.missingFromSupabase.length > 0) {
      report.recommendations.investigation.push({
        issue: 'Registrations missing from Supabase',
        count: report.registrationAnalysis.missingFromSupabase.length,
        action: 'These registrations may have been deleted or are test data. Verify with business team.',
        registrationIds: report.registrationAnalysis.missingFromSupabase
      });
    }
    
    if (report.registrationAnalysis.missingFromMongoDB.length > 0) {
      report.recommendations.immediate.push({
        issue: 'Registrations exist in Supabase but not imported',
        count: report.registrationAnalysis.missingFromMongoDB.length,
        action: 'Re-run import process for these specific registrations.',
        registrations: report.registrationAnalysis.missingFromMongoDB
      });
    }
    
    if (report.registrationAnalysis.hasDataButNoAttendees.length > 0) {
      report.recommendations.manual.push({
        issue: 'Registrations with no attendee data',
        count: report.registrationAnalysis.hasDataButNoAttendees.length,
        action: 'These registrations have no attendee information and require manual data entry.',
        registrations: report.registrationAnalysis.hasDataButNoAttendees
      });
    }
    
    // Save report
    const reportPath = 'unenriched-attendees-final-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\nReport saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total unenriched attendees: ${report.reportMetadata.totalUnenriched}`);
    console.log(`Percentage of total: ${((report.reportMetadata.totalUnenriched / report.summary.totalAttendees) * 100).toFixed(2)}%`);
    
    console.log('\nBy Failure Reason:');
    Object.entries(report.summary.byEnrichmentFailureReason).forEach(([reason, count]) => {
      if (count > 0) {
        console.log(`  - ${reason}: ${count}`);
      }
    });
    
    console.log('\nBy Original Data Source:');
    Object.entries(report.summary.byOriginalDataSource).forEach(([source, count]) => {
      if (count > 0) {
        console.log(`  - ${source}: ${count}`);
      }
    });
    
    console.log('\nRecommendations:');
    if (report.recommendations.immediate.length > 0) {
      console.log('\nImmediate Actions:');
      report.recommendations.immediate.forEach(rec => {
        console.log(`  - ${rec.issue} (${rec.count} items)`);
      });
    }
    
    if (report.recommendations.investigation.length > 0) {
      console.log('\nInvestigation Required:');
      report.recommendations.investigation.forEach(rec => {
        console.log(`  - ${rec.issue} (${rec.count} items)`);
      });
    }
    
    if (report.recommendations.manual.length > 0) {
      console.log('\nManual Actions:');
      report.recommendations.manual.forEach(rec => {
        console.log(`  - ${rec.issue} (${rec.count} items)`);
      });
    }
    
  } finally {
    await client.close();
  }
}

createUnenrichedAttendeesFinalReport()
  .then(() => console.log('\n✅ Final report generation complete'))
  .catch(console.error);