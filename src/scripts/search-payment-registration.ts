import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

interface Payment {
  _id: ObjectId;
  transactionId?: string;
  paymentId?: string;
  stripePaymentIntentId?: string;
  transactionDetails?: {
    transactionId?: string;
    amount?: number;
    timestamp?: Date;
  };
  amount?: number;
  grossAmount?: number;
  currency?: string;
  customerEmail?: string;
  email?: string;
  customer?: {
    email?: string;
  };
  timestamp?: Date;
  createdAt?: Date;
  status?: string;
  invoiceCreated?: boolean;
  invoiceNumber?: string;
  invoiceId?: ObjectId;
  registrationId?: string;
}

interface Registration {
  _id: ObjectId;
  confirmationNumber?: string;
  confirmationCode?: string;
  registrationDetails?: {
    confirmationNumber?: string;
  };
  contactId?: ObjectId;
  eventId?: ObjectId;
  functionId?: ObjectId;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  totalAmount?: number;
  total?: number;
  paymentStatus?: string;
}

interface Contact {
  _id: ObjectId;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface Function {
  _id: ObjectId;
  name?: string;
  date?: Date;
  startDate?: Date;
}

interface Invoice {
  _id: ObjectId;
  status?: string;
  total?: number;
}

async function searchPaymentAndRegistration(transactionId: string, confirmationNumber: string): Promise<void> {
  // Load environment variables
  dotenv.config({ path: '.env.local' });
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log(`Connected to MongoDB database: ${dbName}`);
    const db: Db = client.db(dbName);
    
    console.log('=== SEARCHING FOR PAYMENT ===');
    console.log(`Transaction ID: ${transactionId}\n`);
    
    // Search for payment with the transaction ID
    const payment: Payment | null = await db.collection<Payment>('payments').findOne({
      $or: [
        { transactionId: transactionId },
        { paymentId: transactionId },
        { stripePaymentIntentId: transactionId },
        { 'transactionDetails.transactionId': transactionId }
      ]
    });
    
    if (payment) {
      console.log('✓ Payment found!');
      console.log('Payment details:');
      console.log('- MongoDB ID:', payment._id);
      console.log('- Transaction ID:', payment.transactionId || payment.paymentId);
      console.log('- Amount:', payment.amount || payment.grossAmount || payment.transactionDetails?.amount);
      console.log('- Currency:', payment.currency || 'AUD');
      console.log('- Customer Email:', payment.customerEmail || payment.email || payment.customer?.email);
      console.log('- Date:', payment.timestamp || payment.createdAt || payment.transactionDetails?.timestamp);
      console.log('- Status:', payment.status || 'Unknown');
      console.log('- Invoice Created:', payment.invoiceCreated || false);
      console.log('- Invoice Number:', payment.invoiceNumber || 'N/A');
      console.log('- Invoice ID:', payment.invoiceId || 'N/A');
      console.log('- Registration ID:', payment.registrationId || 'N/A');
      
      // Check if invoice exists
      if (payment.invoiceId) {
        const invoice: Invoice | null = await db.collection<Invoice>('invoices').findOne({ _id: payment.invoiceId });
        console.log('- Invoice exists in DB:', !!invoice);
        if (invoice) {
          console.log('  - Invoice Status:', invoice.status);
          console.log('  - Invoice Total:', invoice.total);
        }
      }
    } else {
      console.log('✗ Payment not found with transaction ID:', transactionId);
      
      // Try broader search
      const similarPayments: Payment[] = await db.collection<Payment>('payments').find({
        $or: [
          { transactionId: { $regex: transactionId.substring(0, 10), $options: 'i' } },
          { paymentId: { $regex: transactionId.substring(0, 10), $options: 'i' } }
        ]
      }).limit(5).toArray();
      
      if (similarPayments.length > 0) {
        console.log('\nSimilar payments found:');
        similarPayments.forEach(p => {
          console.log(`- ${p.transactionId || p.paymentId} (${p.customerEmail || p.email})`);
        });
      }
    }
    
    console.log('\n=== SEARCHING FOR REGISTRATION ===');
    console.log(`Confirmation Number: ${confirmationNumber}\n`);
    
    // Search for registration with the confirmation number
    const registration: Registration | null = await db.collection<Registration>('registrations').findOne({
      $or: [
        { confirmationNumber: confirmationNumber },
        { confirmationCode: confirmationNumber },
        { 'registrationDetails.confirmationNumber': confirmationNumber }
      ]
    });
    
    if (registration) {
      console.log('✓ Registration found!');
      console.log('Registration details:');
      console.log('- MongoDB ID:', registration._id);
      console.log('- Confirmation Number:', registration.confirmationNumber || registration.confirmationCode);
      console.log('- Contact ID:', registration.contactId);
      console.log('- Event ID:', registration.eventId);
      console.log('- Function ID:', registration.functionId);
      console.log('- Status:', registration.status || 'Unknown');
      console.log('- Created:', registration.createdAt);
      console.log('- Updated:', registration.updatedAt);
      console.log('- Total Amount:', registration.totalAmount || registration.total);
      console.log('- Payment Status:', registration.paymentStatus || 'Unknown');
      
      // Check for associated contact
      if (registration.contactId) {
        const contact: Contact | null = await db.collection<Contact>('contacts').findOne({ _id: registration.contactId });
        if (contact) {
          console.log('\nAssociated Contact:');
          console.log('- Name:', `${contact.firstName} ${contact.lastName}`);
          console.log('- Email:', contact.email);
        }
      }
      
      // Check for associated function
      if (registration.functionId) {
        const func: Function | null = await db.collection<Function>('functions').findOne({ _id: registration.functionId });
        if (func) {
          console.log('\nAssociated Function:');
          console.log('- Name:', func.name);
          console.log('- Date:', func.date || func.startDate);
        }
      }
    } else {
      console.log('✗ Registration not found with confirmation number:', confirmationNumber);
      
      // Try broader search
      const similarRegistrations: Registration[] = await db.collection<Registration>('registrations').find({
        confirmationNumber: { $regex: confirmationNumber.substring(0, 8), $options: 'i' }
      }).limit(5).toArray();
      
      if (similarRegistrations.length > 0) {
        console.log('\nSimilar registrations found:');
        similarRegistrations.forEach(r => {
          console.log(`- ${r.confirmationNumber} (Contact ID: ${r.contactId})`);
        });
      }
    }
    
    // Check if payment and registration are linked
    if (payment && registration) {
      console.log('\n=== RELATIONSHIP CHECK ===');
      if (payment.registrationId === registration._id.toString()) {
        console.log('✓ Payment and Registration are properly linked!');
      } else {
        console.log('✗ Payment and Registration are NOT linked');
        console.log('- Payment registrationId:', payment.registrationId || 'None');
        console.log('- Registration ID:', registration._id);
      }
    }
    
  } catch (error: any) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Get command line arguments
const transactionId: string | undefined = process.argv[2];
const confirmationNumber: string | undefined = process.argv[3];

if (!transactionId || !confirmationNumber) {
  console.log('Usage: tsx search-payment-registration.ts <transactionId> <confirmationNumber>');
  console.log('Example: tsx search-payment-registration.ts nWPv0XIDWiytzqKiC8Z12mPR6pMZY IND-997699KO');
  process.exit(1);
}

searchPaymentAndRegistration(transactionId, confirmationNumber).catch(console.error);