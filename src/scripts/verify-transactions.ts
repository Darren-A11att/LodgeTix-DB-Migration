import { MongoClient, Db, Collection } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DATABASE!;

interface Transaction {
  _id: number;
  invoiceNumber: string;
  invoiceType?: string;
  item_description?: string;
  item_price?: number;
  item_quantity?: number;
  paymentId?: string;
  billTo_firstName?: string;
  billTo_lastName?: string;
  billTo_email?: string;
  invoice_total?: number;
}

async function verifyTransactions(): Promise<void> {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db: Db = client.db(DB_NAME);
    const transactionsCollection: Collection<Transaction> = db.collection<Transaction>('transactions');
    
    // Get all transactions
    const transactions: Transaction[] = await transactionsCollection.find({}).toArray();
    
    console.log(`\n📊 Total transactions in collection: ${transactions.length}`);
    
    if (transactions.length > 0) {
      console.log('\n📋 Transaction Details:');
      
      transactions.forEach(tx => {
        console.log(`\n   Transaction ID: ${tx._id}`);
        console.log(`   Invoice: ${tx.invoiceNumber} (${tx.invoiceType})`);
        console.log(`   Item: ${tx.item_description}`);
        console.log(`   Price: $${tx.item_price} x ${tx.item_quantity}`);
        console.log(`   Payment ID: ${tx.paymentId}`);
        console.log(`   Customer: ${tx.billTo_firstName} ${tx.billTo_lastName}`);
        console.log(`   Email: ${tx.billTo_email}`);
        console.log(`   Invoice Total: $${tx.invoice_total}`);
      });
      
      // Show summary by invoice type
      const customerTx = transactions.filter(tx => tx.invoiceType === 'customer');
      const supplierTx = transactions.filter(tx => tx.invoiceType === 'supplier');
      
      console.log('\n📈 Summary:');
      console.log(`   Customer invoice transactions: ${customerTx.length}`);
      console.log(`   Supplier invoice transactions: ${supplierTx.length}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run verification
console.log('🔍 Verifying transactions in MongoDB Atlas...\n');
verifyTransactions();