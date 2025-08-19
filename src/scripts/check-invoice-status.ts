import * as dotenv from 'dotenv';
import { MongoClient, Db, Collection } from 'mongodb';

dotenv.config({ path: '.env.local' });

interface InvoiceDocument {
  _id?: any;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  customerInvoice?: any;
  supplierInvoice?: any;
  createdAt?: Date;
  registrationId?: any;
  [key: string]: any;
}

async function checkInvoiceStatus(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db: Db = client.db(dbName);
    
    console.log('Connected to MongoDB\n');
    
    // Check recently created invoices
    const invoicesCollection: Collection<InvoiceDocument> = db.collection('invoices');
    const recentInvoices = await invoicesCollection
      .find({})
      .sort({ _id: -1 })
      .limit(10)
      .toArray();
    
    console.log('Recent invoices (showing last 10):');
    recentInvoices.forEach((invoice, index) => {
      const isCustomer = !!invoice.customerInvoice;
      const isSupplier = !!invoice.supplierInvoice;
      
      console.log(`\n${index + 1}. Invoice: ${invoice.invoiceNumber || 'No number'}`);
      console.log(`   Status: ${invoice.status || 'Unknown'}`);
      console.log(`   Total: $${invoice.total || 'Unknown'}`);
      console.log(`   Type: ${isCustomer ? 'Customer' : isSupplier ? 'Supplier' : 'Unknown'}`);
      console.log(`   Created: ${invoice.createdAt || 'Unknown'}`);
      console.log(`   Registration: ${invoice.registrationId || 'None'}`);
    });
    
    // Summary statistics
    const totalInvoices = await invoicesCollection.countDocuments();
    const paidInvoices = await invoicesCollection.countDocuments({ status: 'paid' });
    const pendingInvoices = await invoicesCollection.countDocuments({ status: 'pending' });
    const overdueInvoices = await invoicesCollection.countDocuments({ status: 'overdue' });
    
    console.log('\n=== Invoice Summary ===');
    console.log(`Total invoices: ${totalInvoices}`);
    console.log(`Paid: ${paidInvoices}`);
    console.log(`Pending: ${pendingInvoices}`);
    console.log(`Overdue: ${overdueInvoices}`);
    
  } catch (error: any) {
    console.error('Error checking invoice status:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  checkInvoiceStatus().catch(console.error);
}

export { checkInvoiceStatus };
