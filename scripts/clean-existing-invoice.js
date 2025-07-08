const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function cleanExistingInvoice() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Find the invoice by invoice number
    const invoiceNumber = 'LTIV-250618002';
    const invoice = await db.collection('invoices').findOne({ invoiceNumber });
    
    if (!invoice) {
      console.error(`Invoice ${invoiceNumber} not found`);
      return;
    }
    
    console.log('Found invoice:', invoice._id);
    
    // Clean invoice data based on the actual invoice content
    const cleanedInvoice = {
      invoiceNumber: 'LTIV-250618002',
      invoiceType: 'customer',
      date: invoice.date || new Date('2025-06-18'),
      status: 'paid',
      billTo: {
        firstName: 'Darren',
        lastName: 'May',
        email: 'dazza6@outlook.com',
        addressLine1: '4/1 Hawkesbury Ave',
        city: 'Dee Why',
        postalCode: '2099'
      },
      billFrom: invoice.billFrom || {
        name: 'United Grand Lodge of NSW & ACT',
        abn: '93 230 340 687',
        address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
        issuedBy: 'LodgeTix as Agent'
      },
      items: [
        {
          description: 'IND-651444UM | Registration for Grand Proclamation 2025',
          quantity: 1,
          price: 0
        },
        {
          description: 'VW Bro Darren May GL | Lodge Balgowlah No. 392 | 0407 018 369',
          quantity: 1,
          price: 0
        },
        {
          description: 'dazza6@outlook.com',
          quantity: 1,
          price: 0
        },
        {
          description: '- - Grand Proclamation Ceremony',
          quantity: 1,
          price: 20.00
        },
        {
          description: '- - Proclamation Banquet - Best Available',
          quantity: 1,
          price: 115.00
        }
      ],
      subtotal: 135.00,
      processingFees: 4.01,
      total: 139.01,
      gstIncluded: 12.64,
      payment: {
        method: 'card',
        cardBrand: 'Visa',
        last4: '7070',
        gateway: 'Stripe',
        date: new Date('2025-06-18'),
        amount: 139.01,
        transactionId: 'ch_3RbB3uCari1bgsWq093773W4',
        status: 'paid'
      },
      paymentId: invoice.paymentId,
      registrationId: invoice.registrationId,
      createdAt: invoice.createdAt,
      updatedAt: new Date()
    };
    
    // Remove all mapping-related fields
    const fieldsToRemove = [
      'lineItemMappings',
      'lineItems',
      'arrayMappings',
      'fieldMappingConfig',
      'descriptionSegments',
      'quantityMapping',
      'priceMapping'
    ];
    
    // Build the update operation
    const updateOp = {
      $set: cleanedInvoice,
      $unset: {}
    };
    
    // Add fields to unset
    fieldsToRemove.forEach(field => {
      updateOp.$unset[field] = "";
    });
    
    // Update the invoice
    const result = await db.collection('invoices').updateOne(
      { _id: invoice._id },
      updateOp
    );
    
    console.log('Invoice updated:', result.modifiedCount);
    
    // Also update the payment record if it has the invoice data
    if (invoice.paymentId) {
      const paymentResult = await db.collection('payments').updateOne(
        { _id: invoice.paymentId },
        {
          $set: {
            'customerInvoice': cleanedInvoice
          }
        }
      );
      console.log('Payment record updated:', paymentResult.modifiedCount);
    }
    
    // Also update the registration record if it has the invoice data
    if (invoice.registrationId) {
      const registrationResult = await db.collection('registrations').updateOne(
        { _id: invoice.registrationId },
        {
          $set: {
            'customerInvoice': cleanedInvoice
          }
        }
      );
      console.log('Registration record updated:', registrationResult.modifiedCount);
    }
    
    console.log('Invoice cleaning completed successfully');
    
  } catch (error) {
    console.error('Error cleaning invoice:', error);
  } finally {
    await client.close();
  }
}

cleanExistingInvoice();