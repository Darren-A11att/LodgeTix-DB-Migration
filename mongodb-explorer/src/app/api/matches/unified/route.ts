import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { UnifiedMatchingService } from '@/services/unified-matching-service';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const matchingService = new UnifiedMatchingService(db);
    
    const body = await request.json();
    const { payment, paymentId } = body;

    if (!payment && !paymentId) {
      return NextResponse.json(
        { error: 'Payment data or payment ID is required' },
        { status: 400 }
      );
    }

    let paymentData = payment;
    
    // If only paymentId provided, fetch the payment
    if (!paymentData && paymentId) {
      paymentData = await db.collection('payments').findOne({
        _id: new ObjectId(paymentId)
      });
      
      if (!paymentData) {
        return NextResponse.json(
          { error: 'Payment not found' },
          { status: 404 }
        );
      }
    }

    // Find match using unified service
    const matchResult = await matchingService.findMatch(paymentData);

    return NextResponse.json({
      success: true,
      payment: paymentData,
      match: matchResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in unified matching:', error);
    return NextResponse.json(
      { error: 'Failed to find match' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const matchingService = new UnifiedMatchingService(db);
    
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    switch (action) {
      case 'statistics':
        const stats = await matchingService.getMatchStatistics();
        return NextResponse.json(stats);

      case 'reprocess':
        const reprocessResult = await matchingService.reprocessUnmatched();
        return NextResponse.json({
          success: true,
          message: `Processed ${reprocessResult.processed} payments, found ${reprocessResult.matched} new matches`,
          ...reprocessResult
        });

      case 'batch':
        // Get unmatched payments for batch processing
        const payments = await db.collection('payments')
          .find({
            $or: [
              { matchConfidence: { $lt: 25 } },
              { matchConfidence: { $exists: false } },
              { matchedRegistrationId: { $exists: false } }
            ]
          })
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        const batchResults = await matchingService.findMatches(payments);
        
        return NextResponse.json({
          payments: payments.map((payment, index) => ({
            payment,
            match: batchResults[index]
          })),
          total: batchResults.length,
          matched: batchResults.filter(r => r.registration).length
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: statistics, reprocess, or batch' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in unified matching GET:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// PATCH endpoint for manual matching
export async function PATCH(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const body = await request.json();
    const { paymentId, registrationId, confidence = 100, method = 'manual' } = body;

    if (!paymentId || !registrationId) {
      return NextResponse.json(
        { error: 'Payment ID and registration ID are required' },
        { status: 400 }
      );
    }

    // Verify both records exist
    const payment = await db.collection('payments').findOne({
      _id: new ObjectId(paymentId)
    });
    
    const registration = await db.collection('registrations').findOne({
      _id: new ObjectId(registrationId)
    });

    if (!payment || !registration) {
      return NextResponse.json(
        { error: 'Payment or registration not found' },
        { status: 404 }
      );
    }

    // Update payment with manual match
    await db.collection('payments').updateOne(
      { _id: new ObjectId(paymentId) },
      {
        $set: {
          matchedRegistrationId: registrationId,
          linkedRegistrationId: registrationId, // For backward compatibility
          matchConfidence: confidence,
          matchMethod: method,
          matchDetails: [{
            fieldName: 'manual_match',
            paymentValue: paymentId,
            registrationValue: registrationId,
            paymentPath: 'manual',
            registrationPath: '_id',
            points: confidence,
            isMatch: true
          }],
          matchedAt: new Date(),
          matchedBy: 'manual'
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Manual match created successfully',
      paymentId,
      registrationId,
      confidence,
      method
    });

  } catch (error) {
    console.error('Error creating manual match:', error);
    return NextResponse.json(
      { error: 'Failed to create manual match' },
      { status: 500 }
    );
  }
}

// DELETE endpoint for removing matches
export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Remove match information from payment
    await db.collection('payments').updateOne(
      { _id: new ObjectId(paymentId) },
      {
        $unset: {
          matchedRegistrationId: '',
          linkedRegistrationId: '',
          matchConfidence: '',
          matchMethod: '',
          matchDetails: '',
          matchedAt: '',
          matchedBy: ''
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Match removed successfully',
      paymentId
    });

  } catch (error) {
    console.error('Error removing match:', error);
    return NextResponse.json(
      { error: 'Failed to remove match' },
      { status: 500 }
    );
  }
}