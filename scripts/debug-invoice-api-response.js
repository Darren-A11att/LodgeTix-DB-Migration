const http = require('http');

async function debugInvoiceAPIResponse() {
  try {
    console.log('=== DEBUGGING INVOICE API RESPONSE ===\n');
    
    // Make a request to the API
    const data = await new Promise((resolve, reject) => {
      http.get('http://localhost:3006/api/invoices/matches?limit=5', (res) => {
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
    
    // Find the specific registration we're interested in
    const targetMatch = data.matches?.find(m => 
      m.registration?.confirmationNumber === 'IND-820047IW' ||
      m.payment?.paymentId === 'vJBWFiJ8DfI6MSq2MB50eKJDibMZY'
    );
    
    if (targetMatch) {
      console.log('\n=== FOUND TARGET MATCH ===');
      console.log('Registration:', targetMatch.registration?.confirmationNumber);
      console.log('Payment ID:', targetMatch.payment?.paymentId);
      
      // Check what invoice data is returned
      console.log('\n=== INVOICE DATA FROM API ===');
      if (targetMatch.invoice) {
        console.log('Invoice exists:', true);
        console.log('Invoice Number:', targetMatch.invoice.invoiceNumber);
        console.log('Items count:', targetMatch.invoice.items?.length || 0);
        
        if (targetMatch.invoice.items) {
          console.log('\nInvoice Items:');
          targetMatch.invoice.items.forEach((item, i) => {
            console.log(`\n${i + 1}. ${item.description || '(no description)'}`);
            console.log(`   Type: ${item.type || 'unknown'}`);
            console.log(`   Amount: $${item.amount || 0}`);
            
            if (item.subItems) {
              console.log('   Sub-items:');
              item.subItems.forEach(sub => {
                console.log(`   - ${sub.description || '(no description)'}: $${sub.amount || 0}`);
              });
            }
          });
        }
      } else {
        console.log('Invoice exists:', false);
        console.log('ERROR: Backend is not returning invoice preview!');
      }
      
      // Check registration data structure
      console.log('\n=== REGISTRATION DATA STRUCTURE ===');
      const attendees = targetMatch.registration?.registrationData?.attendees || [];
      console.log('Attendees array length:', attendees.length);
      if (attendees.length > 0) {
        console.log('First attendee:', JSON.stringify(attendees[0], null, 2));
      }
      
      const tickets = targetMatch.registration?.registrationData?.tickets || [];
      console.log('\nTickets array length:', tickets.length);
      if (tickets.length > 0) {
        console.log('First ticket:', JSON.stringify(tickets[0], null, 2));
      }
      
    } else {
      console.log('\nTarget match not found in first 5 results');
      
      // Show what we did find
      if (data.matches && data.matches.length > 0) {
        console.log('\nFound matches:');
        data.matches.forEach(m => {
          console.log(`- ${m.registration?.confirmationNumber || 'No confirmation'} / ${m.payment?.paymentId || 'No payment ID'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

// Run the debug
debugInvoiceAPIResponse();