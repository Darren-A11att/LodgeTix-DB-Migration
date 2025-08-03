require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;

async function analyzeDuplicateFieldsDetailed() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== ANALYZING DUPLICATE ATTENDEE RECORDS - DETAILED FIELD COMPARISON ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Find duplicate attendeeIds
    const duplicates = await attendeesCollection.aggregate([
      {
        $group: {
          _id: '$attendeeId',
          count: { $sum: 1 },
          records: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: {
          count: -1
        }
      }
    ]).toArray();
    
    console.log(`Found ${duplicates.length} attendeeIds with duplicate records\n`);
    
    const detailedAnalysis = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalDuplicateGroups: duplicates.length
      },
      fieldComparisons: [],
      summary: {
        sameAttendeeId: 0,
        differentRegistrationIds: 0,
        differentPaymentIds: 0,
        differentRegistrationTypes: 0,
        differentConfirmationNumbers: 0,
        differentLodges: 0
      }
    };
    
    // Analyze each duplicate group
    for (const group of duplicates) {
      const personName = `${group.records[0].firstName} ${group.records[0].lastName}`;
      console.log(`\nAnalyzing: ${personName} (${group._id})`);
      console.log(`Records: ${group.count}`);
      
      const comparison = {
        attendeeId: group._id,
        personName: personName,
        recordCount: group.count,
        records: [],
        fieldAnalysis: {
          attendeeId: { same: true, values: new Set([group._id]) },
          registrationIds: { same: null, values: new Set() },
          paymentIds: { same: null, values: new Set() },
          registrationTypes: { same: null, values: new Set() },
          confirmationNumbers: { same: null, values: new Set() },
          lodgeNameNumbers: { same: null, values: new Set() }
        }
      };
      
      // Process each record
      for (let i = 0; i < group.records.length; i++) {
        const record = group.records[i];
        const registrations = record.registrations || [];
        
        // Get payment IDs from registrations
        const paymentIds = [];
        for (const reg of registrations) {
          if (reg.paymentId) paymentIds.push(reg.paymentId);
          
          // Also check the registration document for payment info
          const regDoc = await db.collection('registrations').findOne({ 
            registrationId: reg.registrationId 
          });
          
          if (regDoc) {
            if (regDoc.paymentId) paymentIds.push(regDoc.paymentId);
            if (regDoc.stripe_payment_intent_id) paymentIds.push(regDoc.stripe_payment_intent_id);
            if (regDoc.squarePaymentId) paymentIds.push(regDoc.squarePaymentId);
          }
        }
        
        const recordData = {
          _id: record._id.toString(),
          attendeeId: record.attendeeId,
          registrations: registrations.map(r => ({
            registrationId: r.registrationId,
            confirmationNumber: r.confirmationNumber,
            registrationType: r.registrationType,
            paymentId: r.paymentId || null
          })),
          paymentIds: [...new Set(paymentIds)],
          lodgeNameNumber: record.lodgeNameNumber || record.membership?.LodgeNameNumber || null
        };
        
        comparison.records.push(recordData);
        
        // Collect values for comparison
        registrations.forEach(reg => {
          if (reg.registrationId) comparison.fieldAnalysis.registrationIds.values.add(reg.registrationId);
          if (reg.confirmationNumber) comparison.fieldAnalysis.confirmationNumbers.values.add(reg.confirmationNumber);
          if (reg.registrationType) comparison.fieldAnalysis.registrationTypes.values.add(reg.registrationType);
        });
        
        paymentIds.forEach(pid => {
          if (pid) comparison.fieldAnalysis.paymentIds.values.add(pid);
        });
        
        if (recordData.lodgeNameNumber) {
          comparison.fieldAnalysis.lodgeNameNumbers.values.add(recordData.lodgeNameNumber);
        }
      }
      
      // Determine if values are same or different
      comparison.fieldAnalysis.registrationIds.same = comparison.fieldAnalysis.registrationIds.values.size <= 1;
      comparison.fieldAnalysis.paymentIds.same = comparison.fieldAnalysis.paymentIds.values.size <= 1;
      comparison.fieldAnalysis.registrationTypes.same = comparison.fieldAnalysis.registrationTypes.values.size <= 1;
      comparison.fieldAnalysis.confirmationNumbers.same = comparison.fieldAnalysis.confirmationNumbers.values.size <= 1;
      comparison.fieldAnalysis.lodgeNameNumbers.same = comparison.fieldAnalysis.lodgeNameNumbers.values.size <= 1;
      
      // Update summary
      detailedAnalysis.summary.sameAttendeeId++;
      if (!comparison.fieldAnalysis.registrationIds.same) detailedAnalysis.summary.differentRegistrationIds++;
      if (!comparison.fieldAnalysis.paymentIds.same) detailedAnalysis.summary.differentPaymentIds++;
      if (!comparison.fieldAnalysis.registrationTypes.same) detailedAnalysis.summary.differentRegistrationTypes++;
      if (!comparison.fieldAnalysis.confirmationNumbers.same) detailedAnalysis.summary.differentConfirmationNumbers++;
      if (!comparison.fieldAnalysis.lodgeNameNumbers.same) detailedAnalysis.summary.differentLodges++;
      
      // Convert sets to arrays for JSON
      comparison.fieldAnalysis.attendeeId.values = Array.from(comparison.fieldAnalysis.attendeeId.values);
      comparison.fieldAnalysis.registrationIds.values = Array.from(comparison.fieldAnalysis.registrationIds.values);
      comparison.fieldAnalysis.paymentIds.values = Array.from(comparison.fieldAnalysis.paymentIds.values);
      comparison.fieldAnalysis.registrationTypes.values = Array.from(comparison.fieldAnalysis.registrationTypes.values);
      comparison.fieldAnalysis.confirmationNumbers.values = Array.from(comparison.fieldAnalysis.confirmationNumbers.values);
      comparison.fieldAnalysis.lodgeNameNumbers.values = Array.from(comparison.fieldAnalysis.lodgeNameNumbers.values);
      
      detailedAnalysis.fieldComparisons.push(comparison);
      
      // Print summary for this group
      console.log('  Field comparison:');
      console.log(`    - AttendeeId: SAME (${group._id})`);
      console.log(`    - RegistrationIds: ${comparison.fieldAnalysis.registrationIds.same ? 'SAME' : 'DIFFERENT'} (${comparison.fieldAnalysis.registrationIds.values.length} unique)`);
      console.log(`    - PaymentIds: ${comparison.fieldAnalysis.paymentIds.same ? 'SAME' : 'DIFFERENT'} (${comparison.fieldAnalysis.paymentIds.values.length} unique)`);
      console.log(`    - RegistrationTypes: ${comparison.fieldAnalysis.registrationTypes.same ? 'SAME' : 'DIFFERENT'} (${comparison.fieldAnalysis.registrationTypes.values.join(', ') || 'none'})`);
      console.log(`    - ConfirmationNumbers: ${comparison.fieldAnalysis.confirmationNumbers.same ? 'SAME' : 'DIFFERENT'} (${comparison.fieldAnalysis.confirmationNumbers.values.length} unique)`);
      console.log(`    - LodgeNameNumbers: ${comparison.fieldAnalysis.lodgeNameNumbers.same ? 'SAME' : 'DIFFERENT'} (${comparison.fieldAnalysis.lodgeNameNumbers.values.join(', ') || 'none'})`);
    }
    
    // Save detailed report
    await fs.writeFile(
      'duplicate-fields-analysis.json',
      JSON.stringify(detailedAnalysis, null, 2)
    );
    
    console.log('\n\n=== OVERALL SUMMARY ===');
    console.log(`Total duplicate groups analyzed: ${detailedAnalysis.metadata.totalDuplicateGroups}`);
    console.log('\nField consistency across duplicate records:');
    console.log(`  - AttendeeId: ALL SAME (by definition)`);
    console.log(`  - RegistrationIds: ${detailedAnalysis.summary.differentRegistrationIds} groups have DIFFERENT values`);
    console.log(`  - PaymentIds: ${detailedAnalysis.summary.differentPaymentIds} groups have DIFFERENT values`);
    console.log(`  - RegistrationTypes: ${detailedAnalysis.summary.differentRegistrationTypes} groups have DIFFERENT values`);
    console.log(`  - ConfirmationNumbers: ${detailedAnalysis.summary.differentConfirmationNumbers} groups have DIFFERENT values`);
    console.log(`  - LodgeNameNumbers: ${detailedAnalysis.summary.differentLodges} groups have DIFFERENT values`);
    
    console.log('\nDetailed report saved to: duplicate-fields-analysis.json');
    
  } finally {
    await client.close();
  }
}

analyzeDuplicateFieldsDetailed()
  .then(() => console.log('\n✅ Analysis complete'))
  .catch(console.error);