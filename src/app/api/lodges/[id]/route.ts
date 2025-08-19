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
    
    // Try to find by lodgeId first
    let lodge = await db.collection('lodges').findOne({ lodgeId: id });
    
    // If not found and id is valid ObjectId, try by _id
    if (!lodge && ObjectId.isValid(id)) {
      lodge = await db.collection('lodges').findOne({ _id: new ObjectId(id) });
    }
    
    if (!lodge) {
      return NextResponse.json({ error: 'Lodge not found' }, { status: 404 });
    }
    
    return NextResponse.json(lodge);
  } catch (error) {
    console.error('Error fetching lodge:', error);
    return NextResponse.json({ error: 'Failed to fetch lodge' }, { status: 500 });
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
    
    // Update by lodgeId first
    let result = await db.collection('lodges').updateOne(
      { lodgeId: id },
      { $set: updateData }
    );
    
    // If not found and id is valid ObjectId, try by _id
    if (result.matchedCount === 0 && ObjectId.isValid(id)) {
      result = await db.collection('lodges').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
    }
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Lodge not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating lodge:', error);
    return NextResponse.json({ error: 'Failed to update lodge' }, { status: 500 });
  }
}