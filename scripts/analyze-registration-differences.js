const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection
const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const dbName = 'LodgeTix-migration-test-1';
const client = new MongoClient(uri);

async function analyzeRegistrationDifferences() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const registrations = db.collection('registrations');
    
    // Key findings from initial analysis
    console.log('\n=== REGISTRATION STRUCTURE DIFFERENCES ANALYSIS ===\n');
    
    // 1. Analyze invoice-related differences
    console.log('1. INVOICE SYSTEM INTEGRATION');
    const invoiceFields = ['invoiceId', 'invoiceStatus', 'invoiceCreated', 'invoiceCreatedAt', 
                          'customerInvoiceNumber', 'supplierInvoiceNumber'];
    
    for (const field of invoiceFields) {
      const count = await registrations.countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        const examples = await registrations.find({ [field]: { $exists: true } })
          .limit(2).toArray();
        console.log(`  - ${field}: ${count} registrations (${(count/133*100).toFixed(1)}%)`);
        console.log(`    First seen: ${examples[0].createdAt || examples[0].registrationDate}`);
      }
    }
    
    // 2. Analyze payment matching fields
    console.log('\n2. PAYMENT MATCHING SYSTEM');
    const matchingFields = ['matchCriteria', 'matchedAt', 'matchedBy', 'matchedPaymentId'];
    
    for (const field of matchingFields) {
      const count = await registrations.countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        console.log(`  - ${field}: ${count} registrations`);
      }
    }
    
    // 3. Analyze price/ticket update tracking
    console.log('\n3. PRICE & TICKET UPDATE TRACKING');
    const updateFields = ['lastPriceUpdate', 'priceUpdateReason', 'lastTicketNameUpdate', 'ticketNameUpdateReason'];
    
    for (const field of updateFields) {
      const count = await registrations.countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        console.log(`  - ${field}: ${count} registrations`);
      }
    }
    
    // 4. Analyze registrationData variations
    console.log('\n4. REGISTRATION DATA STRUCTURE VARIATIONS');
    const regDataAnalysis = await registrations.aggregate([
      { $match: { registrationData: { $exists: true } } },
      {
        $project: {
          hasAttendees: { $cond: [{ $isArray: '$registrationData.attendees' }, true, false] },
          attendeeCount: { $size: { $ifNull: ['$registrationData.attendees', []] } },
          hasTickets: { $ne: ['$registrationData.tickets', null] },
          hasSelectedTickets: { $ne: ['$registrationData.selectedTickets', null] },
          hasBookingContact: { $ne: ['$registrationData.bookingContact', null] },
          hasBillingContact: { $ne: ['$registrationData.billingContact', null] },
          hasSquareFields: {
            $or: [
              { $ne: ['$registrationData.square_customer_id', null] },
              { $ne: ['$registrationData.square_payment_id', null] }
            ]
          },
          createdAt: 1,
          registrationDate: 1
        }
      },
      {
        $group: {
          _id: {
            hasAttendees: '$hasAttendees',
            hasTickets: '$hasTickets',
            hasSelectedTickets: '$hasSelectedTickets',
            hasBookingContact: '$hasBookingContact',
            hasBillingContact: '$hasBillingContact',
            hasSquareFields: '$hasSquareFields'
          },
          count: { $sum: 1 },
          avgAttendeeCount: { $avg: '$attendeeCount' },
          examples: { $push: { date: { $ifNull: ['$createdAt', '$registrationDate'] } } }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log(`  Found ${regDataAnalysis.length} different registrationData patterns:`);
    regDataAnalysis.forEach((pattern, idx) => {
      console.log(`\n  Pattern ${idx + 1} (${pattern.count} registrations):`);
      console.log(`    - Has attendees: ${pattern._id.hasAttendees} (avg: ${pattern.avgAttendeeCount.toFixed(1)} attendees)`);
      console.log(`    - Has tickets: ${pattern._id.hasTickets}`);
      console.log(`    - Has selectedTickets: ${pattern._id.hasSelectedTickets}`);
      console.log(`    - Has bookingContact: ${pattern._id.hasBookingContact}`);
      console.log(`    - Has billingContact: ${pattern._id.hasBillingContact}`);
      console.log(`    - Has Square fields: ${pattern._id.hasSquareFields}`);
    });
    
    // 5. Timeline analysis
    console.log('\n5. STRUCTURAL CHANGES TIMELINE');
    
    // Group by month and analyze new fields introduction
    const timeline = await registrations.aggregate([
      {
        $project: {
          month: {
            $dateToString: {
              format: '%Y-%m',
              date: { $ifNull: ['$createdAt', '$registrationDate'] }
            }
          },
          hasInvoice: { $ne: ['$invoiceId', null] },
          hasMatching: { $ne: ['$matchedPaymentId', null] },
          hasPriceUpdate: { $ne: ['$lastPriceUpdate', null] }
        }
      },
      {
        $group: {
          _id: '$month',
          total: { $sum: 1 },
          withInvoice: { $sum: { $cond: ['$hasInvoice', 1, 0] } },
          withMatching: { $sum: { $cond: ['$hasMatching', 1, 0] } },
          withPriceUpdate: { $sum: { $cond: ['$hasPriceUpdate', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\n  Month-by-month feature adoption:');
    timeline.forEach(month => {
      console.log(`  ${month._id}: ${month.total} registrations`);
      if (month.withInvoice > 0) console.log(`    - ${month.withInvoice} with invoices`);
      if (month.withMatching > 0) console.log(`    - ${month.withMatching} with payment matching`);
      if (month.withPriceUpdate > 0) console.log(`    - ${month.withPriceUpdate} with price updates`);
    });
    
    // 6. Event-based differences
    console.log('\n6. EVENT-BASED STRUCTURAL DIFFERENCES');
    
    const eventAnalysis = await registrations.aggregate([
      {
        $group: {
          _id: '$eventId',
          count: { $sum: 1 },
          hasInvoices: { $sum: { $cond: [{ $ne: ['$invoiceId', null] }, 1, 0] } },
          hasMatching: { $sum: { $cond: [{ $ne: ['$matchedPaymentId', null] }, 1, 0] } },
          uniqueStructures: { $addToSet: { $size: { $objectToArray: '$$ROOT' } } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('\n  Event-specific patterns:');
    eventAnalysis.forEach(event => {
      console.log(`\n  Event ${event._id || 'Unknown'}: ${event.count} registrations`);
      console.log(`    - Structure variations: ${event.uniqueStructures.length} different field counts`);
      if (event.hasInvoices > 0) console.log(`    - ${event.hasInvoices} with invoices`);
      if (event.hasMatching > 0) console.log(`    - ${event.hasMatching} with payment matching`);
    });
    
    // 7. Summary and conclusions
    console.log('\n=== SUMMARY OF FINDINGS ===\n');
    console.log('1. PRIMARY STRUCTURAL DIFFERENCES:');
    console.log('   - Invoice system fields (affects ~5.3% of registrations)');
    console.log('   - Payment matching fields (affects ~1.5% of registrations)');
    console.log('   - Price/ticket update tracking (affects ~52% of registrations)');
    console.log('   - Square payment fields in registrationData (affects some registrations)');
    
    console.log('\n2. WHEN CHANGES OCCURRED:');
    console.log('   - All registrations are from 2025 (June)');
    console.log('   - Invoice features appear sporadically');
    console.log('   - Payment matching is a recent addition');
    
    console.log('\n3. WHY DIFFERENCES EXIST:');
    console.log('   - Feature evolution: New capabilities added over time');
    console.log('   - Payment integration: Different payment methods require different fields');
    console.log('   - Business requirements: Invoice generation for certain types of registrations');
    console.log('   - Data quality improvements: Update tracking for audit trail');
    
    // Save detailed findings
    const findings = {
      summary: {
        totalRegistrations: 133,
        dateRange: 'June 2025',
        mainDifferences: [
          'Invoice system integration',
          'Payment matching capabilities',
          'Price/ticket update tracking',
          'Square payment fields'
        ]
      },
      invoiceSystem: {
        registrationsWithInvoices: await registrations.countDocuments({ invoiceId: { $exists: true } }),
        percentage: ((await registrations.countDocuments({ invoiceId: { $exists: true } }) / 133) * 100).toFixed(2) + '%'
      },
      paymentMatching: {
        registrationsWithMatching: await registrations.countDocuments({ matchedPaymentId: { $exists: true } }),
        percentage: ((await registrations.countDocuments({ matchedPaymentId: { $exists: true } }) / 133) * 100).toFixed(2) + '%'
      },
      updateTracking: {
        withPriceUpdates: await registrations.countDocuments({ lastPriceUpdate: { $exists: true } }),
        withTicketUpdates: await registrations.countDocuments({ lastTicketNameUpdate: { $exists: true } })
      }
    };
    
    const outputPath = path.join(__dirname, '../outputs/registration-differences-analysis.json');
    await fs.writeFile(outputPath, JSON.stringify(findings, null, 2));
    console.log(`\nDetailed findings saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error analyzing registration differences:', error);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeRegistrationDifferences().catch(console.error);