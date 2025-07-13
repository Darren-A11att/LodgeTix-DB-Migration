import { MongoClient, Db, ObjectId } from 'mongodb';

// You'll need to update this with your actual connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://username:password@lodgetix-migration-test-1.mongodb.net/';
const dbName = process.env.MONGODB_DB || 'lodgetix';

interface InvoiceItem {
  description?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

interface Invoice {
  _id: ObjectId;
  invoiceNumber: string;
  invoiceType?: string;
  total: number;
  items?: InvoiceItem[];
  emailSent?: boolean;
  finalized?: boolean;
  finalizedAt?: Date;
  transactionIds?: number[];
  emailedTo?: string;
  emailedDateTime?: Date;
  emailedImpotencyKey?: string;
}

interface Payment {
  _id: ObjectId;
  transactionId?: string;
  paymentId?: string;
  amount?: number;
  grossAmount?: number;
  invoiceNumber?: string;
  matchedRegistrationId?: string;
}

interface Registration {
  _id: ObjectId;
  confirmationNumber?: string;
  functionId?: string;
  registrationData?: {
    functionId?: string;
  };
}

interface Transaction {
  _id: number;
  invoiceNumber: string;
  invoiceType?: string;
  item_description?: string;
  item_quantity?: number;
  item_price?: number;
  billTo_firstName?: string;
  billTo_lastName?: string;
  billTo_email?: string;
  paymentId?: string;
  registrationId?: string;
  invoice_emailedTo?: string;
  invoice_objectId: string;
}

interface FinalizeRequest {
  invoiceId: string;
  paymentId?: string;
  registrationId?: string;
  emailSent: boolean;
  emailData?: {
    emailedTo?: string;
    emailedDateTime?: Date;
    emailedImpotencyKey?: string;
  };
}

interface FinalizeResponse {
  success: boolean;
  error?: string;
  transactionCount?: number;
  transactionIds?: number[];
}

async function testTransactionCreation(invoiceId: string): Promise<void> {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db: Db = client.db(dbName);
    
    console.log(`\n🔍 Testing transaction creation for invoice: ${invoiceId}\n`);
    
    // Fetch the invoice
    const invoice: Invoice | null = await db.collection<Invoice>('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoice) {
      console.error('❌ Invoice not found!');
      return;
    }
    
    console.log(`✅ Found invoice: ${invoice.invoiceNumber}`);
    console.log(`   Type: ${invoice.invoiceType}`);
    console.log(`   Total: $${invoice.total}`);
    console.log(`   Items: ${invoice.items?.length || 0}`);
    console.log(`   Email sent: ${invoice.emailSent ? 'Yes' : 'No'}`);
    
    // Check if already finalized
    if (invoice.finalized) {
      console.log('\n⚠️  Invoice already finalized!');
      console.log(`   Finalized at: ${invoice.finalizedAt}`);
      console.log(`   Transaction IDs: ${invoice.transactionIds?.join(', ') || 'None'}`);
      
      // Check existing transactions
      const existingTransactions: Transaction[] = await db.collection<Transaction>('transactions')
        .find({ invoice_objectId: invoiceId })
        .toArray();
      
      console.log(`\n📊 Existing transactions: ${existingTransactions.length}`);
      existingTransactions.forEach((tx, idx) => {
        console.log(`   Transaction ${idx + 1}:`);
        console.log(`     ID: ${tx._id}`);
        console.log(`     Item: ${tx.item_description}`);
        console.log(`     Price: $${tx.item_price}`);
      });
      
      return;
    }
    
    // Get payment and registration if linked
    let payment: Payment | null = null;
    let registration: Registration | null = null;
    
    // Try to find payment by invoice number
    if (invoice.invoiceNumber) {
      payment = await db.collection<Payment>('payments').findOne({ 
        invoiceNumber: invoice.invoiceNumber 
      });
    }
    
    if (payment) {
      console.log(`\n✅ Found linked payment: ${payment._id}`);
      console.log(`   Transaction ID: ${payment.transactionId || payment.paymentId}`);
      console.log(`   Amount: $${payment.amount || payment.grossAmount}`);
      
      // Try to find registration
      if (payment.matchedRegistrationId) {
        registration = await db.collection<Registration>('registrations').findOne({ 
          _id: new ObjectId(payment.matchedRegistrationId) 
        });
      }
    }
    
    if (registration) {
      console.log(`\n✅ Found linked registration: ${registration._id}`);
      console.log(`   Confirmation: ${registration.confirmationNumber}`);
      console.log(`   Function ID: ${registration.functionId || registration.registrationData?.functionId}`);
    }
    
    // Call the finalize endpoint
    console.log('\n🚀 Calling finalize endpoint...');
    
    const finalizeRequest: FinalizeRequest = {
      invoiceId: invoiceId,
      paymentId: payment?._id?.toString(),
      registrationId: registration?._id?.toString(),
      emailSent: invoice.emailSent || false,
      emailData: invoice.emailSent ? {
        emailedTo: invoice.emailedTo,
        emailedDateTime: invoice.emailedDateTime,
        emailedImpotencyKey: invoice.emailedImpotencyKey
      } : undefined
    };
    
    const response = await fetch('http://localhost:3005/api/invoices/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalizeRequest)
    });
    
    const result: FinalizeResponse = await response.json();
    
    if (result.success) {
      console.log('\n✅ Invoice finalized successfully!');
      console.log(`   Transactions created: ${result.transactionCount}`);
      console.log(`   Transaction IDs: ${result.transactionIds?.join(', ')}`);
      
      // Verify transactions were created
      if (result.transactionIds) {
        const transactions: Transaction[] = await db.collection<Transaction>('transactions')
          .find({ _id: { $in: result.transactionIds } })
          .toArray();
        
        console.log('\n📋 Created transactions:');
        transactions.forEach((tx, idx) => {
          console.log(`\n   Transaction ${idx + 1} (ID: ${tx._id}):`);
          console.log(`     Invoice: ${tx.invoiceNumber}`);
          console.log(`     Type: ${tx.invoiceType}`);
          console.log(`     Item: ${tx.item_description}`);
          console.log(`     Quantity: ${tx.item_quantity}`);
          console.log(`     Price: $${tx.item_price}`);
          console.log(`     Customer: ${tx.billTo_firstName} ${tx.billTo_lastName}`);
          console.log(`     Email: ${tx.billTo_email}`);
          console.log(`     Payment ID: ${tx.paymentId}`);
          console.log(`     Registration ID: ${tx.registrationId}`);
          console.log(`     Email sent to: ${tx.invoice_emailedTo || 'Not sent'}`);
        });
      }
    } else {
      console.error('\n❌ Failed to finalize invoice:', result.error);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run the test
const invoiceId: string = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
testTransactionCreation(invoiceId);