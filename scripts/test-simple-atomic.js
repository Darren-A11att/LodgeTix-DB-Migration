#!/usr/bin/env node

async function testSimpleAtomic() {
  try {
    console.log('Testing simple atomic creation...\n');
    
    // Simple test data
    const testData = {
      payment: {
        _id: '685c0b9df861ce10c3124785',
        transactionId: 'test-tx-001',
        grossAmount: 21.47
      },
      registration: {
        _id: '685beba0b2fa6b693adabc1e',
        registrationId: 'test-reg-001',
        confirmationNumber: 'TEST-001'
      },
      customerInvoice: {
        billTo: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
        supplier: { name: 'Test Supplier' },
        items: [{ description: 'Test Item', quantity: 1, price: 20 }],
        subtotal: 20,
        total: 21.47,
        invoiceType: 'customer'
      },
      supplierInvoice: {
        billTo: { businessName: 'Test Business' },
        supplier: { name: 'Test Agent' },
        items: [{ description: 'Fee', quantity: 1, price: 1.47 }],
        subtotal: 1.47,
        total: 1.47,
        invoiceType: 'supplier'
      }
    };
    
    console.log('Calling API with payment._id:', testData.payment._id);
    console.log('Type:', typeof testData.payment._id);
    
    const response = await fetch('http://localhost:3005/api/invoices/create-atomic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSimpleAtomic();