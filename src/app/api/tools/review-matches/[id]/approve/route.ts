import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Get the pending import
    const pending = await db.collection('pending-imports').findOne({
      _id: new ObjectId(id)
    });
    
    if (!pending) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }
    
    // Remove pending-specific fields
    const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = pending;
    
    // Insert into main registrations collection
    await db.collection('registrations').insertOne({
      ...registration,
      importedAt: new Date(),
      paymentVerified: true,
      paymentVerifiedBy: 'manual_review',
      reviewedAt: new Date()
    });
    
    // Remove from pending imports
    await db.collection('pending-imports').deleteOne({ _id: new ObjectId(id) });
    
    // Update review history
    await db.collection('review-queue').insertOne({
      reviewedAt: new Date(),
      action: 'approved',
      registrationId: registration.registrationId,
      confirmationNumber: registration.confirmationNumber,
      reviewer: 'user' // In a real app, this would be the logged-in user
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Approve match error:', error);
    return NextResponse.json(
      { error: 'Failed to approve match', details: error.message },
      { status: 500 }
    );
  }
}