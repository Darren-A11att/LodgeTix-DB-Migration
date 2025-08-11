import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'lodgetix';

if (!uri) {
  throw new Error('MONGODB_URI environment variable is required');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ functionId: string }> }
) {
  let client: MongoClient | null = null;

  try {
    // Await params as required in Next.js 15
    const { functionId } = await params;
    
    if (!functionId) {
      return NextResponse.json(
        { error: 'Function ID is required' },
        { status: 400 }
      );
    }

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    
    let functionDoc = null;
    
    // First try to find by functionId field
    functionDoc = await db.collection('functions').findOne({ functionId });
    
    // If not found and the ID looks like an ObjectId, try finding by _id
    if (!functionDoc && ObjectId.isValid(functionId)) {
      functionDoc = await db.collection('functions').findOne({ _id: new ObjectId(functionId) });
    }
    
    // If still not found, try finding by id field (some systems store ObjectId as string in id field)
    if (!functionDoc) {
      functionDoc = await db.collection('functions').findOne({ id: functionId });
    }
    
    if (!functionDoc) {
      return NextResponse.json(
        { error: 'Function not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(functionDoc);
  } catch (error) {
    console.error('Error fetching function:', error);
    return NextResponse.json(
      { error: 'Failed to fetch function', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}