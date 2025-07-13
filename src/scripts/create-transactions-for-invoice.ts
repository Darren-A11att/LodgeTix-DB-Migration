import { MongoClient, Db, ObjectId } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';
import { Invoice, InvoiceItem, InvoiceSupplier, InvoiceBillTo, InvoicePayment } from '../types/invoice';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DATABASE!;

interface CounterDocument {
  _id: string;
  sequence_value: number;
}

interface Payment {
  _id: ObjectId;
  paymentId?: string;
  transactionId?: string;
  customerId?: string;
  timestamp?: Date;
  createdAt?: Date;
  status?: string;
  paymentStatus?: string;
  method?: string;
  source?: string;
  amount?: number;
  grossAmount?: number;
  currency?: string;
  paymentSource?: string;
  last4?: string;
  cardLast4?: string;
  cardBrand?: string;
  brand?: string;
  matchedRegistrationId?: string;
  invoiceNumber?: string;
}

interface Registration {
  _id: ObjectId;
  functionId?: string;
  registrationId?: string;
  confirmationNumber?: string;
  customerId?: string;
  registrationDate?: Date;
  createdAt?: Date;
  registrationType?: string;
  registrationData?: {
    functionId?: string;
    registrationType?: string;
  };
}

interface ExtendedInvoice extends Invoice {
  customerInvoice?: Invoice;
  supplierInvoice?: Invoice;
  payment?: InvoicePayment;
  registration?: Registration;
  finalized?: boolean;
  finalizedAt?: Date;
  transactionIds?: number[];
  email?: {
    to?: string;
    sent?: Date;
    idempotencyKey?: string;
  };
  emailedTo?: string;
  emailedDateTime?: Date;
  emailedImpotencyKey?: string;
  dueDate?: Date;
}

interface Transaction {
  _id: number;
  functionId?: string;
  paymentId?: string;
  registrationId?: string;
  customerId?: string;
  registrationDate?: Date;
  registrationType?: string;
  paymentDate?: Date;
  paymentStatus?: string;
  invoiceNumber: string;
  invoiceDate?: Date;
  invoiceDueDate?: Date;
  invoiceType?: string;
  billTo_businessName?: string;
  billTo_businessNumber?: string;
  billTo_firstName?: string;
  billTo_lastName?: string;
  billTo_email?: string;
  billTo_phone?: string;
  billTo_addressLine1?: string;
  billTo_addressLine2?: string;
  billTo_city?: string;
  billTo_postalCode?: string;
  billTo_stateProvince?: string;
  supplier_name?: string;
  supplier_abn?: string;
  supplier_address?: string;
  supplier_issuedBy?: string;
  item_description?: string;
  item_quantity?: number;
  item_price?: number;
  invoice_subtotal?: number;
  invoice_processingFees?: number;
  invoice_total?: number;
  payment_method?: string;
  payment_transactionId?: string;
  payment_paidDate?: Date;
  payment_amount?: number;
  payment_currency?: string;
  payment_status?: string;
  payment_source?: string;
  payment_last4?: string;
  payment_cardBrand?: string;
  registration_objectId?: string;
  payment_objectId?: string;
  invoice_objectId: string;
  invoice_object_createdAt?: Date;
  invoice_object_updatedAt?: Date;
  invoice_emailedTo?: string;
  invoice_emailedDateTime?: Date;
  invoice_emailedImpotencyKey?: string;
  invoice_fileName?: string;
  invoice_url?: string;
}

// Import the transaction service logic
async function getNextTransactionId(db: Db): Promise<number> {
  const result = await db.collection<CounterDocument>('counters').findOneAndUpdate(
    { _id: 'transaction_sequence' },
    { $inc: { sequence_value: 1 } },
    { 
      upsert: true, 
      returnDocument: 'after',
      projection: { sequence_value: 1 }
    }
  );
  return result?.sequence_value || 1;
}

function extractNumericValue(value: any): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
  if (value.$numberDecimal) return parseFloat(value.$numberDecimal);
  return undefined;
}

async function createTransactionsForInvoiceType(
  db: Db, 
  invoice: ExtendedInvoice, 
  payment: Payment | null, 
  registration: Registration | null, 
  invoiceObjectId: string, 
  invoiceType: string
): Promise<number[]> {
  const transactionIds: number[] = [];
  
  for (const [index, item] of (invoice.items || []).entries()) {
    const transactionId = await getNextTransactionId(db);
    
    const transaction: Transaction = {
      _id: transactionId,
      
      // Function and IDs
      functionId: registration?.functionId || registration?.registrationData?.functionId,
      paymentId: payment?.paymentId || payment?.transactionId,
      registrationId: registration?.registrationId || registration?.confirmationNumber,
      customerId: registration?.customerId || payment?.customerId,
      
      // Registration fields
      registrationDate: registration?.registrationDate || registration?.createdAt,
      registrationType: registration?.registrationType || registration?.registrationData?.registrationType,
      
      // Payment fields
      paymentDate: payment?.timestamp || payment?.createdAt,
      paymentStatus: payment?.status || payment?.paymentStatus || 'paid',
      
      // Invoice fields
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date || invoice.createdAt,
      invoiceDueDate: invoice.dueDate,
      invoiceType: invoice.invoiceType || invoiceType,
      
      // Bill To fields (flattened)
      billTo_businessName: invoice.billTo?.businessName,
      billTo_businessNumber: invoice.billTo?.businessNumber,
      billTo_firstName: invoice.billTo?.firstName,
      billTo_lastName: invoice.billTo?.lastName,
      billTo_email: invoice.billTo?.email,
      billTo_phone: invoice.billTo?.phone,
      billTo_addressLine1: invoice.billTo?.addressLine1,
      billTo_addressLine2: invoice.billTo?.addressLine2,
      billTo_city: invoice.billTo?.city,
      billTo_postalCode: invoice.billTo?.postalCode,
      billTo_stateProvince: invoice.billTo?.stateProvince,
      
      // Supplier fields (flattened)
      supplier_name: invoice.supplier?.name,
      supplier_abn: invoice.supplier?.abn,
      supplier_address: invoice.supplier?.address,
      supplier_issuedBy: invoice.supplier?.issuedBy,
      
      // Item fields
      item_description: item.description || (item as any).name,
      item_quantity: item.quantity || 1,
      item_price: extractNumericValue(item.price),
      
      // Invoice totals
      invoice_subtotal: extractNumericValue(invoice.subtotal),
      invoice_processingFees: extractNumericValue(invoice.processingFees),
      invoice_total: extractNumericValue(invoice.total),
      
      // Payment details
      payment_method: invoice.payment?.method || payment?.method || payment?.source || 'unknown',
      payment_transactionId: invoice.payment?.transactionId || payment?.transactionId || payment?.paymentId,
      payment_paidDate: invoice.payment?.paidDate || payment?.timestamp || payment?.createdAt,
      payment_amount: extractNumericValue(invoice.payment?.amount || payment?.amount || payment?.grossAmount),
      payment_currency: invoice.payment?.currency || payment?.currency || 'AUD',
      payment_status: invoice.payment?.status || payment?.status || payment?.paymentStatus || 'paid',
      payment_source: invoice.payment?.source || payment?.source || payment?.paymentSource,
      payment_last4: invoice.payment?.last4 || payment?.last4 || payment?.cardLast4,
      payment_cardBrand: invoice.payment?.cardBrand || payment?.cardBrand || payment?.brand,
      
      // Object IDs
      registration_objectId: registration?._id?.toString(),
      payment_objectId: payment?._id?.toString(),
      invoice_objectId: invoiceObjectId,
      invoice_object_createdAt: invoice.createdAt || new Date(),
      invoice_object_updatedAt: invoice.updatedAt || new Date(),
      
      // Email tracking (from new email object or legacy fields)
      invoice_emailedTo: invoice.email?.to || invoice.emailedTo,
      invoice_emailedDateTime: invoice.email?.sent || invoice.emailedDateTime,
      invoice_emailedImpotencyKey: invoice.email?.idempotencyKey || invoice.emailedImpotencyKey,
      
      // File fields
      invoice_fileName: undefined,
      invoice_url: undefined
    };
    
    await db.collection<Transaction>('transactions').insertOne(transaction);
    transactionIds.push(transactionId);
    
    console.log(`   ✅ Created transaction ${transactionId} for item ${index + 1}: ${item.description || (item as any).name}`);
  }
  
  return transactionIds;
}

async function createTransactionsForInvoice(invoiceId: string): Promise<void> {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db: Db = client.db(DB_NAME);
    
    // Fetch the invoice
    const invoice = await db.collection<ExtendedInvoice>('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoice) {
      console.error('❌ Invoice not found!');
      return;
    }
    
    console.log(`\n✅ Found invoice: ${invoice.invoiceNumber}`);
    console.log(`   Type: ${invoice.invoiceType}`);
    console.log(`   Total: $${invoice.total}`);
    console.log(`   Items: ${invoice.items?.length || 0}`);
    console.log(`   Created: ${invoice.createdAt}`);
    
    // Check if already finalized
    if (invoice.finalized) {
      console.log('\n⚠️  Invoice already finalized!');
      console.log(`   Finalized at: ${invoice.finalizedAt}`);
      return;
    }
    
    // Try to find linked payment
    let payment: Payment | null = null;
    if (invoice.invoiceNumber) {
      payment = await db.collection<Payment>('payments').findOne({ 
        invoiceNumber: invoice.invoiceNumber 
      });
      
      if (payment) {
        console.log(`\n✅ Found linked payment: ${payment._id}`);
        console.log(`   Amount: $${payment.amount || payment.grossAmount}`);
      }
    }
    
    // Try to find linked registration
    let registration: Registration | null = null;
    if (payment?.matchedRegistrationId) {
      registration = await db.collection<Registration>('registrations').findOne({ 
        _id: new ObjectId(payment.matchedRegistrationId) 
      });
      
      if (registration) {
        console.log(`\n✅ Found linked registration: ${registration._id}`);
        console.log(`   Confirmation: ${registration.confirmationNumber}`);
      }
    }
    
    // Determine which invoice to process (customer or supplier)
    const invoiceToProcess: ExtendedInvoice = invoice;
    
    // Check if this is a nested structure with customerInvoice/supplierInvoice
    if (invoice.customerInvoice || invoice.supplierInvoice) {
      // We'll create transactions for both if they exist
      const allTransactionIds: number[] = [];
      
      if (invoice.customerInvoice && invoice.customerInvoice.items) {
        console.log('\n📝 Creating transactions for customer invoice...');
        const customerTxIds = await createTransactionsForInvoiceType(
          db, invoice.customerInvoice, payment || invoice.payment, 
          registration || invoice.registration, invoiceId, 'customer'
        );
        allTransactionIds.push(...customerTxIds);
      }
      
      if (invoice.supplierInvoice && invoice.supplierInvoice.items) {
        console.log('\n📝 Creating transactions for supplier invoice...');
        const supplierTxIds = await createTransactionsForInvoiceType(
          db, invoice.supplierInvoice, payment || invoice.payment, 
          registration || invoice.registration, invoiceId, 'supplier'
        );
        allTransactionIds.push(...supplierTxIds);
      }
      
      // Update invoice as finalized
      await db.collection('invoices').updateOne(
        { _id: new ObjectId(invoiceId) },
        { 
          $set: { 
            finalized: true,
            finalizedAt: new Date(),
            transactionIds: allTransactionIds
          }
        }
      );
      
      console.log(`\n✅ Successfully created ${allTransactionIds.length} transactions!`);
      console.log('   Transaction IDs:', allTransactionIds.join(', '));
      
      return;
    }
    
    // Original single invoice structure
    console.log('\n📝 Creating transactions...');
    const transactionIds: number[] = [];
    
    for (const [index, item] of (invoiceToProcess.items || []).entries()) {
      const transactionId = await getNextTransactionId(db);
      
      const transaction: Transaction = {
        _id: transactionId,
        
        // Function and IDs
        functionId: registration?.functionId || registration?.registrationData?.functionId,
        paymentId: payment?.paymentId || payment?.transactionId,
        registrationId: registration?.registrationId || registration?.confirmationNumber,
        customerId: registration?.customerId || payment?.customerId,
        
        // Registration fields
        registrationDate: registration?.registrationDate || registration?.createdAt,
        registrationType: registration?.registrationType || registration?.registrationData?.registrationType,
        
        // Payment fields
        paymentDate: payment?.timestamp || payment?.createdAt,
        paymentStatus: payment?.status || payment?.paymentStatus || 'paid',
        
        // Invoice fields
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.date || invoice.createdAt,
        invoiceDueDate: invoice.dueDate,
        invoiceType: invoice.invoiceType,
        
        // Bill To fields (flattened)
        billTo_businessName: invoice.billTo?.businessName,
        billTo_businessNumber: invoice.billTo?.businessNumber,
        billTo_firstName: invoice.billTo?.firstName,
        billTo_lastName: invoice.billTo?.lastName,
        billTo_email: invoice.billTo?.email,
        billTo_phone: invoice.billTo?.phone,
        billTo_addressLine1: invoice.billTo?.addressLine1,
        billTo_addressLine2: invoice.billTo?.addressLine2,
        billTo_city: invoice.billTo?.city,
        billTo_postalCode: invoice.billTo?.postalCode,
        billTo_stateProvince: invoice.billTo?.stateProvince,
        
        // Supplier fields (flattened)
        supplier_name: invoice.supplier?.name,
        supplier_abn: invoice.supplier?.abn,
        supplier_address: invoice.supplier?.address,
        supplier_issuedBy: invoice.supplier?.issuedBy,
        
        // Item fields
        item_description: item.description || (item as any).name,
        item_quantity: item.quantity || 1,
        item_price: extractNumericValue(item.price),
        
        // Invoice totals
        invoice_subtotal: extractNumericValue(invoice.subtotal),
        invoice_processingFees: extractNumericValue(invoice.processingFees),
        invoice_total: extractNumericValue(invoice.total),
        
        // Payment details
        payment_method: payment?.method || payment?.source || 'unknown',
        payment_transactionId: payment?.transactionId || payment?.paymentId,
        payment_paidDate: payment?.timestamp || payment?.createdAt,
        payment_amount: extractNumericValue(payment?.amount || payment?.grossAmount),
        payment_currency: payment?.currency || 'AUD',
        payment_status: payment?.status || payment?.paymentStatus || 'paid',
        payment_source: payment?.source || payment?.paymentSource,
        payment_last4: payment?.last4 || payment?.cardLast4,
        payment_cardBrand: payment?.cardBrand || payment?.brand,
        
        // Object IDs
        registration_objectId: registration?._id?.toString(),
        payment_objectId: payment?._id?.toString(),
        invoice_objectId: invoiceId,
        invoice_object_createdAt: invoice.createdAt || new Date(),
        invoice_object_updatedAt: invoice.updatedAt || new Date(),
        
        // Email tracking (from new email object or legacy fields)
        invoice_emailedTo: invoice.email?.to || invoice.emailedTo,
        invoice_emailedDateTime: invoice.email?.sent || invoice.emailedDateTime,
        invoice_emailedImpotencyKey: invoice.email?.idempotencyKey || invoice.emailedImpotencyKey,
        
        // File fields
        invoice_fileName: undefined,
        invoice_url: undefined
      };
      
      await db.collection<Transaction>('transactions').insertOne(transaction);
      transactionIds.push(transactionId);
      
      console.log(`   ✅ Created transaction ${transactionId} for item ${index + 1}: ${item.description || (item as any).name}`);
    }
    
    // Update invoice as finalized
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      { 
        $set: { 
          finalized: true,
          finalizedAt: new Date(),
          transactionIds: transactionIds
        }
      }
    );
    
    console.log(`\n✅ Successfully created ${transactionIds.length} transactions!`);
    console.log('   Transaction IDs:', transactionIds.join(', '));
    
    // Verify transactions were created
    const createdTransactions = await db.collection<Transaction>('transactions')
      .find({ _id: { $in: transactionIds } })
      .toArray();
    
    console.log('\n📊 Created transactions summary:');
    createdTransactions.forEach((tx, idx) => {
      console.log(`\n   Transaction ${tx._id}:`);
      console.log(`     Item: ${tx.item_description}`);
      console.log(`     Price: $${tx.item_price} x ${tx.item_quantity}`);
      console.log(`     Customer: ${tx.billTo_firstName} ${tx.billTo_lastName} (${tx.billTo_email})`);
    });
    
  } catch (error) {
    console.error('❌ Error creating transactions:', error);
    console.error('\nMake sure to:');
    console.error('1. Check that .env.local file exists with MongoDB connection details');
    console.error('2. Run the setup script first to create the collection and indexes');
    console.error(`3. Using database: ${DB_NAME}`);
  } finally {
    await client.close();
  }
}

// Run for the specific invoice
const invoiceId: string = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
console.log(`🚀 Creating transactions for invoice: ${invoiceId}\n`);
createTransactionsForInvoice(invoiceId);