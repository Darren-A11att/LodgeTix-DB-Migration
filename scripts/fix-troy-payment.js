require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixTroyPayment() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== FIXING TROY QUIMPO PAYMENT ===\n');
    
    // Fix the specific Troy Quimpo payment
    const paymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    
    const result = await db.collection('payments').updateOne(
      { paymentId: paymentId },
      { 
        $set: {
          customerName: 'Troy Quimpo',
          customerEmail: 'troyquimpo@yahoo.com',
          amount: 2351.74,  // Fix the amount from 235174 to 2351.74
          grossAmount: 2351.74,
          customerDataSource: 'Manual identification - Troy Quimpo payment for Lodge Jose Rizal No. 1045',
          customerDataUpdatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully updated Troy Quimpo payment');
    } else {
      console.log('❌ Payment not found or already updated');
    }
    
    // Verify the update
    const payment = await db.collection('payments').findOne({ paymentId: paymentId });
    if (payment) {
      console.log('\nPayment details after update:');
      console.log('  Customer Name:', payment.customerName);
      console.log('  Customer Email:', payment.customerEmail);
      console.log('  Amount:', payment.amount);
      console.log('  Payment ID:', payment.paymentId);
    }
    
    // Fix other payments with amount issues
    console.log('\n=== FIXING OTHER PAYMENT AMOUNTS ===\n');
    
    // Find payments with amounts that look like they're missing decimal points
    const paymentsWithLargeAmounts = await db.collection('payments').find({
      amount: { $gte: 10000 }
    }).toArray();
    
    console.log(`Found ${paymentsWithLargeAmounts.length} payments with amounts >= 10000`);
    
    let fixedCount = 0;
    for (const payment of paymentsWithLargeAmounts) {
      // Check if this looks like a cents value that needs conversion
      const potentialDollarAmount = payment.amount / 100;
      
      // Only fix if the result looks reasonable (between $1 and $10000)
      if (potentialDollarAmount >= 1 && potentialDollarAmount <= 10000) {
        await db.collection('payments').updateOne(
          { _id: payment._id },
          { 
            $set: {
              amount: potentialDollarAmount,
              grossAmount: potentialDollarAmount,
              amountFixedAt: new Date(),
              amountFixReason: 'Converted from cents to dollars'
            }
          }
        );
        fixedCount++;
        console.log(`  Fixed payment ${payment.paymentId}: ${payment.amount} -> ${potentialDollarAmount}`);
      }
    }
    
    console.log(`\nFixed ${fixedCount} payment amounts`);
    
    // Final check - search for Troy Quimpo again
    console.log('\n=== FINAL VERIFICATION ===\n');
    const troyPayments = await db.collection('payments').find({
      $or: [
        { customerName: { $regex: /quimpo/i } },
        { customerEmail: { $regex: /quimpo/i } }
      ]
    }).toArray();
    
    console.log(`Found ${troyPayments.length} Troy Quimpo payment(s)`);
    if (troyPayments.length > 0) {
      troyPayments.forEach(p => {
        console.log(`\nPayment: ${p.paymentId}`);
        console.log(`  Customer: ${p.customerName} (${p.customerEmail})`);
        console.log(`  Amount: $${p.amount}`);
        console.log(`  Date: ${p.timestamp || p.createdAt}`);
      });
    }
    
  } finally {
    await client.close();
  }
}

fixTroyPayment().catch(console.error);