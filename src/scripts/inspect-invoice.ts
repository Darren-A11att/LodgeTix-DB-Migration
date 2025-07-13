import { MongoClient, Db, ObjectId } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DATABASE!;

interface InvoiceDocument {
  _id: ObjectId;
  [key: string]: any;
}

async function inspectInvoice(invoiceId: string): Promise<void> {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db: Db = client.db(DB_NAME);
    
    // Fetch the invoice
    const invoice: InvoiceDocument | null = await db.collection<InvoiceDocument>('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoice) {
      console.error('❌ Invoice not found!');
      return;
    }
    
    console.log('\n📄 Invoice Details:');
    console.log(JSON.stringify(invoice, null, 2));
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run inspection
const invoiceId: string = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
console.log(`🔍 Inspecting invoice: ${invoiceId}\n`);
inspectInvoice(invoiceId);