import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/services/email-service';
import { Invoice } from '../../../types/invoice';
import { connectMongoDB } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const invoiceData = formData.get('invoice') as string;
    const recipientEmail = formData.get('recipientEmail') as string;
    const recipientName = formData.get('recipientName') as string;
    const functionName = formData.get('functionName') as string | null;

    if (!pdfFile || !invoiceData || !recipientEmail || !recipientName) {
      return NextResponse.json(
        { error: 'Missing required fields: pdf, invoice, recipientEmail, or recipientName' },
        { status: 400 }
      );
    }

    // Parse invoice data
    let invoice: Invoice;
    try {
      invoice = JSON.parse(invoiceData);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid invoice data format' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const arrayBuffer = await pdfFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

    // Send email with attachment and get metadata
    const emailMetadata = await sendInvoiceEmail({
      invoice,
      pdfBlob: blob,
      recipientEmail,
      recipientName,
      functionName: functionName || undefined
    });

    // Update invoice, payment, and registration with comprehensive email tracking information
    try {
      const { db } = await connectMongoDB();
      
      // Only update customer invoices with email metadata
      if (invoice.invoiceType === 'customer') {
        // Update invoice document
        await db.collection('invoices').updateOne(
          { invoiceNumber: invoice.invoiceNumber },
          { 
            $set: {
              emailSent: true,
              emailedTo: recipientEmail,
              emailedDateTime: emailMetadata.sent,
              emailedImpotencyKey: emailMetadata.idempotencyKey,
              // Add comprehensive email object
              email: {
                id: emailMetadata.id,
                idempotencyKey: emailMetadata.idempotencyKey,
                service: emailMetadata.service,
                from: emailMetadata.from,
                sent: emailMetadata.sent,
                scheduled_at: emailMetadata.scheduled_at,
                to: emailMetadata.to,
                cc: emailMetadata.cc,
                bcc: emailMetadata.bcc,
                reply_to: emailMetadata.reply_to,
                subject: emailMetadata.subject,
                attachments: emailMetadata.attachments,
                tags: emailMetadata.tags,
                plainContent: emailMetadata.plainContent,
                htmlContent: emailMetadata.htmlContent
              }
            }
          }
        );
        console.log(`Updated invoice email tracking for invoice ${invoice.invoiceNumber}`);
        
        // Update payment document with email tracking
        if (invoice.paymentId) {
          await db.collection('payments').updateOne(
            { _id: invoice.paymentId },
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
            { _id: invoice.registrationId },
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
    } catch (updateError) {
      // Log error but don't fail the email send response
      console.error('Error updating email tracking:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: `Invoice email sent successfully to ${recipientEmail}`,
      invoiceNumber: invoice.invoiceNumber
    });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}