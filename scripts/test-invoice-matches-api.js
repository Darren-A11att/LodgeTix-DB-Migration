const http = require('http');

async function testInvoiceMatchesAPI() {
  try {
    console.log('=== TESTING INVOICE MATCHES API ===\n');
    
    // Call the API endpoint
    const data = await new Promise((resolve, reject) => {
      http.get('http://localhost:3006/api/invoices/matches?limit=1', (res) => {
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
    
    if (!data.matches || data.matches.length === 0) {
      console.log('No matches found');
      return;
    }
    
    const match = data.matches[0];
    console.log('=== FIRST MATCH ===\n');
    
    // Check payment data
    console.log('Payment ID:', match.payment?.paymentId || match.payment?._id);
    console.log('Payment Amount:', match.payment?.amount);
    
    // Check registration data
    console.log('\n--- Registration Data ---');
    console.log('Confirmation Number:', match.registration?.confirmationNumber);
    console.log('Registration Type:', match.registration?.registrationType);
    
    // Check attendees in registration
    const attendees = match.registration?.registrationData?.attendees || [];
    console.log('\nAttendees in registration:', attendees.length);
    if (attendees.length > 0) {
      console.log('First attendee:', JSON.stringify(attendees[0], null, 2));
    }
    
    // Check tickets in registration
    const tickets = match.registration?.registrationData?.tickets || [];
    console.log('\nTickets in registration:', tickets.length);
    if (tickets.length > 0) {
      console.log('First ticket:', JSON.stringify(tickets[0], null, 2));
    }
    
    // Check the generated invoice
    console.log('\n--- Generated Invoice ---');
    console.log('Invoice Number:', match.invoice?.invoiceNumber);
    console.log('Invoice Total:', match.invoice?.total);
    
    // Check invoice line items
    const items = match.invoice?.items || [];
    console.log('\nInvoice Line Items:', items.length);
    
    items.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log('  Description:', item.description);
      console.log('  Amount:', item.amount);
      console.log('  Type:', item.type);
      
      if (item.subItems && item.subItems.length > 0) {
        console.log('  Sub-items:');
        item.subItems.forEach(subItem => {
          console.log(`    - ${subItem.description}: $${subItem.amount}`);
        });
      }
    });
    
    // Check if invoice has proper attendee names
    console.log('\n--- Invoice Quality Check ---');
    const hasProperAttendeeNames = items.some(item => 
      item.type === 'attendee' && 
      item.description && 
      item.description !== 'Unknown Attendee' &&
      item.description.trim().length > 0
    );
    console.log('Has proper attendee names:', hasProperAttendeeNames);
    
    const hasTicketDetails = items.some(item => 
      item.subItems && 
      item.subItems.length > 0 &&
      item.subItems.some(sub => sub.description && sub.description !== 'Event Ticket')
    );
    console.log('Has ticket details:', hasTicketDetails);
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testInvoiceMatchesAPI();