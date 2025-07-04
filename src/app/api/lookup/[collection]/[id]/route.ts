import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
) {
  try {
    const { collection, id } = params;
    
    // Validate collection name to prevent injection
    const allowedCollections = ['event_tickets', 'products', 'attendees', 'organisations'];
    if (!allowedCollections.includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Try to find by _id first
    let document = await db.collection(collection).findOne({ _id: id });
    
    // If not found by _id, try other common ID fields
    if (!document) {
      document = await db.collection(collection).findOne({ id: id });
    }
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(document);
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup document' },
      { status: 500 }
    );
  }
}