const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection
const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const dbName = 'LodgeTix-migration-test-1';
const client = new MongoClient(uri);

async function analyzeIndividualRegistrationsSections() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const registrations = db.collection('registrations');
    
    // Get all individual registrations
    const individuals = await registrations.find({ 
      registrationType: { $in: ['individual', 'individuals'] } 
    }).toArray();
    
    console.log(`\n=== INDIVIDUAL REGISTRATIONS ANALYSIS ===`);
    console.log(`Total Individual Registrations: ${individuals.length}\n`);
    
    // Section 1: Core Registration Fields (always present)
    console.log('SECTION 1: CORE REGISTRATION FIELDS');
    console.log('=====================================');
    
    const coreFields = [
      'registrationId', 'registrationType', 'status', 'registrationDate',
      'eventId', 'functionId', 'organisationId', 'organisationName',
      'customerId', 'authUserId', 'bookingContactId', 'primaryAttendeeId',
      'confirmationNumber', 'agreeToTerms', 'createdAt', 'updatedAt'
    ];
    
    const coreFieldAnalysis = {};
    coreFields.forEach(field => {
      const count = individuals.filter(reg => reg[field] !== undefined).length;
      coreFieldAnalysis[field] = {
        present: count,
        percentage: ((count / individuals.length) * 100).toFixed(1) + '%'
      };
    });
    
    console.log('Core field presence:');
    Object.entries(coreFieldAnalysis).forEach(([field, data]) => {
      console.log(`  ${field}: ${data.present}/${individuals.length} (${data.percentage})`);
    });
    
    // Section 2: Payment Fields
    console.log('\n\nSECTION 2: PAYMENT FIELDS');
    console.log('=========================');
    
    const paymentPatterns = {
      stripeOnly: 0,
      squareOnly: 0,
      both: 0,
      neither: 0
    };
    
    const paymentFields = {
      stripe: ['stripePaymentIntentId', 'stripeFee', 'stripeCustomerId'],
      square: ['squarePaymentId', 'squareFee', 'square_payment_id', 'square_customer_id']
    };
    
    individuals.forEach(reg => {
      const hasStripe = paymentFields.stripe.some(field => reg[field] !== undefined);
      const hasSquare = paymentFields.square.some(field => reg[field] !== undefined);
      
      if (hasStripe && hasSquare) paymentPatterns.both++;
      else if (hasStripe) paymentPatterns.stripeOnly++;
      else if (hasSquare) paymentPatterns.squareOnly++;
      else paymentPatterns.neither++;
    });
    
    console.log('Payment integration patterns:');
    Object.entries(paymentPatterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} (${((count / individuals.length) * 100).toFixed(1)}%)`);
    });
    
    // Section 3: Invoice & Financial Fields
    console.log('\n\nSECTION 3: INVOICE & FINANCIAL FIELDS');
    console.log('=====================================');
    
    const invoiceFields = [
      'invoiceId', 'invoiceStatus', 'invoiceCreated', 'invoiceCreatedAt',
      'customerInvoiceNumber', 'supplierInvoiceNumber',
      'totalAmountPaid', 'totalPricePaid', 'subtotal',
      'platformFeeAmount', 'platformFeeId', 'includesProcessingFee'
    ];
    
    const invoiceAnalysis = {};
    invoiceFields.forEach(field => {
      const count = individuals.filter(reg => reg[field] !== undefined).length;
      if (count > 0) {
        invoiceAnalysis[field] = {
          count,
          percentage: ((count / individuals.length) * 100).toFixed(1) + '%'
        };
      }
    });
    
    console.log('Invoice/Financial field presence:');
    Object.entries(invoiceAnalysis).forEach(([field, data]) => {
      console.log(`  ${field}: ${data.count} (${data.percentage})`);
    });
    
    // Section 4: Update Tracking Fields
    console.log('\n\nSECTION 4: UPDATE TRACKING FIELDS');
    console.log('=================================');
    
    const updateFields = [
      'lastPriceUpdate', 'priceUpdateReason',
      'lastTicketNameUpdate', 'ticketNameUpdateReason'
    ];
    
    const updatePatterns = {
      noTracking: 0,
      priceOnly: 0,
      ticketOnly: 0,
      both: 0
    };
    
    individuals.forEach(reg => {
      const hasPrice = reg.lastPriceUpdate !== undefined;
      const hasTicket = reg.lastTicketNameUpdate !== undefined;
      
      if (hasPrice && hasTicket) updatePatterns.both++;
      else if (hasPrice) updatePatterns.priceOnly++;
      else if (hasTicket) updatePatterns.ticketOnly++;
      else updatePatterns.noTracking++;
    });
    
    console.log('Update tracking patterns:');
    Object.entries(updatePatterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} (${((count / individuals.length) * 100).toFixed(1)}%)`);
    });
    
    // Section 5: Registration Data Analysis
    console.log('\n\nSECTION 5: REGISTRATION DATA STRUCTURE');
    console.log('======================================');
    
    const regDataPatterns = new Map();
    
    individuals.forEach(reg => {
      if (reg.registrationData) {
        const pattern = {
          hasAttendees: !!reg.registrationData.attendees,
          attendeeCount: reg.registrationData.attendees ? reg.registrationData.attendees.length : 0,
          hasTickets: !!reg.registrationData.tickets,
          hasBookingContact: !!reg.registrationData.bookingContact,
          topLevelFields: Object.keys(reg.registrationData).sort()
        };
        
        const key = JSON.stringify(pattern);
        if (!regDataPatterns.has(key)) {
          regDataPatterns.set(key, { count: 0, pattern });
        }
        regDataPatterns.get(key).count++;
      }
    });
    
    console.log(`Found ${regDataPatterns.size} different registrationData patterns:`);
    
    Array.from(regDataPatterns.values())
      .sort((a, b) => b.count - a.count)
      .forEach((data, idx) => {
        console.log(`\nPattern ${idx + 1} (${data.count} registrations):`);
        console.log(`  Attendee count: ${data.pattern.attendeeCount}`);
        console.log(`  Has tickets: ${data.pattern.hasTickets}`);
        console.log(`  Has booking contact: ${data.pattern.hasBookingContact}`);
        console.log(`  Top-level fields: ${data.pattern.topLevelFields.length}`);
        if (data.pattern.topLevelFields.length <= 20) {
          console.log(`  Fields: ${data.pattern.topLevelFields.join(', ')}`);
        }
      });
    
    // Section 6: Attendee Structure Analysis
    console.log('\n\nSECTION 6: ATTENDEE STRUCTURE VARIATIONS');
    console.log('========================================');
    
    const attendeePatterns = new Map();
    let totalAttendees = 0;
    
    individuals.forEach(reg => {
      if (reg.registrationData && reg.registrationData.attendees) {
        reg.registrationData.attendees.forEach(attendee => {
          totalAttendees++;
          const fields = Object.keys(attendee).sort();
          const key = fields.join(',');
          
          if (!attendeePatterns.has(key)) {
            attendeePatterns.set(key, { count: 0, fields, exampleId: reg._id });
          }
          attendeePatterns.get(key).count++;
        });
      }
    });
    
    console.log(`Total attendees across all individual registrations: ${totalAttendees}`);
    console.log(`Unique attendee structures: ${attendeePatterns.size}`);
    
    Array.from(attendeePatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((pattern, idx) => {
        console.log(`\nAttendee Pattern ${idx + 1} (${pattern.count} attendees):`);
        console.log(`  Field count: ${pattern.fields.length}`);
        console.log(`  Example registration: ${pattern.exampleId}`);
        
        // Group fields by category
        const categories = {
          identity: pattern.fields.filter(f => ['firstName', 'lastName', 'title', 'postNominals'].includes(f)),
          lodge: pattern.fields.filter(f => f.includes('lodge') || f.includes('Lodge')),
          contact: pattern.fields.filter(f => f.includes('email') || f.includes('phone') || f.includes('contact')),
          status: pattern.fields.filter(f => ['isCheckedIn', 'isPrimary', 'isPartner', 'paymentStatus'].includes(f)),
          other: pattern.fields.filter(f => !['firstName', 'lastName', 'title', 'postNominals'].includes(f) &&
                                           !f.includes('lodge') && !f.includes('Lodge') &&
                                           !f.includes('email') && !f.includes('phone') && !f.includes('contact') &&
                                           !['isCheckedIn', 'isPrimary', 'isPartner', 'paymentStatus'].includes(f))
        };
        
        Object.entries(categories).forEach(([category, fields]) => {
          if (fields.length > 0) {
            console.log(`  ${category} fields (${fields.length}): ${fields.join(', ')}`);
          }
        });
      });
    
    // Section 7: Edge Cases and Special Fields
    console.log('\n\nSECTION 7: EDGE CASES & SPECIAL FIELDS');
    console.log('======================================');
    
    const specialFields = {};
    
    individuals.forEach(reg => {
      Object.keys(reg).forEach(field => {
        if (!coreFields.includes(field) && 
            !invoiceFields.includes(field) && 
            !updateFields.includes(field) &&
            !paymentFields.stripe.includes(field) &&
            !paymentFields.square.includes(field) &&
            !['_id', '__v', 'registrationData'].includes(field)) {
          
          if (!specialFields[field]) {
            specialFields[field] = 0;
          }
          specialFields[field]++;
        }
      });
    });
    
    console.log('Special/Edge case fields:');
    Object.entries(specialFields)
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        console.log(`  ${field}: ${count} occurrences (${((count / individuals.length) * 100).toFixed(1)}%)`);
      });
    
    // Generate summary report
    const report = {
      summary: {
        totalIndividuals: individuals.length,
        analysisDate: new Date().toISOString()
      },
      sections: {
        coreFields: coreFieldAnalysis,
        paymentPatterns,
        invoiceFields: invoiceAnalysis,
        updateTracking: updatePatterns,
        registrationDataPatterns: Array.from(regDataPatterns.values()),
        attendeePatterns: {
          totalAttendees,
          uniqueStructures: attendeePatterns.size,
          topPatterns: Array.from(attendeePatterns.values()).slice(0, 5)
        },
        specialFields
      }
    };
    
    const outputPath = path.join(__dirname, '../outputs/individual-registrations-section-analysis.json');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error analyzing individual registrations:', error);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeIndividualRegistrationsSections().catch(console.error);