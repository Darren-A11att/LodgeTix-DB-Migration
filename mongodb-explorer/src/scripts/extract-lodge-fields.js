require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const { stringify } = require('csv-stringify');
const fs = require('fs');

async function extractLodgeFields() {
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
    
    // Find all unprocessed lodge registrations and their payments
    const unprocessedPayments = await db.collection('payments').find({
      $and: [
        {
          $or: [
            { status: 'paid' },
            { paymentStatus: 'paid' }
          ]
        },
        {
          $and: [
            { invoiceCreated: { $ne: true } },
            { customerInvoiceNumber: { $exists: false } }
          ]
        }
      ]
    }).toArray();
    
    console.log('Finding lodge registrations...\n');
    
    const lodgeData = [];
    const allFields = new Set();
    const fieldAnalysis = {};
    
    // Collect all lodge registrations with their payments
    for (const payment of unprocessedPayments) {
      let registration = null;
      
      // Find matching registration
      if (payment.matchedRegistrationId || payment.registrationId) {
        const regId = payment.matchedRegistrationId || payment.registrationId;
        registration = await db.collection('registrations').findOne({ _id: regId });
      } else if (payment['PaymentIntent ID']) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment['PaymentIntent ID'] 
        });
      } else if (payment.paymentId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.paymentId 
        });
      }
      
      if (registration && (registration.registrationType === 'lodge' || 
          (registration.confirmationNumber && registration.confirmationNumber.startsWith('LDG-')))) {
        
        // Combine payment and registration data
        const combinedData = {
          payment: payment,
          registration: registration
        };
        
        lodgeData.push(combinedData);
        
        // Extract all fields from payment
        extractFields(payment, 'payment', allFields, fieldAnalysis);
        
        // Extract all fields from registration
        extractFields(registration, 'registration', allFields, fieldAnalysis);
      }
    }
    
    console.log(`Found ${lodgeData.length} lodge registrations\n`);
    
    // Analyze field patterns
    console.log('Field Analysis:\n');
    const sortedFields = Array.from(allFields).sort();
    
    // Group fields by prefix
    const fieldGroups = {};
    sortedFields.forEach(field => {
      const prefix = field.split('.')[0];
      if (!fieldGroups[prefix]) {
        fieldGroups[prefix] = [];
      }
      fieldGroups[prefix].push(field);
    });
    
    // Display field groups
    Object.entries(fieldGroups).forEach(([prefix, fields]) => {
      console.log(`\n${prefix.toUpperCase()} Fields (${fields.length}):`);
      fields.forEach(field => {
        const analysis = fieldAnalysis[field];
        const percentage = ((analysis.count / lodgeData.length) * 100).toFixed(1);
        const types = Array.from(analysis.types).join(', ');
        console.log(`  ${field}: ${percentage}% populated (types: ${types})`);
        
        // Show sample values for interesting fields
        if (analysis.sampleValues.size > 0 && analysis.sampleValues.size <= 5) {
          const samples = Array.from(analysis.sampleValues).slice(0, 3);
          console.log(`    Examples: ${samples.map(v => JSON.stringify(v)).join(', ')}`);
        }
      });
    });
    
    // Create normalized invoice data structure
    console.log('\n\nCreating normalized invoice data...\n');
    
    const normalizedInvoices = lodgeData.map(({ payment, registration }) => {
      // Extract key fields for invoice generation
      const bookingContact = registration.registrationData?.bookingContact || {};
      const amount = payment.grossAmount || payment.amount || 0;
      const stripeFee = payment.stripeFee || registration.stripeFee || { $numberDecimal: "0" };
      const stripeFeeAmount = stripeFee.$numberDecimal ? parseFloat(stripeFee.$numberDecimal) : stripeFee;
      
      return {
        // Payment Info
        paymentId: payment._id,
        paymentDate: payment.paymentDate || payment.timestamp || payment.createdAt,
        paymentMethod: payment.paymentMethod || payment.type || 'credit_card',
        paymentStatus: payment.status || payment.paymentStatus,
        transactionId: payment.transactionId || payment['PaymentIntent ID'] || payment.paymentId,
        
        // Registration Info
        registrationId: registration._id,
        confirmationNumber: registration.confirmationNumber,
        registrationType: registration.registrationType,
        registrationDate: registration.registrationDate || registration.createdAt,
        
        // Lodge Info
        organisationName: registration.organisationName || registration.lodgeName || 'Unknown Lodge',
        organisationNumber: registration.organisationNumber || registration.lodgeNumber,
        organisationId: registration.organisationId || registration.lodgeId,
        
        // Event Info
        functionId: registration.functionId,
        functionName: registration.functionName || 'Grand Proclamation 2025',
        eventId: registration.eventId,
        
        // Attendee Info
        attendeeCount: registration.attendeeCount || 0,
        tableCount: registration.tableCount || 0,
        
        // Financial Info
        totalAmount: amount,
        subtotal: amount - stripeFeeAmount,
        processingFee: stripeFeeAmount,
        currency: payment.currency || 'AUD',
        
        // Contact Info
        bookingContact: {
          firstName: bookingContact.firstName || '',
          lastName: bookingContact.lastName || '',
          email: bookingContact.email || bookingContact.emailAddress || payment.customerEmail || '',
          phone: bookingContact.phone || bookingContact.phoneNumber || '',
          businessName: bookingContact.businessName || registration.organisationName || '',
          addressLine1: bookingContact.addressLine1 || bookingContact.address?.line1 || '',
          addressLine2: bookingContact.addressLine2 || bookingContact.address?.line2 || '',
          city: bookingContact.city || bookingContact.address?.city || '',
          state: bookingContact.state || bookingContact.stateProvince || bookingContact.address?.state || '',
          postalCode: bookingContact.postalCode || bookingContact.postcode || bookingContact.address?.postalCode || '',
          country: bookingContact.country || bookingContact.address?.country || 'Australia'
        },
        
        // Additional metadata
        hasAttendeeDetails: registration.attendees && registration.attendees.length > 0,
        hasTicketDetails: registration.selectedTickets && registration.selectedTickets.length > 0,
        needsInvoice: true
      };
    });
    
    // Save to CSV for easy viewing
    const csvPath = 'lodge-invoice-data.csv';
    const csvData = normalizedInvoices.map(inv => ({
      confirmationNumber: inv.confirmationNumber,
      organisationName: inv.organisationName,
      attendeeCount: inv.attendeeCount,
      totalAmount: inv.totalAmount,
      processingFee: inv.processingFee,
      contactName: `${inv.bookingContact.firstName} ${inv.bookingContact.lastName}`.trim(),
      contactEmail: inv.bookingContact.email,
      paymentDate: new Date(inv.paymentDate).toISOString()
    }));
    
    stringify(csvData, { header: true }, (err, output) => {
      if (err) {
        console.error('Error creating CSV:', err);
      } else {
        fs.writeFileSync(csvPath, output);
        console.log(`Normalized data saved to ${csvPath}`);
      }
    });
    
    // Display sample normalized data
    console.log('\nSample Normalized Invoice Data:');
    normalizedInvoices.slice(0, 2).forEach((inv, idx) => {
      console.log(`\n${idx + 1}. ${inv.confirmationNumber} - ${inv.organisationName}`);
      console.log(`   Attendees: ${inv.attendeeCount}`);
      console.log(`   Total: $${inv.totalAmount}`);
      console.log(`   Processing Fee: $${inv.processingFee}`);
      console.log(`   Contact: ${inv.bookingContact.firstName} ${inv.bookingContact.lastName}`);
      console.log(`   Email: ${inv.bookingContact.email}`);
    });
    
    // Save full normalized data as JSON
    const jsonPath = 'lodge-invoice-data.json';
    fs.writeFileSync(jsonPath, JSON.stringify(normalizedInvoices, null, 2));
    console.log(`\nFull normalized data saved to ${jsonPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Helper function to extract fields recursively
function extractFields(obj, prefix, allFields, fieldAnalysis, maxDepth = 5) {
  if (!obj || maxDepth <= 0) return;
  
  Object.entries(obj).forEach(([key, value]) => {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    allFields.add(fieldPath);
    
    // Initialize field analysis
    if (!fieldAnalysis[fieldPath]) {
      fieldAnalysis[fieldPath] = {
        count: 0,
        types: new Set(),
        sampleValues: new Set()
      };
    }
    
    if (value !== null && value !== undefined) {
      fieldAnalysis[fieldPath].count++;
      fieldAnalysis[fieldPath].types.add(typeof value);
      
      // Collect sample values for non-object types
      if (typeof value !== 'object' && fieldAnalysis[fieldPath].sampleValues.size < 5) {
        fieldAnalysis[fieldPath].sampleValues.add(value);
      }
      
      // Recurse for objects
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && 
          !value._id && !value.$numberDecimal) {
        extractFields(value, fieldPath, allFields, fieldAnalysis, maxDepth - 1);
      }
    }
  });
}

extractLodgeFields().catch(console.error);