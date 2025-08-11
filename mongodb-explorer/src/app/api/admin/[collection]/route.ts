import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getDatabaseName } from '@/lib/database-selector';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> }
) {
  console.log('[API GET] Request received');
  console.log('[API GET] URL:', request.url);
  console.log('[API GET] ENV MONGODB_DB:', process.env.MONGODB_DB);
  console.log('[API GET] ENV MONGODB_URI exists:', !!process.env.MONGODB_URI);
  
  try {
    const { collection } = await params;
    console.log(`[API GET] Collection param: ${collection}`);
    
    const client = await clientPromise;
    const dbName = getDatabaseName(true); // true = admin route, use commerce database
    console.log(`[API GET] Admin route - Using database: ${dbName}`);
    
    const db = client.db(dbName);
    
    // List all collections to debug
    const collections = await db.listCollections().toArray();
    console.log(`[API GET] Available collections:`, collections.map(c => c.name));
    
    const data = await db.collection(collection).find({}).limit(100).toArray();
    console.log(`[API GET] Query result: Found ${data.length} documents in ${collection}`);
    
    if (data.length > 0) {
      console.log(`[API GET] First document ID:`, data[0]._id);
    }
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: String(error) }, { status: 500 });
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
    const dbName = getDatabaseName(true); // true = admin route, use commerce database
    const db = client.db(dbName);
    
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