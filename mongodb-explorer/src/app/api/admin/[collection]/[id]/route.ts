import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('commerce');
    const item = await db.collection(params.collection).findOne({ 
      _id: new ObjectId(params.id) 
    });
    
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
) {
  try {
    const body = await request.json();
    const { _id, ...updateData } = body; // Remove _id from update data
    
    // Update timestamp
    updateData.updatedAt = new Date();
    
    const client = await clientPromise;
    const db = client.db('commerce');
    
    const result = await db.collection(params.collection).updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );
    
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { collection: string; id: string } }
) {
  try {
    const client = await clientPromise;
    const db = client.db('commerce');
    
    const result = await db.collection(params.collection).deleteOne({ 
      _id: new ObjectId(params.id) 
    });
    
    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}