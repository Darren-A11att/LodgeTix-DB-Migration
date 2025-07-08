import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';
import { TransactionServiceAtomic } from '@/services/transaction-service-atomic';
import { ObjectId } from 'mongodb';

interface InvoiceCreationStatus {
  invoiceNumbersGenerated: boolean;
  invoicesInserted: boolean;
  transactionsCreated: boolean;
  paymentUpdated: boolean;
  registrationUpdated: boolean;
  transactionIds: number[];
  error?: string;
}

export async function POST(request: NextRequest) {
  console.log('=== ATOMIC INVOICE CREATION START ===');
  console.log('Timestamp:', new Date().toISOString());
  
  const status: InvoiceCreationStatus = {
    invoiceNumbersGenerated: false,
    invoicesInserted: false,
    transactionsCreated: false,
    paymentUpdated: false,
    registrationUpdated: false,
    transactionIds: []
  };

  try {
    const body = await request.json();
    const { payment, registration, customerInvoice, supplierInvoice } = body;
    
    console.log('Received request for:');
    console.log('- Payment ID:', payment?._id);
    console.log('- Registration ID:', registration?._id);
    console.log('- Customer Invoice Items:', customerInvoice?.items?.length || 0);
    console.log('- Supplier Invoice Items:', supplierInvoice?.items?.length || 0);
    
    if (!payment || !registration) {
      console.error('ERROR: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields', status },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    const transactionService = new TransactionServiceAtomic(db);
    
    // Use payment date for invoice number generation
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    console.log('Payment date for invoice number:', paymentDate.toISOString());
    
    // Variables to hold generated values
    let customerInvoiceNumber: string = '';
    let supplierInvoiceNumber: string = '';
    let invoiceId: ObjectId | null = null;
    let transactionIds: number[] = [];
    
    // Start a session for atomic transaction
    const session = (db as any).client.startSession();
    console.log('MongoDB session started');
    
    try {
      await session.withTransaction(async () => {
        console.log('=== TRANSACTION START ===');
        
        // Step 1: Generate invoice numbers
        console.log('Step 1: Generating invoice numbers...');
        customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
        supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
        console.log('- Customer Invoice Number:', customerInvoiceNumber);
        console.log('- Supplier Invoice Number:', supplierInvoiceNumber);
        status.invoiceNumbersGenerated = true;
        
        // Step 2: Create combined invoice document
        console.log('Step 2: Creating invoice document...');
        invoiceId = new ObjectId();
        
        const invoiceDoc = {
          _id: invoiceId,
          // Add top-level invoiceNumber to avoid any potential unique index issues
          // This will be the customer invoice number by convention
          invoiceNumber: customerInvoiceNumber,
          customerInvoice: customerInvoice ? {
            ...customerInvoice,
            invoiceNumber: customerInvoiceNumber,
            paymentId: payment._id,
            registrationId: registration._id,
          } : null,
          supplierInvoice: supplierInvoice ? {
            ...supplierInvoice,
            invoiceNumber: supplierInvoiceNumber,
            paymentId: payment._id,
            registrationId: registration._id,
          } : null,
          payment: {
            _id: payment._id,
            paymentId: payment.paymentId,
            transactionId: payment.transactionId,
            amount: payment.grossAmount || payment.amount,
            customerEmail: registration.registrationData?.bookingContact?.email || null,
            customerName: payment.customerName,
            timestamp: payment.timestamp
          },
          registration: {
            _id: registration._id,
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            functionName: registration.functionName || null,
            customerName: registration.primaryAttendee || registration.registrationData?.bookingContact?.firstName + ' ' + registration.registrationData?.bookingContact?.lastName
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          finalized: false,
          transactionIds: [] // Will be updated after transaction creation
        };
        
        await db.collection('invoices').insertOne(invoiceDoc, { session });
        console.log('- Invoice document created with ID:', invoiceId.toString());
        status.invoicesInserted = true;
        
        // Step 3: Create transaction records for customer invoice
        if (customerInvoice && customerInvoice.items && customerInvoice.items.length > 0) {
          console.log('Step 3: Creating transaction records...');
          console.log('- Processing', customerInvoice.items.length, 'customer invoice items');
          
          const customerTxIds = await transactionService.createTransactionsFromInvoice(
            { ...customerInvoice, invoiceNumber: customerInvoiceNumber },
            payment,
            registration,
            invoiceId.toString(),
            undefined,
            session
          );
          
          transactionIds = [...transactionIds, ...customerTxIds];
          console.log('- Created', customerTxIds.length, 'customer transactions:', customerTxIds);
        }
        
        // Step 4: Create transaction records for supplier invoice
        if (supplierInvoice && supplierInvoice.items && supplierInvoice.items.length > 0) {
          console.log('Step 4: Creating supplier transaction records...');
          console.log('- Processing', supplierInvoice.items.length, 'supplier invoice items');
          
          const supplierTxIds = await transactionService.createTransactionsFromInvoice(
            { ...supplierInvoice, invoiceNumber: supplierInvoiceNumber },
            payment,
            registration,
            invoiceId.toString(),
            undefined,
            session
          );
          
          transactionIds = [...transactionIds, ...supplierTxIds];
          console.log('- Created', supplierTxIds.length, 'supplier transactions:', supplierTxIds);
        }
        
        status.transactionsCreated = true;
        status.transactionIds = transactionIds;
        console.log('- Total transactions created:', transactionIds.length);
        
        // Step 5: Update invoice with transaction IDs
        if (transactionIds.length > 0) {
          console.log('Step 5: Updating invoice with transaction IDs...');
          await db.collection('invoices').updateOne(
            { _id: invoiceId },
            { 
              $set: { 
                transactionIds,
                updatedAt: new Date()
              } 
            },
            { session }
          );
          console.log('- Invoice updated with transaction IDs');
        }
        
        // Step 6: Update payment record
        console.log('Step 6: Updating payment record...');
        console.log('- Payment._id:', payment._id);
        console.log('- Type:', typeof payment._id);
        console.log('- Converting to ObjectId:', new ObjectId(payment._id));
        
        // First try to find the payment to debug
        const paymentCheck = await db.collection('payments').findOne(
          { _id: new ObjectId(payment._id) },
          { session }
        );
        console.log('- Payment found in transaction:', paymentCheck ? 'Yes' : 'No');
        
        const paymentUpdate = await db.collection('payments').updateOne(
          { _id: new ObjectId(payment._id) },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: invoiceId,
              invoiceStatus: 'created',
              updatedAt: new Date()
            }
          },
          { session }
        );
        console.log('- Payment update result:', {
          acknowledged: paymentUpdate.acknowledged,
          modifiedCount: paymentUpdate.modifiedCount,
          matchedCount: paymentUpdate.matchedCount,
          upsertedCount: paymentUpdate.upsertedCount
        });
        status.paymentUpdated = paymentUpdate.matchedCount > 0;
        
        // Step 7: Update registration record
        console.log('Step 7: Updating registration record...');
        const registrationUpdate = await db.collection('registrations').updateOne(
          { _id: new ObjectId(registration._id) },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: invoiceId,
              invoiceStatus: 'created',
              updatedAt: new Date()
            }
          },
          { session }
        );
        console.log('- Registration update result:', {
          acknowledged: registrationUpdate.acknowledged,
          modifiedCount: registrationUpdate.modifiedCount,
          matchedCount: registrationUpdate.matchedCount,
          upsertedCount: registrationUpdate.upsertedCount
        });
        status.registrationUpdated = registrationUpdate.matchedCount > 0;
        
        console.log('=== TRANSACTION COMPLETE ===');
      });
      
      // Transaction succeeded - all operations completed atomically
      console.log('=== ATOMIC INVOICE CREATION SUCCESS ===');
      console.log('Summary:');
      console.log('- Invoice ID:', invoiceId!.toString());
      console.log('- Customer Invoice:', customerInvoiceNumber);
      console.log('- Supplier Invoice:', supplierInvoiceNumber);
      console.log('- Transactions Created:', transactionIds.length);
      console.log('- Status:', status);
      
      return NextResponse.json({
        success: true,
        customerInvoiceNumber,
        supplierInvoiceNumber,
        invoiceId: invoiceId!.toString(),
        transactionCount: transactionIds.length,
        transactionIds,
        status
      });
      
    } catch (transactionError: any) {
      // Transaction failed - everything rolled back
      console.error('=== TRANSACTION FAILED - ROLLING BACK ===');
      console.error('Error:', transactionError);
      console.error('Stack:', transactionError.stack);
      status.error = transactionError.message;
      
      return NextResponse.json(
        { 
          error: 'Invoice creation failed - all changes rolled back',
          details: transactionError.message,
          status 
        },
        { status: 500 }
      );
    } finally {
      await session.endSession();
      console.log('MongoDB session ended');
    }
    
  } catch (error: any) {
    console.error('=== FATAL ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    status.error = error.message;
    
    return NextResponse.json(
      { 
        error: 'Failed to create invoice',
        details: error.message,
        status
      },
      { status: 500 }
    );
  }
}