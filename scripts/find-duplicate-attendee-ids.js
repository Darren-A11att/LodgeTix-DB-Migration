require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;

async function findDuplicateAttendeeIds() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== FINDING ATTENDEES WITH DUPLICATE ATTENDEEIDs ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Aggregate to find duplicate attendeeIds
    const duplicates = await attendeesCollection.aggregate([
      {
        $group: {
          _id: '$attendeeId',
          count: { $sum: 1 },
          records: {
            $push: {
              _id: '$_id',
              firstName: '$firstName',
              lastName: '$lastName',
              email: '$email',
              phone: '$phone',
              attendeeType: '$attendeeType',
              registrations: '$registrations',
              createdAt: '$createdAt',
              modifiedAt: '$modifiedAt'
            }
          }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: {
          count: -1,
          _id: 1
        }
      }
    ]).toArray();
    
    console.log(`Found ${duplicates.length} attendeeIds with duplicate records\n`);
    
    // Create detailed report
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        database: 'LodgeTix-migration-test-1',
        totalDuplicateAttendeeIds: duplicates.length,
        totalDuplicateRecords: 0
      },
      duplicates: []
    };
    
    // Process each duplicate group
    for (const dup of duplicates) {
      const duplicateGroup = {
        attendeeId: dup._id,
        recordCount: dup.count,
        personName: `${dup.records[0].firstName} ${dup.records[0].lastName}`,
        records: []
      };
      
      report.metadata.totalDuplicateRecords += dup.count;
      
      // Process each record in the duplicate group
      for (const record of dup.records) {
        const registrations = record.registrations || [];
        
        duplicateGroup.records.push({
          _id: record._id.toString(),
          name: `${record.firstName} ${record.lastName}`,
          email: record.email || null,
          phone: record.phone || null,
          attendeeType: record.attendeeType || null,
          registrationCount: registrations.length,
          registrations: registrations.map(r => ({
            confirmationNumber: r.confirmationNumber,
            registrationId: r.registrationId,
            functionName: r.functionName || 'Unknown'
          })),
          createdAt: record.createdAt,
          modifiedAt: record.modifiedAt
        });
      }
      
      // Sort records by creation date
      duplicateGroup.records.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
      report.duplicates.push(duplicateGroup);
    }
    
    // Add summary statistics
    report.summary = {
      totalUniquePersons: duplicates.length,
      totalDuplicateRecords: report.metadata.totalDuplicateRecords,
      averageRecordsPerPerson: (report.metadata.totalDuplicateRecords / duplicates.length).toFixed(2),
      distribution: {}
    };
    
    // Calculate distribution (how many people have 2, 3, 4+ records)
    duplicates.forEach(dup => {
      const count = dup.count.toString();
      report.summary.distribution[count] = (report.summary.distribution[count] || 0) + 1;
    });
    
    // Save the report
    await fs.writeFile(
      'duplicate-attendee-ids-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('Report saved to: duplicate-attendee-ids-report.json\n');
    
    // Print summary
    console.log('=== SUMMARY ===');
    console.log(`Total attendeeIds with duplicates: ${report.metadata.totalDuplicateAttendeeIds}`);
    console.log(`Total duplicate records: ${report.metadata.totalDuplicateRecords}`);
    console.log(`Average records per duplicate attendeeId: ${report.summary.averageRecordsPerPerson}`);
    
    console.log('\nDistribution of duplicates:');
    Object.entries(report.summary.distribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([count, num]) => {
        console.log(`  - ${num} attendeeIds have ${count} records`);
      });
    
    console.log('\nTop 10 duplicate attendeeIds:');
    report.duplicates.slice(0, 10).forEach(dup => {
      console.log(`  - ${dup.personName} (${dup.attendeeId}): ${dup.recordCount} records`);
      dup.records.forEach((rec, idx) => {
        console.log(`      ${idx + 1}. ${rec.registrations.map(r => r.confirmationNumber).join(', ') || 'No registrations'}`);
      });
    });
    
    // Check for potential issues
    console.log('\n\n=== POTENTIAL ISSUES ===');
    let issuesFound = false;
    
    report.duplicates.forEach(dup => {
      // Check if records have different names
      const names = new Set(dup.records.map(r => r.name));
      if (names.size > 1) {
        if (!issuesFound) {
          console.log('\nAttendeeIds with different names across records:');
          issuesFound = true;
        }
        console.log(`  - ${dup.attendeeId}: ${Array.from(names).join(' vs ')}`);
      }
      
      // Check if records have conflicting data
      const emails = new Set(dup.records.map(r => r.email).filter(e => e));
      const phones = new Set(dup.records.map(r => r.phone).filter(p => p));
      
      if (emails.size > 1) {
        console.log(`  - ${dup.personName} has different emails: ${Array.from(emails).join(', ')}`);
      }
      if (phones.size > 1) {
        console.log(`  - ${dup.personName} has different phones: ${Array.from(phones).join(', ')}`);
      }
    });
    
    if (!issuesFound) {
      console.log('No naming inconsistencies found across duplicate records.');
    }
    
  } finally {
    await client.close();
  }
}

findDuplicateAttendeeIds()
  .then(() => console.log('\n✅ Duplicate attendeeId analysis complete'))
  .catch(console.error);