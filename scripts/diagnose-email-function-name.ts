import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

async function diagnoseEmailFunctionName() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('DIAGNOSIS: Email Function Name Issue for Invoice LTIV-250623027\n');
    console.log('='.repeat(80));
    
    // 1. Find the invoice
    const invoice = await db.collection('invoices').findOne({
      invoiceNumber: 'LTIV-250623027'
    });
    
    if (!invoice) {
      console.log('❌ Invoice LTIV-250623027 not found!');
      return;
    }
    
    console.log('\n1. INVOICE RECORD:');
    console.log(`   - Invoice Number: ${invoice.invoiceNumber}`);
    console.log(`   - Payment ID: ${invoice.paymentId}`);
    console.log(`   - Registration ID: ${invoice.registrationId}`);
    console.log(`   - Email Sent: ${invoice.emailSent || false}`);
    console.log(`   - Invoice Items:`, JSON.stringify(invoice.items, null, 2));
    
    // 2. Check the payment
    if (invoice.paymentId) {
      const payment = await db.collection('payments').findOne({
        _id: invoice.paymentId
      });
      
      if (payment) {
        console.log('\n2. PAYMENT RECORD:');
        console.log(`   - Payment ID: ${payment._id}`);
        console.log(`   - Customer Name: ${payment.customerName}`);
        console.log(`   - Amount: ${payment.amount}`);
        console.log(`   - Confirmation Number: ${payment.confirmationNumber || 'NOT SET'}`);
      }
    }
    
    // 3. Check the registration
    if (invoice.registrationId) {
      const registration = await db.collection('registrations').findOne({
        _id: invoice.registrationId
      });
      
      if (registration) {
        console.log('\n3. REGISTRATION RECORD:');
        console.log(`   - Registration ID: ${registration._id}`);
        console.log(`   - Confirmation Number: ${registration.confirmationNumber}`);
        console.log(`   - Function ID: ${registration.functionId || 'NOT SET'}`);
        console.log(`   - Function Name: ${registration.functionName || 'NOT SET'}`);
        console.log(`   - Registration Type: ${registration.registrationType}`);
        
        // 4. Check the function
        if (registration.functionId) {
          const func = await db.collection('functions').findOne({
            functionId: registration.functionId
          });
          
          if (func) {
            console.log('\n4. FUNCTION RECORD:');
            console.log(`   - Function Name: ${func.name}`);
            console.log(`   - Function ID: ${func.functionId}`);
          } else {
            console.log('\n4. FUNCTION RECORD: NOT FOUND!');
          }
        }
      }
    }
    
    // 5. Check if there's a mismatch between what's in the invoice and what should be there
    console.log('\n5. ANALYSIS:');
    
    // Check the invoice items for function name
    const hasCorrectFunctionName = invoice.items?.some((item: any) => 
      item.description?.includes('Grand Proclamation 2025')
    );
    
    console.log(`   - Invoice has correct function name in items: ${hasCorrectFunctionName ? 'YES' : 'NO'}`);
    console.log(`   - Email sent flag: ${invoice.emailSent || false}`);
    
    // Look for email metadata
    if (invoice.email) {
      console.log('\n6. EMAIL METADATA:');
      console.log(`   - Email ID: ${invoice.email.id}`);
      console.log(`   - Sent: ${invoice.email.sent}`);
      console.log(`   - Subject: ${invoice.email.subject}`);
      
      // Check if subject has function name
      const subjectHasFunction = invoice.email.subject?.includes('Grand Proclamation 2025');
      console.log(`   - Subject has correct function name: ${subjectHasFunction ? 'NO - Using "Function"' : 'YES'}`);
    }
    
    // 7. The ROOT CAUSE
    console.log('\n7. ROOT CAUSE ANALYSIS:');
    console.log('   The issue is likely that when the email is sent from the invoice preview modal,');
    console.log('   the effectiveRegistration object may not be fully populated with the functionId');
    console.log('   or the function lookup is failing silently.');
    console.log('\n   Key finding: The invoice PDF has the correct function name but the email does not.');
    console.log('   This suggests the registration data is available during PDF generation but not');
    console.log('   during email sending, OR the functionId lookup is failing.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the diagnosis
diagnoseEmailFunctionName().catch(console.error);