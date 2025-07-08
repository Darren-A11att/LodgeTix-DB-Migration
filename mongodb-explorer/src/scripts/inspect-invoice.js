const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE;

async function inspectInvoice(invoiceId) {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db(DB_NAME);
    
    // Fetch the invoice
    const invoice = await db.collection('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoice) {
      console.error('❌ Invoice not found!');
      return;
    }
    
    console.log('\n📄 Invoice Details:');
    console.log(JSON.stringify(invoice, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run inspection
const invoiceId = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
console.log(`🔍 Inspecting invoice: ${invoiceId}\n`);
inspectInvoice(invoiceId);