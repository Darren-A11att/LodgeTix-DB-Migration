import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/services/email-service';
import { Invoice } from '@/types/invoice';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    console.log('📮 Email API: POST request received');
    
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const invoiceData = formData.get('invoice') as string;
    const recipientEmail = formData.get('recipientEmail') as string;
    const recipientName = formData.get('recipientName') as string;
    const functionName = formData.get('functionName') as string | null;

    console.log('📮 Email API: Form data received:', {
      hasPdf: !!pdfFile,
      hasInvoice: !!invoiceData,
      recipientEmail,
      recipientName,
      functionName,
      functionNameType: typeof functionName
    });

    if (!pdfFile || !invoiceData || !recipientEmail || !recipientName) {
      console.log('📮 ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: pdf, invoice, recipientEmail, or recipientName' },
        { status: 400 }
      );
    }
    
    // Parse invoice data
    const invoice: Invoice = JSON.parse(invoiceData);
    
    // If functionName is not provided, try to get it from the database
    let finalFunctionName = functionName;
    if (!finalFunctionName && invoice.functionId) {
      console.log('📮 No functionName provided, attempting to fetch from database using functionId:', invoice.functionId);
      try {
        const { db } = await connectMongoDB();
        const functionDoc = await db.collection('functions').findOne({ 
          _id: new ObjectId(invoice.functionId) 
        });
        
        if (functionDoc && functionDoc.name) {
          finalFunctionName = functionDoc.name;
          console.log('📮 Found function name from database:', finalFunctionName);
        } else {
          console.log('📮 ⚠️ Could not find function in database');
        }
      } catch (dbError) {
        console.error('📮 ❌ Error fetching function from database:', dbError);
      }
    }
    
    console.log('📮 Final functionName to pass to email service:', finalFunctionName);
    
    // Convert PDF file to Blob
    const pdfBlob = new Blob([await pdfFile.arrayBuffer()], { type: 'application/pdf' });
    
    // Send email
    const emailResult = await sendInvoiceEmail({
      pdfBlob,
      invoice,
      recipientEmail,
      recipientName,
      functionName: finalFunctionName || undefined
    });
    
    // Get email metadata
    const emailMetadata = {
      sent: new Date(),
      to: recipientEmail,
      recipientName: recipientName,
      subject: `Invoice ${invoice.invoiceNumber}`,
      idempotencyKey: emailResult.idempotencyKey,
      id: emailResult.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: invoice.total,
      senderEmail: 'no-reply@lodgetix.io',
      status: 'sent'
    };
    
    // Update database with email tracking
    try {
      const { db } = await connectMongoDB();
      
      // Find and update the invoice document with email tracking
      if (invoice._id) {
        const invoiceId = typeof invoice._id === 'string' ? new ObjectId(invoice._id) : invoice._id;
        await db.collection('invoices').updateOne(
          { _id: invoiceId },
          { 
            $set: {
              invoiceEmailSent: true,
              invoiceEmailedTo: recipientEmail,
              invoiceEmailedDateTime: emailMetadata.sent,
              invoiceEmailIdempotencyKey: emailMetadata.idempotencyKey,
              invoiceEmailId: emailMetadata.id,
              updatedAt: new Date()
            },
            $push: {
              emailHistory: {
                sentAt: emailMetadata.sent,
                sentTo: recipientEmail,
                recipientName: recipientName,
                emailId: emailMetadata.id,
                idempotencyKey: emailMetadata.idempotencyKey
              }
            } as any
          }
        );
        console.log(`Updated invoice email tracking for invoice ${invoice.invoiceNumber}`);
        
        // Update payment document with email tracking
        if (invoice.paymentId) {
          await db.collection('payments').updateOne(
            { _id: new ObjectId(invoice.paymentId) },
            { 
              $set: {
                invoiceEmailSent: true,
                invoiceEmailedTo: recipientEmail,
                invoiceEmailedDateTime: emailMetadata.sent,
                invoiceEmailIdempotencyKey: emailMetadata.idempotencyKey,
                invoiceEmailId: emailMetadata.id
              }
            }
          );
          console.log(`Updated payment email tracking for payment ${invoice.paymentId}`);
        }
        
        // Update registration document with email tracking
        if (invoice.registrationId) {
          await db.collection('registrations').updateOne(
            { _id: new ObjectId(invoice.registrationId) },
            { 
              $set: {
                invoiceEmailSent: true,
                invoiceEmailedTo: recipientEmail,
                invoiceEmailedDateTime: emailMetadata.sent,
                invoiceEmailIdempotencyKey: emailMetadata.idempotencyKey,
                invoiceEmailId: emailMetadata.id
              }
            }
          );
          console.log(`Updated registration email tracking for registration ${invoice.registrationId}`);
        }
      }
    } catch (dbError) {
      console.error('Error updating database with email tracking:', dbError);
      // Continue even if database update fails - email was still sent
    }
    
    return NextResponse.json({
      success: true,
      message: 'Invoice email sent successfully',
      emailId: emailResult.id,
      recipientEmail: recipientEmail,
      metadata: emailMetadata
    });
    
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send invoice email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}