import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoicePreview, paymentId, registrationId } = body;

    if (!invoicePreview || !paymentId || !registrationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();

    // Generate final invoice number
    const invoiceSequence = new InvoiceSequence(db);
    const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();

    // Create final invoice
    const finalInvoice = {
      ...invoicePreview,
      invoiceNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Remove preview-specific fields
    delete finalInvoice.matchDetails;
    delete finalInvoice.paymentDetails;
    delete finalInvoice.registrationDetails;

    // Insert invoice
    const invoicesCollection = db.collection('invoices');
    const insertResult = await invoicesCollection.insertOne(finalInvoice);

    // Update payment record
    const paymentsCollection = db.collection('payments');
    const updateData: any = { 
      invoiceCreated: true,
      invoiceId: insertResult.insertedId,
      invoiceNumber,
      processedAt: new Date()
    };
    
    // If the invoice has a customer email, update the payment with it
    if (finalInvoice.billTo?.email) {
      updateData.customerEmail = finalInvoice.billTo.email;
    }
    
    await paymentsCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      { $set: updateData }
    );

    // Update registration record
    const registrationsCollection = db.collection('registrations');
    await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { 
        $set: { 
          invoiceCreated: true,
          invoiceId: insertResult.insertedId,
          invoiceNumber,
          processedAt: new Date()
        }
      }
    );

    // Log approval
    const auditCollection = db.collection('invoice_audit_log');
    await auditCollection.insertOne({
      action: 'approved',
      invoiceNumber,
      paymentId,
      registrationId,
      approvedAt: new Date(),
      approvedBy: 'system',
      matchConfidence: body.matchConfidence,
      matchMethod: body.matchMethod
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice approved and created successfully'
    });

  } catch (error) {
    console.error('Error approving invoice:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}