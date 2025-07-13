import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { PaymentImport } from '../types/payment-import';

/**
 * Test the payment import workflow by creating mock data
 * This allows testing the UI and workflow without Square API access
 */

async function testPaymentImportWorkflow() {
  const connection = await connectMongoDB();
  const db = connection.db;
  
  try {
    console.log('=== TESTING PAYMENT IMPORT WORKFLOW ===\n');
    
    // Clear existing test data
    console.log('Clearing existing test data...');
    await db.collection<PaymentImport>('payment_imports').deleteMany({
      importId: { $regex: /^TEST-/ }
    });
    
    // Create mock payment imports
    const mockPayments: PaymentImport[] = [
      {
        importId: 'TEST-IMPORT-001',
        importedAt: new Date(),
        importedBy: 'test-script',
        
        // Square Payment Data
        squarePaymentId: 'sq_payment_001',
        transactionId: 'sq_payment_001',
        amount: 100.00,
        amountFormatted: '$100.00',
        currency: 'USD',
        status: 'COMPLETED',
        createdAt: new Date('2025-07-01T10:00:00Z'),
        updatedAt: new Date('2025-07-01T10:00:00Z'),
        
        // Customer Information
        customerEmail: 'john.doe@example.com',
        customerName: 'John Doe',
        
        // Payment Details
        paymentMethod: 'CARD',
        cardBrand: 'VISA',
        last4: '1234',
        
        // Processing Status
        processingStatus: 'pending',
        
        // Raw data
        rawSquareData: {}
      },
      {
        importId: 'TEST-IMPORT-001',
        importedAt: new Date(),
        importedBy: 'test-script',
        
        squarePaymentId: 'sq_payment_002',
        transactionId: 'sq_payment_002',
        amount: 250.00,
        amountFormatted: '$250.00',
        currency: 'USD',
        status: 'COMPLETED',
        createdAt: new Date('2025-07-02T14:30:00Z'),
        updatedAt: new Date('2025-07-02T14:30:00Z'),
        
        customerEmail: 'jane.smith@example.com',
        customerName: 'Jane Smith',
        
        paymentMethod: 'CARD',
        cardBrand: 'MASTERCARD',
        last4: '5678',
        
        processingStatus: 'pending',
        
        rawSquareData: {}
      },
      {
        importId: 'TEST-IMPORT-001',
        importedAt: new Date(),
        importedBy: 'test-script',
        
        squarePaymentId: 'sq_payment_003',
        transactionId: 'sq_payment_003',
        amount: 175.50,
        amountFormatted: '$175.50',
        currency: 'USD',
        status: 'COMPLETED',
        createdAt: new Date('2025-07-03T09:15:00Z'),
        updatedAt: new Date('2025-07-03T09:15:00Z'),
        
        customerEmail: 'lodge123@example.com',
        customerName: 'Lodge 123',
        
        paymentMethod: 'CARD',
        cardBrand: 'AMEX',
        last4: '9012',
        
        processingStatus: 'pending',
        
        orderReference: 'LDG-432725637K',
        
        rawSquareData: {}
      }
    ];
    
    // Insert mock payments
    console.log(`Inserting ${mockPayments.length} mock payments...`);
    const result = await db.collection<PaymentImport>('payment_imports').insertMany(mockPayments);
    console.log(`✓ Inserted ${result.insertedCount} mock payments\n`);
    
    // Create a test batch record
    const testBatch = {
      batchId: 'TEST-BATCH-001',
      startedAt: new Date(),
      startedBy: 'test-script',
      completedAt: new Date(),
      dateRange: {
        start: new Date('2025-07-01'),
        end: new Date('2025-07-12')
      },
      totalPayments: mockPayments.length,
      importedPayments: mockPayments.length,
      skippedPayments: 0,
      failedPayments: 0,
      status: 'completed' as const
    };
    
    await db.collection('import_batches').insertOne(testBatch);
    console.log('✓ Created test batch record\n');
    
    // Display summary
    console.log('=== TEST DATA CREATED ===');
    console.log(`Import ID: TEST-IMPORT-001`);
    console.log(`Batch ID: TEST-BATCH-001`);
    console.log(`Payments created: ${mockPayments.length}`);
    console.log('\nSample payments:');
    
    mockPayments.forEach((payment, index) => {
      console.log(`\n${index + 1}. ${payment.customerName || 'Unknown'}`);
      console.log(`   Amount: ${payment.amountFormatted}`);
      console.log(`   Email: ${payment.customerEmail}`);
      console.log(`   Date: ${payment.createdAt.toLocaleDateString()}`);
      if (payment.orderReference) {
        console.log(`   Reference: ${payment.orderReference}`);
      }
    });
    
    console.log('\n✅ Test data created successfully!');
    console.log('\nYou can now:');
    console.log('1. View payments in the MongoDB Explorer UI');
    console.log('2. Test the payment matching workflow');
    console.log('3. Process items through the import queue');
    
  } catch (error) {
    console.error('Error creating test data:', error);
  } finally {
    await connection.client.close();
  }
}

// Run the test
testPaymentImportWorkflow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});