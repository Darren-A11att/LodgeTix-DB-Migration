import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';
import { TransactionService } from '@/services/transaction-service';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, registration, customerInvoice, supplierInvoice } = body;
    
    if (!payment || !registration) {
      return NextResponse.json(
        { error: 'Payment and registration are required' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    
    // Initialize services
    const invoiceSequence = new InvoiceSequence(db);
    const transactionService = new TransactionService(db);
    
    // Get payment date for invoice numbering
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    
    // Generate customer invoice number
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
    
    // Generate supplier invoice number (same number, different prefix)
    const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
    
    // Convert IDs to ObjectId if they're strings
    const paymentId = payment._id ? 
      (typeof payment._id === 'string' ? new ObjectId(payment._id) : payment._id) : 
      null;
    const registrationId = registration._id ? 
      (typeof registration._id === 'string' ? new ObjectId(registration._id) : registration._id) : 
      null;
    
    // Prepare invoice documents with generated invoice numbers
    const invoicesToInsert: any[] = [];
    let customerInvoiceId = null;
    
    if (customerInvoice) {
      // Clean the invoice data before storing
      const cleanedCustomerInvoice = cleanInvoiceData(customerInvoice);
      
      customerInvoiceId = new ObjectId();
      invoicesToInsert.push({
        _id: customerInvoiceId,
        ...cleanedCustomerInvoice,
        invoiceNumber: customerInvoiceNumber,
        paymentId: paymentId,
        registrationId: registrationId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    if (supplierInvoice) {
      // Clean the invoice data before storing
      const cleanedSupplierInvoice = cleanInvoiceData(supplierInvoice);
      
      invoicesToInsert.push({
        _id: new ObjectId(),
        ...cleanedSupplierInvoice,
        invoiceNumber: supplierInvoiceNumber,
        paymentId: paymentId,
        registrationId: registrationId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Start a session for atomic transaction
    const session = (db as any).client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Insert invoices if any
        if (invoicesToInsert.length > 0) {
          await db.collection('invoices').insertMany(invoicesToInsert, { session });
        }
        
        // Transaction creation happens outside the session for now
        // as TransactionService doesn't support sessions yet
        
        // Update payment as processed
        await db.collection('payments').updateOne(
          { _id: paymentId },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: customerInvoiceId,
              invoiceStatus: 'created',
              // Store the complete invoice objects with all mapped values
              customerInvoice: customerInvoice ? {
                ...customerInvoice,
                invoiceNumber: customerInvoiceNumber
              } : null,
              supplierInvoice: supplierInvoice ? {
                ...supplierInvoice,
                invoiceNumber: supplierInvoiceNumber
              } : null
            }
          },
          { session }
        );
        
        // Update registration as processed
        await db.collection('registrations').updateOne(
          { _id: registrationId },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: customerInvoiceId,
              invoiceStatus: 'created',
              // Store the complete invoice objects with all mapped values
              customerInvoice: customerInvoice ? {
                ...customerInvoice,
                invoiceNumber: customerInvoiceNumber
              } : null,
              supplierInvoice: supplierInvoice ? {
                ...supplierInvoice,
                invoiceNumber: supplierInvoiceNumber
              } : null
            }
          },
          { session }
        );
      });
      
    } finally {
      await session.endSession();
    }
    
    // Create transaction records in a separate transaction
    // This ensures the invoice exists before creating transactions
    if (customerInvoice && customerInvoiceId) {
      const transactionSession = (db as any).client.startSession();
      
      try {
        await transactionSession.withTransaction(async () => {
          // Create transaction records for each line item
          const transactionIds = await transactionService.createTransactionsFromInvoice(
            customerInvoice,
            payment,
            registration,
            customerInvoiceId.toString(),
            undefined, // emailData
            transactionSession // pass the session
          );
          
          console.log(`Created ${transactionIds.length} transaction records for invoice ${customerInvoiceNumber}`);
        });
      } finally {
        await transactionSession.endSession();
      }
    }
    
    return NextResponse.json({
      success: true,
      customerInvoiceNumber,
      supplierInvoiceNumber,
      invoiceId: customerInvoiceId?.toString(),
      message: 'Invoices created successfully'
    });
    
  } catch (error) {
    console.error('Error creating invoices:', error);
    return NextResponse.json(
      { error: 'Failed to create invoices' },
      { status: 500 }
    );
  }
}

// Helper function to clean invoice data
function cleanInvoiceData(invoice: any) {
  const cleaned = { ...invoice };
  
  // Remove any _id fields that might exist from preview
  delete cleaned._id;
  delete cleaned.paymentId;
  delete cleaned.registrationId;
  
  // Ensure date fields are proper Date objects
  if (cleaned.date && typeof cleaned.date === 'string') {
    cleaned.date = new Date(cleaned.date);
  }
  
  if (cleaned.payment?.paidDate && typeof cleaned.payment.paidDate === 'string') {
    cleaned.payment.paidDate = new Date(cleaned.payment.paidDate);
  }
  
  return cleaned;
}