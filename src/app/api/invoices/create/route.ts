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
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    const transactionService = new TransactionService(db);
    
    // Use payment date for invoice number generation
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    
    // Generate customer invoice number
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
    
    // Generate supplier invoice number (same number, different prefix)
    const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
    
    // Prepare invoice documents with generated invoice numbers
    const invoicesToInsert = [];
    let customerInvoiceId = null;
    
    if (customerInvoice) {
      customerInvoiceId = new ObjectId();
      invoicesToInsert.push({
        _id: customerInvoiceId,
        ...customerInvoice,
        invoiceNumber: customerInvoiceNumber,
        paymentId: payment._id,
        registrationId: registration._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    if (supplierInvoice) {
      invoicesToInsert.push({
        _id: new ObjectId(),
        ...supplierInvoice,
        invoiceNumber: supplierInvoiceNumber,
        paymentId: payment._id,
        registrationId: registration._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Start a transaction to ensure all updates happen together
    const session = (db as any).client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Insert invoices
        if (invoicesToInsert.length > 0) {
          await db.collection('invoices').insertMany(invoicesToInsert, { session });
        }
        
        // Transaction creation happens outside the session for now
        // as TransactionService doesn't support sessions yet
        
        // Update payment as processed
        await db.collection('payments').updateOne(
          { _id: payment._id },
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
          { _id: registration._id },
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
      } catch (transactionError) {
        console.error('Error creating transactions:', transactionError);
        // Don't fail the invoice creation if transaction creation fails
      } finally {
        await transactionSession.endSession();
      }
    }
    
    // Return the generated invoice numbers
    return NextResponse.json({
      success: true,
      customerInvoiceNumber,
      supplierInvoiceNumber
    });
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}