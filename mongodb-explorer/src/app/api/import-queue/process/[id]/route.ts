import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { ImportQueueItem, PaymentImport } from '@/types/payment-import';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectMongoDB();
    const body = await request.json();
    const { confirmTransformation, overrides } = body;
    
    // Get queue item
    const queueItem = await db
      .collection<ImportQueueItem>('import_queue')
      .findOne({ queueId: params.id });
    
    if (!queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      );
    }
    
    if (queueItem.importStatus === 'imported') {
      return NextResponse.json(
        { error: 'Item already imported' },
        { status: 400 }
      );
    }
    
    if (queueItem.validationStatus === 'invalid' && !confirmTransformation) {
      return NextResponse.json(
        { error: 'Validation errors must be confirmed' },
        { status: 400 }
      );
    }
    
    // Update status to processing
    await db.collection<ImportQueueItem>('import_queue').updateOne(
      { queueId: params.id },
      { $set: { importStatus: 'processing' } }
    );
    
    try {
      // Apply any overrides
      const finalRegistration = overrides 
        ? { ...queueItem.transformedRegistration, ...overrides }
        : queueItem.transformedRegistration;
      
      // First, check if payment already exists
      let existingPayment = await db.collection('payments').findOne({
        squarePaymentId: queueItem.paymentData.squarePaymentId
      });
      
      if (!existingPayment) {
        // Also check by transaction ID
        existingPayment = await db.collection('payments').findOne({
          transactionId: queueItem.paymentData.squarePaymentId
        });
      }
      
      let paymentId: string;
      
      if (existingPayment) {
        // Update existing payment with registration link
        paymentId = existingPayment._id.toString();
        
        await db.collection('payments').updateOne(
          { _id: existingPayment._id },
          {
            $set: {
              linkedRegistrationId: queueItem.supabaseRegistrationId,
              registrationId: queueItem.supabaseRegistrationId,
              matchedAt: new Date(),
              matchedBy: 'import-queue',
              matchConfidence: queueItem.matchScore,
              updatedAt: new Date()
            }
          }
        );
      } else {
        // Create new payment record with proper linking
        paymentId = new ObjectId().toString();
        
        const paymentRecord = {
          _id: new ObjectId(paymentId),
          paymentId: queueItem.paymentData.squarePaymentId,
          transactionId: queueItem.paymentData.squarePaymentId,
          squarePaymentId: queueItem.paymentData.squarePaymentId,
          
          // Link to registration
          linkedRegistrationId: queueItem.supabaseRegistrationId,
          registrationId: queueItem.supabaseRegistrationId,
          
          // Payment data
          amount: queueItem.paymentData.amount,
          grossAmount: queueItem.paymentData.amount,
          currency: queueItem.paymentData.currency,
          status: 'paid',
          paymentMethod: queueItem.paymentData.paymentMethod,
          
          // Customer info
          customerEmail: queueItem.paymentData.customerEmail,
          customerName: queueItem.paymentData.customerName,
          
          // Timestamps
          timestamp: queueItem.paymentData.createdAt,
          createdAt: queueItem.paymentData.createdAt,
          importedAt: new Date(),
          matchedAt: new Date(),
          
          // Source info
          source: 'square',
          importedFrom: 'import-queue',
          queueId: queueItem.queueId,
          
          // Match info
          matchedBy: 'import-queue',
          matchConfidence: queueItem.matchScore,
          
          // Original data
          originalData: queueItem.paymentData.paymentGatewayData || queueItem.paymentData.rawSquareData || queueItem.paymentData
        };
        
        await db.collection('payments').insertOne(paymentRecord);
      }
      
      // Check if registration already exists
      let existingRegistration = await db.collection('registrations').findOne({
        registrationId: queueItem.supabaseRegistrationId
      });
      
      if (!existingRegistration) {
        // Try to find by ID
        existingRegistration = await db.collection('registrations').findOne({
          _id: queueItem.supabaseRegistrationId
        });
      }
      
      let registrationId: string;
      
      if (existingRegistration) {
        // Update existing registration with payment link
        registrationId = existingRegistration._id.toString();
        
        await db.collection('registrations').updateOne(
          { _id: existingRegistration._id },
          {
            $set: {
              // Link to payment
              squarePaymentId: queueItem.paymentData.squarePaymentId,
              square_payment_id: queueItem.paymentData.squarePaymentId,
              linkedPaymentId: paymentId,
              
              // Update confirmation number if generated
              ...(queueItem.generatedConfirmationNumber && !existingRegistration.confirmationNumber ? {
                confirmationNumber: queueItem.generatedConfirmationNumber
              } : {}),
              
              // Update match info
              matchedAt: new Date(),
              matchedBy: 'import-queue',
              updatedAt: new Date()
            }
          }
        );
      } else {
        // Create new registration record with proper linking
        registrationId = new ObjectId().toString();
        
        const registrationRecord = {
          _id: new ObjectId(registrationId),
          registrationId: queueItem.supabaseRegistrationId,
          
          // Link to payment
          squarePaymentId: queueItem.paymentData.squarePaymentId,
          square_payment_id: queueItem.paymentData.squarePaymentId,
          linkedPaymentId: paymentId,
          paymentId: paymentId,
          
          // Registration data
          confirmationNumber: queueItem.generatedConfirmationNumber || finalRegistration.confirmation_number,
          email: finalRegistration.email,
          customerEmail: finalRegistration.email,
          fullName: finalRegistration.full_name,
          firstName: finalRegistration.first_name,
          lastName: finalRegistration.last_name,
          registrationType: finalRegistration.registration_type,
          totalAmount: finalRegistration.total_amount,
          status: 'completed',
          paymentStatus: 'paid',
          
          // Timestamps
          createdAt: new Date(finalRegistration.created_at),
          importedAt: new Date(),
          matchedAt: new Date(),
          
          // Source info
          importedFrom: 'supabase-via-queue',
          queueId: queueItem.queueId,
          
          // Match info
          matchedBy: 'import-queue',
          
          // Original data
          registrationData: queueItem.registrationData
        };
        
        await db.collection('registrations').insertOne(registrationRecord);
      }
      
      // Update queue item
      await db.collection<ImportQueueItem>('import_queue').updateOne(
        { queueId: params.id },
        { 
          $set: { 
            importStatus: 'imported',
            importedAt: new Date(),
            generatedPaymentId: paymentId,
            generatedRegistrationId: registrationId
          } 
        }
      );
      
      // Delete from payment_imports after successful import
      // This prevents duplicate storage and keeps payment_imports clean
      const deleteResult = await db.collection<PaymentImport>('payment_imports').deleteOne(
        { _id: queueItem.paymentImportId }
      );
      
      console.log(`Deleted payment_import record ${queueItem.paymentImportId} after successful import to payments collection`);
      
      // Alternative: If you want to keep for audit, uncomment this instead:
      /*
      await db.collection<PaymentImport>('payment_imports').updateOne(
        { _id: queueItem.paymentImportId },
        { 
          $set: { 
            processingStatus: 'imported',
            linkedRegistrationId: registrationId,
            linkedPaymentId: paymentId,
            importedToPaymentsAt: new Date(),
            deletedAfterImport: false
          } 
        }
      );
      */
      
      // Update reports (mock - in real implementation would update actual reports)
      const updatedReports = ['payment-registration-links', 'import-reconciliation'];
      
      return NextResponse.json({
        paymentId,
        registrationId,
        confirmationNumber: queueItem.generatedConfirmationNumber || finalRegistration.confirmation_number,
        updatedReports,
        processingTime: Date.now() - queueItem.createdAt.getTime(),
        paymentImportDeleted: deleteResult.deletedCount === 1
      });
      
    } catch (error) {
      // If import fails, update status
      await db.collection<ImportQueueItem>('import_queue').updateOne(
        { queueId: params.id },
        { 
          $set: { 
            importStatus: 'failed',
            importError: error instanceof Error ? error.message : 'Unknown error'
          } 
        }
      );
      
      throw error;
    }
  } catch (error) {
    console.error('Error processing queue item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process import' },
      { status: 500 }
    );
  }
}