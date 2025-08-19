// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { stringify } = require('csv-stringify');
const fs = require('fs');

async function extractAllLodgeRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Connected to MongoDB\n');
    console.log('Finding ALL lodge registrations in the database...\n');
    
    // Find ALL lodge registrations (both processed and unprocessed)
    const lodgeRegistrations = await db.collection('registrations').find({
      $or: [
        { registrationType: 'lodge' },
        { confirmationNumber: { $regex: '^LDG-' } }
      ]
    }).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} total lodge registrations\n`);
    
    // Analyze the registrations
    const analysis = {
      total: lodgeRegistrations.length,
      withInvoices: 0,
      withoutInvoices: 0,
      byOrganisation: {},
      byAttendeeCount: {},
      byMonth: {},
      totalAmount: 0,
      totalAttendees: 0
    };
    
    const detailedData = [];
    
    for (const registration of lodgeRegistrations) {
      // Find associated payment
      let payment = null;
      
      // Try different methods to find payment
      if (registration.stripePaymentIntentId) {
        payment = await db.collection('payments').findOne({
          $or: [
            { 'PaymentIntent ID': registration.stripePaymentIntentId },
            { paymentId: registration.stripePaymentIntentId },
            { transactionId: registration.stripePaymentIntentId }
          ]
        });
      }
      
      // Check if has invoice
      const hasInvoice = !!(registration.invoiceCreated || registration.customerInvoiceNumber);
      if (hasInvoice) {
        analysis.withInvoices++;
      } else {
        analysis.withoutInvoices++;
      }
      
      // Track by organization
      const orgName = registration.organisationName || registration.lodgeName || 'Unknown';
      analysis.byOrganisation[orgName] = (analysis.byOrganisation[orgName] || 0) + 1;
      
      // Track by attendee count
      const attendeeCount = registration.attendeeCount || 0;
      analysis.byAttendeeCount[attendeeCount] = (analysis.byAttendeeCount[attendeeCount] || 0) + 1;
      analysis.totalAttendees += attendeeCount;
      
      // Track by month
      const regDate = new Date(registration.registrationDate || registration.createdAt);
      const monthKey = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}`;
      analysis.byMonth[monthKey] = (analysis.byMonth[monthKey] || 0) + 1;
      
      // Get amount from payment
      let amount = 0;
      if (payment) {
        amount = payment.grossAmount || payment.amount || 0;
        analysis.totalAmount += amount;
      }
      
      // Extract booking contact
      const bookingContact = registration.registrationData?.bookingContact || {};
      
      // Add to detailed data
      detailedData.push({
        confirmationNumber: registration.confirmationNumber,
        organisationName: orgName,
        organisationNumber: registration.organisationNumber,
        attendeeCount: attendeeCount,
        tableCount: registration.tableCount || 0,
        registrationDate: registration.registrationDate || registration.createdAt,
        paymentDate: payment?.paymentDate || payment?.timestamp || payment?.createdAt,
        amount: amount,
        hasInvoice: hasInvoice,
        invoiceNumber: registration.customerInvoiceNumber || '',
        contactName: `${bookingContact.firstName || ''} ${bookingContact.lastName || ''}`.trim(),
        contactEmail: bookingContact.email || bookingContact.emailAddress || '',
        contactPhone: bookingContact.mobile || bookingContact.phone || '',
        functionId: registration.functionId,
        functionName: registration.functionName || 'Grand Proclamation 2025',
        paymentStatus: registration.paymentStatus || payment?.status || '',
        stripePaymentIntentId: registration.stripePaymentIntentId || ''
      });
    }
    
    // Display analysis
    console.log('Lodge Registration Analysis:');
    console.log(`  Total registrations: ${analysis.total}`);
    console.log(`  With invoices: ${analysis.withInvoices}`);
    console.log(`  Without invoices: ${analysis.withoutInvoices}`);
    console.log(`  Total attendees: ${analysis.totalAttendees}`);
    console.log(`  Total amount: $${analysis.totalAmount.toFixed(2)}`);
    
    console.log('\nBy Attendee Count:');
    Object.entries(analysis.byAttendeeCount)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([count, num]) => {
        console.log(`  ${count} attendees: ${num} lodges`);
      });
    
    console.log('\nBy Month:');
    Object.entries(analysis.byMonth)
      .sort()
      .forEach(([month, count]) => {
        console.log(`  ${month}: ${count} registrations`);
      });
    
    console.log('\nTop 10 Organisations by Registration Count:');
    Object.entries(analysis.byOrganisation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([org, count], idx) => {
        console.log(`  ${idx + 1}. ${org}: ${count} registrations`);
      });
    
    // Save to CSV
    const csvPath = 'all-lodge-registrations.csv';
    stringify(detailedData, { header: true }, (err, output) => {
      if (err) {
        console.error('Error creating CSV:', err);
      } else {
        fs.writeFileSync(csvPath, output);
        console.log(`\nAll lodge registrations saved to ${csvPath}`);
      }
    });
    
    // Save detailed JSON
    const jsonPath = 'all-lodge-registrations.json';
    fs.writeFileSync(jsonPath, JSON.stringify(detailedData, null, 2));
    console.log(`Detailed data saved to ${jsonPath}`);
    
    // Save summary
    const summaryPath = 'lodge-registrations-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify({
      analysis: analysis,
      generatedAt: new Date().toISOString()
    }, null, 2));
    console.log(`Summary saved to ${summaryPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

extractAllLodgeRegistrations().catch(console.error);
