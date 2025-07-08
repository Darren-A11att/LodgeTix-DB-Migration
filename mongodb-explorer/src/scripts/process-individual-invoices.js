require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

// Import the individual invoice generator
const { generateIndividualInvoice } = require('./generate-individual-invoice');

// Helper function to get monetary value
function getMonetaryValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// Generate invoice numbers via API
async function generateInvoiceNumbers(paymentDate) {
  try {
    const response = await axios.post('http://localhost:3005/api/invoices/generate-number', {
      date: paymentDate
    });
    return response.data;
  } catch (error) {
    console.error('Error generating invoice numbers:', error.message);
    throw error;
  }
}

// Transform customer invoice to supplier invoice
function transformToSupplierInvoice(customerInvoice, payment, supplierInvoiceNumber) {
  return {
    ...customerInvoice,
    invoiceType: 'supplier',
    invoiceNumber: supplierInvoiceNumber,
    billTo: {
      businessName: 'United Grand Lodge of NSW & ACT',
      businessNumber: '93 230 340 687',
      firstName: '',
      lastName: '',
      email: 'admin@uglnsw.org.au',
      addressLine1: 'Level 5, 279 Castlereagh St',
      addressLine2: '',
      city: 'Sydney',
      postalCode: '2000',
      stateProvince: 'NSW',
      country: 'Australia'
    },
    supplier: {
      name: 'LodgeTix',
      abn: '93 230 340 687',
      address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
      issuedBy: 'LodgeTix'
    },
    items: [],
    subtotal: 0,
    processingFees: getMonetaryValue(payment.stripeFee || 0),
    total: getMonetaryValue(payment.stripeFee || 0)
  };
}

async function processIndividualInvoices() {
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
    
    console.log('Connected to MongoDB');
    console.log('Finding unprocessed individual registrations...\n');
    
    // Find payments that are paid but don't have invoice data
    const unprocessedPayments = await db.collection('payments').find({
      $and: [
        {
          $or: [
            { status: 'paid' },
            { paymentStatus: 'paid' }
          ]
        },
        {
          $or: [
            { invoiceData: { $exists: false } },
            { invoiceData: null },
            { 'invoiceData.invoiceNumber': { $exists: false } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${unprocessedPayments.length} payments without invoice data`);
    
    // Get limit from command line or default to 5
    const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;
    const paymentsToProcess = unprocessedPayments.slice(0, limit);
    console.log(`Processing first ${paymentsToProcess.length} payments...\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each payment
    for (const payment of paymentsToProcess) {
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
      } else if (payment.transactionId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.transactionId 
        });
      }
      
      if (!registration) {
        console.log(`No registration found for payment ${payment._id}`);
        continue;
      }
      
      console.log(`\nProcessing payment ${payment._id} with registration ${registration.confirmationNumber}...`);
      
      try {
        // Generate invoice numbers
        const paymentDate = payment.paymentDate || payment.timestamp || payment.createdAt || new Date();
        const { customerInvoiceNumber, supplierInvoiceNumber } = await generateInvoiceNumbers(paymentDate);
        console.log(`Generated invoice numbers: ${customerInvoiceNumber}, ${supplierInvoiceNumber}`);
        
        // Get event tickets for this registration
        let eventTickets = [];
        if (registration.functionId) {
          eventTickets = await db.collection('eventTickets').find({
            functionId: registration.functionId
          }).toArray();
        }
        
        // Prepare related documents
        const relatedDocuments = {
          eventTickets: eventTickets
        };
        
        // Generate customer invoice
        let customerInvoice;
        if (registration.attendees && registration.attendees.length > 0) {
          // Use the individual invoice generator for registrations with attendees
          customerInvoice = generateIndividualInvoice(
            payment,
            registration,
            customerInvoiceNumber,
            relatedDocuments
          );
        } else {
          // Create a simpler invoice for registrations without attendees
          const bookingContact = registration?.registrationData?.bookingContact || {};
          customerInvoice = {
            invoiceType: 'customer',
            invoiceNumber: customerInvoiceNumber,
            paymentId: payment._id,
            registrationId: registration._id,
            date: paymentDate,
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
            
            billTo: {
              businessName: bookingContact.businessName || '',
              businessNumber: bookingContact.businessNumber || '',
              firstName: bookingContact.firstName || '',
              lastName: bookingContact.lastName || '',
              email: bookingContact.email || bookingContact.emailAddress || payment.customerEmail || '',
              addressLine1: bookingContact.addressLine1 || bookingContact.address?.line1 || '',
              addressLine2: bookingContact.addressLine2 || bookingContact.address?.line2 || '',
              city: bookingContact.city || bookingContact.address?.city || '',
              postalCode: bookingContact.postalCode || bookingContact.address?.postalCode || '',
              stateProvince: bookingContact.stateProvince || bookingContact.address?.state || '',
              country: bookingContact.country || bookingContact.address?.country || 'Australia'
            },
            
            supplier: {
              name: 'United Grand Lodge of NSW & ACT',
              abn: '93 230 340 687',
              address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
              issuedBy: 'LodgeTix as Agent'
            },
            
            items: [],
            subtotal: 0,
            processingFees: 0,
            total: getMonetaryValue(payment.grossAmount || payment.amount || 0),
            
            payment: {
              method: payment.paymentMethod || 'credit_card',
              transactionId: payment.transactionId || payment.originalData?.id || '',
              paidDate: paymentDate,
              amount: getMonetaryValue(payment.grossAmount || payment.amount || 0),
              currency: payment.currency || 'AUD',
              last4: payment.cardLast4 || payment.last4 || '',
              cardBrand: payment.cardBrand || '',
              status: payment.status?.toLowerCase() === 'paid' ? 'completed' : payment.status || 'completed',
              source: payment.source || 'stripe'
            },
            
            status: 'paid',
            notes: ''
          };
        }
        
        // Generate supplier invoice
        const supplierInvoice = transformToSupplierInvoice(customerInvoice, payment, supplierInvoiceNumber);
        
        // Call the create-atomic API
        const response = await axios.post('http://localhost:3005/api/invoices/create-atomic', {
          payment: payment,
          registration: registration,
          customerInvoice: customerInvoice,
          supplierInvoice: supplierInvoice
        }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          processedCount++;
          console.log(`✓ Created invoices: ${response.data.customerInvoiceNumber} / ${response.data.supplierInvoiceNumber}`);
          console.log(`  - Invoice ID: ${response.data.invoiceId}`);
          console.log(`  - Transactions: ${response.data.transactionCount}`);
          
          // Check status details
          if (response.data.status) {
            const status = response.data.status;
            console.log(`  - Status details:`);
            console.log(`    • Invoice numbers generated: ${status.invoiceNumbersGenerated}`);
            console.log(`    • Invoices inserted: ${status.invoicesInserted}`);
            console.log(`    • Transactions created: ${status.transactionsCreated}`);
            console.log(`    • Payment updated: ${status.paymentUpdated}`);
            console.log(`    • Registration updated: ${status.registrationUpdated}`);
            if (!status.paymentUpdated || !status.registrationUpdated) {
              console.log(`  ⚠️  WARNING: Document updates failed!`);
            }
          }
        } else {
          errorCount++;
          console.error(`✗ Failed to create invoice: ${response.data.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Error creating invoice: ${error.response?.data?.error || error.message}`);
      }
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n\nSummary:`);
    console.log(`Total payments processed: ${processedCount + errorCount}`);
    console.log(`Successfully created invoices: ${processedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

processIndividualInvoices().catch(console.error);