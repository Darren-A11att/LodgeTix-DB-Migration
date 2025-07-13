import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const connection = await connectMongoDB();
    const db = connection.db;
    
    const body = await request.json();
    const { reason } = body;
    
    // Get the pending import
    const pending = await db.collection('pending-imports').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!pending) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }
    
    // Update the pending import with rejection info
    await db.collection('pending-imports').updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          lastReviewDate: new Date(),
          lastReviewAction: 'rejected',
          lastReviewReason: reason || 'Manual rejection',
          reviewAttempts: (pending.reviewAttempts || 0) + 1
        }
      }
    );
    
    // Update review history
    await db.collection('review-queue').insertOne({
      reviewedAt: new Date(),
      action: 'rejected',
      registrationId: pending.registrationId,
      confirmationNumber: pending.confirmationNumber,
      reason: reason || 'Manual rejection',
      reviewer: 'user' // In a real app, this would be the logged-in user
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Reject match error:', error);
    return NextResponse.json(
      { error: 'Failed to reject match', details: error.message },
      { status: 500 }
    );
  }
}