import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const data = await db.collection(collection).find({}).limit(100).toArray();
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    const body = await request.json();
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Remove _id if it's empty string
    if (body._id === '') delete body._id;
    
    // Add timestamps
    body.createdAt = new Date();
    body.updatedAt = new Date();
    
    const result = await db.collection(collection).insertOne(body);
    
    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}