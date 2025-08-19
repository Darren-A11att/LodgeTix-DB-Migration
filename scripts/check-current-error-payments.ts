import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function checkErrorPayments() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const collection = db.collection('error_payments');
    
    const errorPayments = await collection.find({}).toArray();
    console.log(`Found ${errorPayments.length} error payments\n`);
    
    for (let i = 0; i < errorPayments.length; i++) {
      const payment = errorPayments[i];
      console.log(`\n=== Payment ${i + 1} ===`);
      console.log('ID:', payment._id);
      console.log('Has originalData:', !!payment.originalData);
      
      if (payment.originalData) {
        console.log('customerId:', payment.originalData.customerId || 'Not present');
        console.log('order_id:', payment.originalData.order_id || 'Not present');
        console.log('orderId:', payment.originalData.orderId || 'Not present');
        console.log('Has order object:', !!payment.originalData.order);
        console.log('Has customer object:', !!payment.originalData.customer);
      }
      
      // Show first level keys
      console.log('Top-level keys:', Object.keys(payment));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkErrorPayments();