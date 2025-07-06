import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';

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
    
    // Use payment date for invoice number generation
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    
    // Generate customer invoice number
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
    
    // Generate supplier invoice number (same number, different prefix)
    const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
    
    // Prepare invoice documents with generated invoice numbers
    const invoicesToInsert = [];
    
    if (customerInvoice) {
      invoicesToInsert.push({
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
        
        // Update payment as processed
        await db.collection('payments').updateOne(
          { _id: payment._id },
          { 
            $set: { 
              processed: true,
              processedAt: new Date(),
              invoiceNumbers: {
                customer: customerInvoiceNumber,
                supplier: supplierInvoiceNumber
              }
            }
          },
          { session }
        );
        
        // Update registration as processed
        await db.collection('registrations').updateOne(
          { _id: registration._id },
          { 
            $set: { 
              processed: true,
              processedAt: new Date(),
              invoiceNumbers: {
                customer: customerInvoiceNumber,
                supplier: supplierInvoiceNumber
              }
            }
          },
          { session }
        );
      });
      
      // Return the generated invoice numbers
      return NextResponse.json({
        success: true,
        customerInvoiceNumber,
        supplierInvoiceNumber
      });
      
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}