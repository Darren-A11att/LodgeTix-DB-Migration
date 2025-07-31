const axios = require('axios');

async function testInvoiceListAPI() {
  try {
    console.log('Testing payments API endpoint...\n');
    
    // Test the payments endpoint
    const response = await axios.get('http://localhost:3006/api/collections/payments/documents', {
      params: {
        skip: 0,
        limit: 200,  // Get more to ensure we find Troy
        search: 'quimpo'
      }
    });
    
    console.log(`Total payments: ${response.data.total}`);
    console.log(`Returned: ${response.data.documents.length}`);
    
    // Look for Troy Quimpo
    const troyPayments = response.data.documents.filter(payment => {
      const name = (payment.customerName || '').toLowerCase();
      const email = (payment.customerEmail || '').toLowerCase();
      return name.includes('quimpo') || email.includes('quimpo');
    });
    
    if (troyPayments.length > 0) {
      console.log(`\n✅ Found ${troyPayments.length} Troy Quimpo payment(s):\n`);
      troyPayments.forEach(payment => {
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`  Customer: ${payment.customerName}`);
        console.log(`  Email: ${payment.customerEmail}`);
        console.log(`  Amount: $${payment.amount}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Invoice Created: ${payment.invoiceCreated || false}`);
        console.log('');
      });
    } else {
      console.log('\n❌ Troy Quimpo payment not found in API response');
      
      // Try without search filter
      console.log('\nTrying without search filter...');
      const allResponse = await axios.get('http://localhost:3006/api/collections/payments/documents', {
        params: {
          skip: 0,
          limit: 200
        }
      });
      
      const troyInAll = allResponse.data.documents.filter(payment => {
        const name = (payment.customerName || '').toLowerCase();
        const email = (payment.customerEmail || '').toLowerCase();
        return name.includes('quimpo') || email.includes('quimpo');
      });
      
      if (troyInAll.length > 0) {
        console.log(`\n✅ Found Troy Quimpo in unfiltered results`);
      } else {
        console.log(`\n❌ Troy Quimpo not found even in unfiltered results`);
        console.log(`Total payments returned: ${allResponse.data.documents.length}`);
      }
    }
    
  } catch (error) {
    console.error('Error calling API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testInvoiceListAPI();