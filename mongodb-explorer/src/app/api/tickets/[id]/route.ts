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
    
    // Try to find by _id first
    let ticket;
    if (ObjectId.isValid(id)) {
      ticket = await db.collection('tickets').findOne({ _id: new ObjectId(id) });
    }
    
    // If not found, try by ticketId
    if (!ticket) {
      ticket = await db.collection('tickets').findOne({ ticketId: id });
    }
    
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
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
    
    // Update by _id or ticketId
    let result;
    if (ObjectId.isValid(id)) {
      result = await db.collection('tickets').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
    }
    
    if (!result || result.matchedCount === 0) {
      result = await db.collection('tickets').updateOne(
        { ticketId: id },
        { $set: updateData }
      );
    }
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}