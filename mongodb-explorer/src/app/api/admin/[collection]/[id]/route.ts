import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  try {
    const { collection, id } = await params;
    
    // Handle special endpoints
    if (id === 'status-counts' && collection === 'orders') {
      const client = await clientPromise;
      const db = client.db('commerce');
      
      const statuses = ['pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
      const counts: Record<string, number> = {};
      
      for (const status of statuses) {
        counts[status] = await db.collection('orders').countDocuments({ status });
      }
      
      return NextResponse.json({ data: counts });
    }
    
    // Regular item fetch
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Try to parse as ObjectId, fallback to string id
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      // If not a valid ObjectId, try as string id
      query = { id: id };
    }
    
    const item = await db.collection(collection).findOne(query);
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  try {
    const { collection, id } = await params;
    const body = await request.json();
    const { _id, ...updateData } = body; // Remove _id from update data
    
    // Update timestamp
    updateData.updatedAt = new Date();
    
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Try to parse as ObjectId, fallback to string id
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { id: id };
    }
    
    const result = await db.collection(collection).updateOne(
      query,
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
  { params }: { params: Promise<{ collection: string; id: string }> }
) {
  try {
    const { collection, id } = await params;
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Try to parse as ObjectId, fallback to string id
    let query: any;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { id: id };
    }
    
    const result = await db.collection(collection).deleteOne(query);
    
    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}