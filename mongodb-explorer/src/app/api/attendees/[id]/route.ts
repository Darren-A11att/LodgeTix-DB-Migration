import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectMongoDB();
    const { id } = await params;
    
    // Try to find by attendeeId first
    let attendee = await db.collection('attendees').findOne({ attendeeId: id });
    
    // If not found and id is valid ObjectId, try by _id
    if (!attendee && ObjectId.isValid(id)) {
      attendee = await db.collection('attendees').findOne({ _id: new ObjectId(id) });
    }
    
    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    
    return NextResponse.json(attendee);
  } catch (error) {
    console.error('Error fetching attendee:', error);
    return NextResponse.json({ error: 'Failed to fetch attendee' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectMongoDB();
    const data = await request.json();
    const { id } = await params;
    
    // Remove _id from update data
    const { _id, ...updateData } = data;
    
    // Update by attendeeId first
    let result = await db.collection('attendees').updateOne(
      { attendeeId: id },
      { $set: updateData }
    );
    
    // If not found and id is valid ObjectId, try by _id
    if (result.matchedCount === 0 && ObjectId.isValid(id)) {
      result = await db.collection('attendees').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
    }
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating attendee:', error);
    return NextResponse.json({ error: 'Failed to update attendee' }, { status: 500 });
  }
}