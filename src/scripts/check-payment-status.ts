import { MongoClient, Db, ObjectId } from 'mongodb';

interface Payment {
  _id: ObjectId;
  customerEmail?: string;
  email?: string;
  customer?: {
    email?: string;
  };
  transactionId?: string;
  paymentId?: string;
  amount?: number;
  grossAmount?: number;
  timestamp?: Date;
  createdAt?: Date;
  invoiceCreated?: boolean;
  invoiceDeclined?: boolean;
  invoiceNumber?: string;
  invoiceId?: ObjectId;
}

interface Invoice {
  _id: ObjectId;
  invoiceNumber: string;
  paymentId?: string;
  createdAt?: Date;
  billTo: {
    email: string;
  };
}

async function checkPaymentStatus(email: string): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db: Db = client.db('LodgeTix-migration-test-1');
    
    // Find payments with the given email
    const payments: Payment[] = await db.collection<Payment>('payments').find({
      $or: [
        { customerEmail: email },
        { email: email },
        { 'customer.email': email }
      ]
    }).toArray();
    
    console.log(`Found ${payments.length} payments for email: ${email}\n`);
    
    for (const payment of payments) {
      console.log('Payment ID:', payment._id);
      console.log('Transaction ID:', payment.transactionId || payment.paymentId);
      console.log('Amount:', payment.amount || payment.grossAmount);
      console.log('Date:', payment.timestamp || payment.createdAt);
      console.log('Invoice Created:', payment.invoiceCreated || false);
      console.log('Invoice Declined:', payment.invoiceDeclined || false);
      console.log('Invoice Number:', payment.invoiceNumber || 'N/A');
      console.log('Invoice ID:', payment.invoiceId || 'N/A');
      
      // Check if invoice actually exists
      if (payment.invoiceId) {
        const invoice = await db.collection<Invoice>('invoices').findOne({ _id: payment.invoiceId });
        console.log('Invoice exists in DB:', !!invoice);
      }
      
      console.log('---');
    }
    
    // Also check for any invoices with this email
    const invoices: Invoice[] = await db.collection<Invoice>('invoices').find({
      'billTo.email': email
    }).toArray();
    
    console.log(`\nFound ${invoices.length} invoices for email: ${email}`);
    for (const invoice of invoices) {
      console.log('Invoice Number:', invoice.invoiceNumber);
      console.log('Payment ID:', invoice.paymentId);
      console.log('Created:', invoice.createdAt);
    }
    
  } finally {
    await client.close();
  }
}

// Run with: tsx check-payment-status.ts alex@taylornichols.com.au
const email: string | undefined = process.argv[2];
if (!email) {
  console.log('Usage: tsx check-payment-status.ts <email>');
  process.exit(1);
}

checkPaymentStatus(email).catch(console.error);