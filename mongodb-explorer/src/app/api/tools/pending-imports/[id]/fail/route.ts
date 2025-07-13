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
    
    // Get the pending import
    const pending = await db.collection('pending-imports').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!pending) {
      return NextResponse.json(
        { error: 'Pending import not found' },
        { status: 404 }
      );
    }
    
    // Move to failed registrations
    await db.collection('failedRegistrations').insertOne({
      ...pending,
      failureReason: 'Manually moved to failed after review',
      failedAt: new Date(),
      finalCheckCount: pending.checkCount
    });
    
    // Remove from pending imports
    await db.collection('pending-imports').deleteOne({ 
      _id: new ObjectId(params.id) 
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Registration moved to failed imports'
    });
    
  } catch (error: any) {
    console.error('Move to failed error:', error);
    return NextResponse.json(
      { error: 'Failed to move import', details: error.message },
      { status: 500 }
    );
  }
}