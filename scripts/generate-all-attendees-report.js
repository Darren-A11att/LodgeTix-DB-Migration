require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;

async function generateAllAttendeesReport() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== GENERATING COMPREHENSIVE ATTENDEES REPORT ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Get total count
    const totalCount = await attendeesCollection.countDocuments();
    console.log(`Total attendees in database: ${totalCount}\n`);
    
    // Get all attendees sorted by name
    const allAttendees = await attendeesCollection.find({})
      .sort({ lastName: 1, firstName: 1 })
      .toArray();
    
    // Generate report data
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalAttendees: totalCount,
        database: 'LodgeTix-migration-test-1'
      },
      statistics: {
        byType: {},
        byEnrichmentStatus: {
          enriched: 0,
          notEnriched: 0
        },
        byDataCompleteness: {
          hasEmail: 0,
          hasPhone: 0,
          hasMembership: 0,
          hasContactPreference: 0
        },
        duplicateAnalysis: {
          uniquePersons: new Set(),
          attendeesWithMultipleRecords: []
        }
      },
      attendees: []
    };
    
    // Track unique persons
    const personMap = new Map();
    
    // Process each attendee
    allAttendees.forEach(attendee => {
      // Create attendee record
      const attendeeRecord = {
        _id: attendee._id.toString(),
        attendeeId: attendee.attendeeId,
        name: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim(),
        email: attendee.email || null,
        phone: attendee.phone || null,
        attendeeType: attendee.attendeeType || 'unknown',
        rank: attendee.rank || null,
        lodge: attendee.lodgeNameNumber || null,
        grandLodge: attendee.grand_lodge || null,
        membership: attendee.membership || null,
        contactPreference: attendee.contactPreference || null,
        registrations: (attendee.registrations || []).map(r => ({
          confirmationNumber: r.confirmationNumber,
          registrationId: r.registrationId,
          functionName: r.functionName
        })),
        tickets: attendee.event_tickets?.length || 0,
        isEnriched: attendee.modificationHistory?.some(h => h.source === 'enrich-all-attendees-complete') || false,
        modificationHistory: (attendee.modificationHistory || []).map(h => ({
          source: h.source,
          operation: h.operation,
          timestamp: h.timestamp
        })),
        createdAt: attendee.createdAt,
        modifiedAt: attendee.modifiedAt
      };
      
      report.attendees.push(attendeeRecord);
      
      // Update statistics
      report.statistics.byType[attendeeRecord.attendeeType] = 
        (report.statistics.byType[attendeeRecord.attendeeType] || 0) + 1;
      
      if (attendeeRecord.isEnriched) {
        report.statistics.byEnrichmentStatus.enriched++;
      } else {
        report.statistics.byEnrichmentStatus.notEnriched++;
      }
      
      if (attendee.email) report.statistics.byDataCompleteness.hasEmail++;
      if (attendee.phone) report.statistics.byDataCompleteness.hasPhone++;
      if (attendee.membership && attendee.membership.LodgeNameNumber) {
        report.statistics.byDataCompleteness.hasMembership++;
      }
      if (attendee.contactPreference) report.statistics.byDataCompleteness.hasContactPreference++;
      
      // Track unique persons
      const personKey = `${attendee.firstName}-${attendee.lastName}`.toLowerCase();
      if (!personMap.has(personKey)) {
        personMap.set(personKey, []);
      }
      personMap.get(personKey).push({
        _id: attendee._id.toString(),
        attendeeId: attendee.attendeeId,
        registrations: attendee.registrations?.length || 0
      });
    });
    
    // Analyze duplicates
    personMap.forEach((records, personKey) => {
      if (records.length > 1) {
        report.statistics.duplicateAnalysis.attendeesWithMultipleRecords.push({
          person: personKey,
          recordCount: records.length,
          records: records
        });
      }
    });
    report.statistics.duplicateAnalysis.uniquePersons = personMap.size;
    
    // Save full report
    await fs.writeFile(
      'all-attendees-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('Full report saved to: all-attendees-report.json\n');
    
    // Print summary
    console.log('=== SUMMARY ===');
    console.log(`Total attendees: ${report.metadata.totalAttendees}`);
    console.log(`Unique persons: ${report.statistics.duplicateAnalysis.uniquePersons}`);
    console.log(`\nBy Type:`);
    Object.entries(report.statistics.byType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    console.log(`\nEnrichment Status:`);
    console.log(`  - Enriched: ${report.statistics.byEnrichmentStatus.enriched} (${(report.statistics.byEnrichmentStatus.enriched / totalCount * 100).toFixed(2)}%)`);
    console.log(`  - Not Enriched: ${report.statistics.byEnrichmentStatus.notEnriched}`);
    console.log(`\nData Completeness:`);
    console.log(`  - Has Email: ${report.statistics.byDataCompleteness.hasEmail} (${(report.statistics.byDataCompleteness.hasEmail / totalCount * 100).toFixed(2)}%)`);
    console.log(`  - Has Phone: ${report.statistics.byDataCompleteness.hasPhone} (${(report.statistics.byDataCompleteness.hasPhone / totalCount * 100).toFixed(2)}%)`);
    console.log(`  - Has Membership: ${report.statistics.byDataCompleteness.hasMembership}`);
    console.log(`  - Has Contact Preference: ${report.statistics.byDataCompleteness.hasContactPreference}`);
    
    console.log(`\nPersons with Multiple Records: ${report.statistics.duplicateAnalysis.attendeesWithMultipleRecords.length}`);
    
    // Show top duplicates
    console.log('\nTop 10 Persons with Multiple Records:');
    report.statistics.duplicateAnalysis.attendeesWithMultipleRecords
      .sort((a, b) => b.recordCount - a.recordCount)
      .slice(0, 10)
      .forEach(dup => {
        console.log(`  - ${dup.person}: ${dup.recordCount} records`);
      });
    
    // Create a simplified CSV report
    const csvLines = ['Name,Email,Phone,Type,Rank,Lodge,Grand Lodge,Registrations,Tickets,Enriched'];
    report.attendees.forEach(att => {
      csvLines.push([
        att.name,
        att.email || '',
        att.phone || '',
        att.attendeeType,
        att.rank || '',
        att.lodge || '',
        att.grandLodge || '',
        att.registrations.map(r => r.confirmationNumber).join(';'),
        att.tickets,
        att.isEnriched ? 'Yes' : 'No'
      ].join(','));
    });
    
    await fs.writeFile('all-attendees-report.csv', csvLines.join('\n'));
    console.log('\nCSV report saved to: all-attendees-report.csv');
    
  } finally {
    await client.close();
  }
}

generateAllAttendeesReport()
  .then(() => console.log('\n✅ Report generation complete'))
  .catch(console.error);