import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectMongoDB } from '@/lib/mongodb';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, registrationId, reason, comments, invoicePreview } = body;

    if (!paymentId || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();

    // Update payment record to mark as declined
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      { 
        $set: { 
          invoiceDeclined: true,
          declinedAt: new Date(),
          declineReason: reason,
          declineComments: comments
        }
      }
    );

    // Log decline in audit log
    const auditCollection = db.collection('invoice_audit_log');
    await auditCollection.insertOne({
      action: 'declined',
      paymentId,
      registrationId,
      declinedAt: new Date(),
      declinedBy: 'system',
      reason,
      comments,
      matchConfidence: invoicePreview?.matchDetails?.confidence,
      matchMethod: invoicePreview?.matchDetails?.method
    });

    // Write to decline log file
    const declineLog = {
      timestamp: new Date().toISOString(),
      paymentId,
      registrationId,
      reason,
      comments,
      paymentDetails: {
        amount: invoicePreview?.payment?.amount,
        date: invoicePreview?.payment?.paidDate,
        source: invoicePreview?.paymentDetails?.source,
        originalId: invoicePreview?.paymentDetails?.originalPaymentId
      },
      registrationDetails: {
        confirmationNumber: invoicePreview?.registrationDetails?.confirmationNumber,
        functionName: invoicePreview?.registrationDetails?.functionName
      },
      matchDetails: invoicePreview?.matchDetails
    };

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs', 'declined-invoices');
    await fs.mkdir(logsDir, { recursive: true });

    // Write to daily log file
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `declined-${today}.json`);
    
    let existingLogs = [];
    try {
      const fileContent = await fs.readFile(logFile, 'utf-8');
      existingLogs = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
    }

    existingLogs.push(declineLog);
    await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Invoice declined and logged successfully'
    });

  } catch (error) {
    console.error('Error declining invoice:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}