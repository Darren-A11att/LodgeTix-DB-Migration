import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'LodgeTix-migration-test-1';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const client = new MongoClient(MONGODB_URI);
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(params.name);
    
    // Get total count
    const total = await collection.countDocuments();
    
    // Get documents with pagination
    const documents = await collection
      .find({})
      .skip(offset)
      .limit(limit)
      .toArray();
    
    return NextResponse.json({
      documents,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    const document = await request.json();
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(params.name);
    
    // Insert the document
    const result = await collection.insertOne(document);
    
    return NextResponse.json({
      success: true,
      insertedId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}