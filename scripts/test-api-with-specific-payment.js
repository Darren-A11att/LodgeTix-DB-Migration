const http = require('http');

async function testAPIWithSpecificPayment() {
  try {
    console.log('=== TESTING API WITH SPECIFIC PAYMENT ID ===\n');
    
    // Try to get more results
    const data = await new Promise((resolve, reject) => {
      const url = 'http://localhost:3006/api/invoices/matches?limit=50';
      console.log('Fetching from:', url);
      
      http.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    console.log('Total matches returned:', data.matches?.length || 0);
    console.log('Total available:', data.total);
    
    // Look for our specific payment
    const targetMatch = data.matches?.find(m => 
      m.payment?.paymentId === 'vJBWFiJ8DfI6MSq2MB50eKJDibMZY'
    );
    
    if (targetMatch) {
      console.log('\n✅ FOUND THE TARGET PAYMENT!');
      console.log('Position in results:', data.matches.indexOf(targetMatch) + 1);
      
      // Check the invoice structure
      if (targetMatch.invoice) {
        console.log('\n=== BACKEND INVOICE PREVIEW ===');
        console.log('Has invoice:', true);
        console.log('Items count:', targetMatch.invoice.items?.length || 0);
        
        if (targetMatch.invoice.items && targetMatch.invoice.items.length > 0) {
          console.log('\nFirst few items:');
          targetMatch.invoice.items.slice(0, 5).forEach((item, i) => {
            console.log(`${i + 1}. "${item.description}" - $${item.amount}`);
          });
        }
      } else {
        console.log('\n❌ NO INVOICE IN RESPONSE!');
        console.log('The backend is not generating the invoice preview');
      }
    } else {
      console.log('\n❌ Payment not found in results');
      
      // Show payment IDs we did find
      console.log('\nPayment IDs in results:');
      data.matches?.slice(0, 10).forEach((m, i) => {
        console.log(`${i + 1}. ${m.payment?.paymentId || 'No ID'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testAPIWithSpecificPayment();