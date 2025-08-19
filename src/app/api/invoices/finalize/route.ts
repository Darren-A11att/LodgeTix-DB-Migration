import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectMongoDB } from '@/lib/mongodb';
import { TransactionService } from '@/services/transaction-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      invoiceId, 
      paymentId, 
      registrationId,
      emailSent,
      emailData 
    } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();

    // Fetch all required documents
    const invoiceDoc = await db.collection('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoiceDoc) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Fetch payment and registration documents
    let paymentDoc = null;
    let registrationDoc = null;

    if (paymentId) {
      paymentDoc = await db.collection('payments').findOne({ 
        _id: new ObjectId(paymentId) 
      });
    }

    if (registrationId) {
      registrationDoc = await db.collection('registrations').findOne({ 
        _id: new ObjectId(registrationId) 
      });
    }

    // Create transaction documents
    const transactionService = new TransactionService(db);
    const transactionIds = await transactionService.createTransactionsFromInvoice(
      invoiceDoc,
      paymentDoc,
      registrationDoc,
      invoiceId,
      emailSent ? emailData : undefined
    );

    // Update invoice to mark it as finalized
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

    // Log the finalization
    await db.collection('invoice_audit_log').insertOne({
      action: 'finalized',
      invoiceId,
      invoiceNumber: invoiceDoc.invoiceNumber,
      transactionCount: transactionIds.length,
      emailSent,
      finalizedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice finalized and transactions created',
      transactionCount: transactionIds.length,
      transactionIds
    });

  } catch (error) {
    console.error('Error finalizing invoice:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}