import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ImportQueueItem, PaymentImport, MatchCriteria } from '@/types/payment-import';
import { generateConfirmationNumber } from '@/services/reversed-timestamp-confirmation';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const body = await request.json();
    const { paymentImportId, registrationId, matchingCriteria } = body;
    
    if (!paymentImportId || !registrationId) {
      return NextResponse.json(
        { error: 'Payment import ID and registration ID are required' },
        { status: 400 }
      );
    }
    
    // Fetch payment data
    const payment = await db
      .collection<PaymentImport>('payment_imports')
      .findOne({ _id: new ObjectId(paymentImportId) });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // For this example, we'll use mock registration data
    // In production, this would fetch from Supabase
    const registrationData = {
      id: registrationId,
      email: payment.customerEmail || 'unknown@example.com',
      full_name: payment.customerName || 'Unknown',
      total_amount: payment.amount,
      registration_type: 'individual',
      created_at: new Date().toISOString()
    };
    
    // Calculate match score
    const matchScore = matchingCriteria.reduce((score: number, criteria: MatchCriteria) => {
      return score + (criteria.matched ? criteria.weight * 100 : 0);
    }, 0);
    
    // Generate queue ID
    const queueId = `QUEUE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate confirmation number if not exists
    const confirmationNumber = (registrationData as any).confirmation_number || 
      generateConfirmationNumber(registrationData.registration_type);
    
    // Create queue item
    const queueItem: ImportQueueItem = {
      queueId,
      createdAt: new Date(),
      createdBy: 'api',
      
      paymentImportId: new ObjectId(paymentImportId),
      paymentData: payment,
      
      supabaseRegistrationId: registrationId,
      registrationData,
      transformedRegistration: {
        ...registrationData,
        confirmationNumber
      },
      
      matchingCriteria,
      matchMethod: 'manual',
      matchScore,
      
      validationStatus: 'pending',
      importStatus: 'pending',
      
      generatedConfirmationNumber: confirmationNumber
    };
    
    // Validate the queue item
    const validationErrors = validateQueueItem(queueItem);
    queueItem.validationStatus = validationErrors.length === 0 ? 'valid' : 'invalid';
    queueItem.validationErrors = validationErrors;
    
    // Insert into queue
    await db.collection<ImportQueueItem>('import_queue').insertOne(queueItem);
    
    // Update payment status to matched
    await db.collection<PaymentImport>('payment_imports').updateOne(
      { _id: new ObjectId(paymentImportId) },
      { 
        $set: { 
          processingStatus: 'matched',
          matchedRegistrationId: registrationId,
          matchConfidence: matchScore,
          matchedBy: 'api',
          matchedAt: new Date()
        } 
      }
    );
    
    return NextResponse.json({
      queueId,
      transformedData: queueItem.transformedRegistration,
      validationResult: {
        isValid: queueItem.validationStatus === 'valid',
        errors: validationErrors.filter(e => e.severity === 'error'),
        warnings: validationErrors.filter(e => e.severity === 'warning')
      }
    });
  } catch (error) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: 'Failed to add to queue' },
      { status: 500 }
    );
  }
}

function validateQueueItem(item: ImportQueueItem): ImportQueueItem['validationErrors'] {
  const errors: NonNullable<ImportQueueItem['validationErrors']> = [];
  
  // Check required fields
  if (!item.paymentData.amount || item.paymentData.amount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Payment amount must be greater than 0',
      severity: 'error'
    });
  }
  
  if (!item.registrationData.email) {
    errors.push({
      field: 'email',
      message: 'Registration email is required',
      severity: 'error'
    });
  }
  
  // Check amount match
  const amountDiff = Math.abs(item.paymentData.amount - item.registrationData.total_amount);
  if (amountDiff > 1) {
    errors.push({
      field: 'amount',
      message: `Amount mismatch: Payment ${item.paymentData.amount} vs Registration ${item.registrationData.total_amount}`,
      severity: amountDiff > 10 ? 'error' : 'warning'
    });
  }
  
  // Check match score
  if (item.matchScore < 40) {
    errors.push({
      field: 'matchScore',
      message: 'Low match confidence score',
      severity: 'warning'
    });
  }
  
  return errors;
}