const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function auditTroyQuimpoRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== AUDIT: TROY QUIMPO REGISTRATIONS & PAYMENTS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const transactionsCollection = db.collection('squareTransactions');
    
    // Get all Troy Quimpo registrations
    const troyRegistrations = await registrationsCollection.find({
      $or: [
        { 'registrationData.bookingContact.emailAddress': 'troyquimpo@yahoo.com' },
        { 'registrationData.bookingContact.firstName': 'Troy', 'registrationData.bookingContact.lastName': 'Quimpo' }
      ]
    }).toArray();
    
    console.log(`Found ${troyRegistrations.length} registration(s) for Troy Quimpo:\n`);
    
    for (const reg of troyRegistrations) {
      console.log(`Registration: ${reg.confirmationNumber}`);
      console.log(`  Type: ${reg.registrationType}`);
      console.log(`  Amount: $${reg.totalAmountPaid}`);
      console.log(`  Square Payment ID: ${reg.squarePaymentId || 'None'}`);
      console.log(`  Function ID: ${reg.functionId}`);
      console.log(`  Created: ${reg.createdAt}`);
      
      if (reg.registrationType === 'lodge') {
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'Unknown'}`);
      }
      
      console.log('');
    }
    
    // Get all Troy Quimpo payments
    const troyPayments = await transactionsCollection.find({
      $or: [
        { 'summary.customerEmail': 'troyquimpo@yahoo.com' },
        { 'customer.email_address': 'troyquimpo@yahoo.com' }
      ]
    }).toArray();
    
    console.log(`\nFound ${troyPayments.length} payment(s) for Troy Quimpo:\n`);
    
    for (const payment of troyPayments) {
      console.log(`Payment: ${payment._id}`);
      console.log(`  Amount: $${(payment.summary.amount / 100).toFixed(2)}`);
      console.log(`  Date: ${payment.payment.created_at}`);
      console.log(`  Status: ${payment.payment.status}`);
      
      if (payment.order?.metadata) {
        console.log(`  Order Type: ${payment.order.metadata.registration_type}`);
        console.log(`  Lodge: ${payment.order.metadata.lodge_name || 'N/A'}`);
      }
      
      // Check if this payment is linked to any registration
      const linkedReg = await registrationsCollection.findOne({ squarePaymentId: payment._id });
      if (linkedReg) {
        console.log(`  ✅ Linked to: ${linkedReg.confirmationNumber} (${linkedReg.registrationType})`);
      } else {
        console.log(`  ❌ Not linked to any registration`);
      }
      
      console.log('');
    }
    
    // Check for issues
    console.log('=== ISSUES FOUND ===\n');
    
    // Check for registrations with wrong payment IDs
    const wrongPaymentIssues = [];
    
    for (const reg of troyRegistrations) {
      if (reg.squarePaymentId) {
        const payment = await transactionsCollection.findOne({ _id: reg.squarePaymentId });
        
        if (!payment) {
          wrongPaymentIssues.push({
            registration: reg.confirmationNumber,
            issue: `Payment ${reg.squarePaymentId} not found in database`
          });
        } else if (Math.abs((payment.summary.amount / 100) - reg.totalAmountPaid) > 0.01) {
          wrongPaymentIssues.push({
            registration: reg.confirmationNumber,
            issue: `Amount mismatch: Registration $${reg.totalAmountPaid} vs Payment $${(payment.summary.amount / 100).toFixed(2)}`
          });
        } else if (reg.registrationType === 'lodge' && payment.order?.metadata?.registration_type !== 'lodge') {
          wrongPaymentIssues.push({
            registration: reg.confirmationNumber,
            issue: `Type mismatch: Lodge registration linked to ${payment.order?.metadata?.registration_type || 'unknown'} payment`
          });
        }
      }
    }
    
    if (wrongPaymentIssues.length > 0) {
      console.log('Payment linking issues:');
      wrongPaymentIssues.forEach(issue => {
        console.log(`  - ${issue.registration}: ${issue.issue}`);
      });
    } else {
      console.log('✅ No payment linking issues found');
    }
    
    // Check for the specific lodge payment
    console.log('\n=== LODGE PAYMENT HXi6TI41gIR5NbndF5uOQotM2b6YY ===\n');
    
    const lodgePayment = await transactionsCollection.findOne({ _id: 'HXi6TI41gIR5NbndF5uOQotM2b6YY' });
    
    if (lodgePayment) {
      console.log('Payment details:');
      console.log(`  Amount: $${(lodgePayment.summary.amount / 100).toFixed(2)}`);
      console.log(`  Order Type: ${lodgePayment.order?.metadata?.registration_type}`);
      console.log(`  Lodge: ${lodgePayment.order?.metadata?.lodge_name}`);
      
      // Find all registrations linked to this payment
      const linkedRegs = await registrationsCollection.find({ 
        squarePaymentId: 'HXi6TI41gIR5NbndF5uOQotM2b6YY' 
      }).toArray();
      
      console.log(`\nRegistrations linked to this payment: ${linkedRegs.length}`);
      
      linkedRegs.forEach(reg => {
        console.log(`  - ${reg.confirmationNumber} (${reg.registrationType}) - $${reg.totalAmountPaid}`);
      });
      
      if (linkedRegs.length > 1) {
        console.log('\n⚠️  WARNING: Multiple registrations linked to the same payment!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the audit
auditTroyQuimpoRegistrations();