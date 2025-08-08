// @ts-nocheck
async function testFinalizeInvoice(invoiceId) {
  console.log(`\n🔍 Testing transaction creation for invoice: ${invoiceId}\n`);
  
  try {
    // First, get the invoice details via API
    const invoiceResponse = await fetch(`http://localhost:3005/api/collections/invoices/documents/${invoiceId}`);
    
    if (!invoiceResponse.ok) {
      console.error('❌ Failed to fetch invoice:', invoiceResponse.status);
      return;
    }
    
    const invoice = await invoiceResponse.json();
    
    console.log(`✅ Found invoice: ${invoice.invoiceNumber}`);
    console.log(`   Type: ${invoice.invoiceType}`);
    console.log(`   Total: $${invoice.total}`);
    console.log(`   Items: ${invoice.items?.length || 0}`);
    console.log(`   Email sent: ${invoice.emailSent ? 'Yes' : 'No'}`);
    
    if (invoice.finalized) {
      console.log('\n⚠️  Invoice already finalized!');
      console.log(`   Finalized at: ${invoice.finalizedAt}`);
      console.log(`   Transaction IDs: ${invoice.transactionIds?.join(', ') || 'None'}`);
      return;
    }
    
    // Try to find linked payment and registration
    let paymentId = null;
    let registrationId = null;
    
    // Search for payment by invoice number
    if (invoice.invoiceNumber) {
      const paymentSearchResponse = await fetch(`http://localhost:3005/api/payments/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: { invoiceNumber: invoice.invoiceNumber }
        })
      });
      
      if (paymentSearchResponse.ok) {
        const paymentData = await paymentSearchResponse.json();
        if (paymentData.documents && paymentData.documents.length > 0) {
          const payment = paymentData.documents[0];
          paymentId = payment._id;
          console.log(`\n✅ Found linked payment: ${paymentId}`);
          
          // Check for matched registration
          if (payment.matchedRegistrationId) {
            registrationId = payment.matchedRegistrationId;
            console.log(`✅ Found linked registration: ${registrationId}`);
          }
        }
      }
    }
    
    // Show what will be created
    console.log('\n📋 Will create transactions for:');
    invoice.items?.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}: ${item.description || item.name}`);
      console.log(`     Quantity: ${item.quantity || 1}`);
      console.log(`     Price: $${item.price || 0}`);
    });
    
    // Call the finalize endpoint
    console.log('\n🚀 Calling finalize endpoint...');
    
    const finalizeResponse = await fetch('http://localhost:3005/api/invoices/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoiceId,
        paymentId: paymentId,
        registrationId: registrationId,
        emailSent: invoice.emailSent || false,
        emailData: invoice.emailSent ? {
          emailedTo: invoice.emailedTo,
          emailedDateTime: invoice.emailedDateTime,
          emailedImpotencyKey: invoice.emailedImpotencyKey
        } : undefined
      })
    });
    
    const result = await finalizeResponse.json();
    
    if (!finalizeResponse.ok) {
      console.error('❌ Failed to finalize invoice:', result.error);
      return;
    }
    
    if (result.success) {
      console.log('\n✅ Invoice finalized successfully!');
      console.log(`   Transactions created: ${result.transactionCount}`);
      console.log(`   Transaction IDs: ${result.transactionIds.join(', ')}`);
      
      // Fetch and display the created transactions
      console.log('\n📊 Verifying transactions...');
      
      for (const txId of result.transactionIds) {
        const txResponse = await fetch(`http://localhost:3005/api/collections/transactions/documents?search=${txId}`);
        if (txResponse.ok) {
          const txData = await txResponse.json();
          const tx = txData.documents?.[0];
          if (tx) {
            console.log(`\n   Transaction ${tx._id}:`);
            console.log(`     Invoice: ${tx.invoiceNumber} (${tx.invoiceType})`);
            console.log(`     Item: ${tx.item_description}`);
            console.log(`     Price: $${tx.item_price} x ${tx.item_quantity}`);
            console.log(`     Customer: ${tx.billTo_email}`);
            console.log(`     Payment: ${tx.paymentId || 'N/A'}`);
            console.log(`     Email sent: ${tx.invoice_emailedTo ? `Yes (to ${tx.invoice_emailedTo})` : 'No'}`);
          }
        }
      }
    } else {
      console.error('❌ Failed to finalize invoice:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
const invoiceId = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
testFinalizeInvoice(invoiceId);
