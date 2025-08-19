import { connectMongoDB } from '@/lib/mongodb';
import { TransactionService } from '@/services/transaction-service';

async function createMissingTransactions() {
  const { db } = await connectMongoDB();
  const transactionService = new TransactionService(db);
  
  // Find the invoice
  const invoice = await db.collection('invoices').findOne({
    invoiceNumber: 'LTIV-250625048'
  });
  
  if (!invoice) {
    console.log('Invoice not found');
    return;
  }
  
  console.log('Found invoice:', invoice.invoiceNumber);
  
  // Get payment and registration
  const payment = await db.collection('payments').findOne({ _id: invoice.paymentId });
  const registration = await db.collection('registrations').findOne({ _id: invoice.registrationId });
  
  if (!payment || !registration) {
    console.log('Payment or registration not found');
    return;
  }
  
  // Create transactions
  try {
    const transactionIds = await transactionService.createTransactionsFromInvoice(
      invoice,
      payment,
      registration,
      invoice._id.toString()
    );
    
    console.log(`Created ${transactionIds.length} transactions:`, transactionIds);
  } catch (error) {
    console.error('Error creating transactions:', error);
  } finally {
    process.exit(0);
  }
}

createMissingTransactions().catch(console.error);