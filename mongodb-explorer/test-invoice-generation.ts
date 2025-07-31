/**
 * Test script to verify invoice generation works after PDFKit fix
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import UnifiedInvoiceService from './src/services/unified-invoice-service';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testInvoiceGeneration() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');

    console.log('🔍 Finding a test payment with matched registration...');
    
    // Find a payment that has a matched registration
    const testPayment = await db.collection('payments').findOne({
      matchedRegistrationId: { $exists: true, $ne: null },
      status: 'paid'
    });

    if (!testPayment) {
      console.error('❌ No matched payments found for testing');
      process.exit(1);
    }

    console.log(`✅ Found test payment: ${testPayment._id}`);
    console.log(`   Payment ID: ${testPayment.paymentId || testPayment.squarePaymentId}`);
    console.log(`   Customer: ${testPayment.customerName}`);
    console.log(`   Amount: $${testPayment.amount}`);

    // Initialize invoice service
    const invoiceService = new UnifiedInvoiceService(db);

    console.log('\n📄 Generating invoice...');
    
    const result = await invoiceService.generateInvoice({
      paymentId: testPayment._id.toString(),
      saveToFile: true,      // Save to local file system
      uploadToSupabase: false, // Don't upload during test
      sendEmail: false,      // Don't send email during test
      regenerate: true       // Force regeneration even if exists
    });

    if (result.success) {
      console.log('✅ Invoice generated successfully!');
      console.log(`   Invoice Number: ${result.invoiceNumber}`);
      console.log(`   PDF Buffer Size: ${result.pdfBuffer?.length || 0} bytes`);
      
      if (result.pdfBuffer && result.pdfBuffer.length > 0) {
        console.log('   PDF generated successfully');
        
        // Save to test directory
        const fs = await import('fs/promises');
        const testPath = path.join(__dirname, 'test-invoices');
        await fs.mkdir(testPath, { recursive: true });
        
        const outputPath = path.join(testPath, `${result.invoiceNumber}.pdf`);
        await fs.writeFile(outputPath, result.pdfBuffer);
        console.log(`   Saved to: ${outputPath}`);
      } else {
        console.error('   ⚠️  PDF buffer is empty');
      }
    } else {
      console.error('❌ Invoice generation failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    console.log('\n🔒 Connection closed');
  }
}

// Run the test
testInvoiceGeneration()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });