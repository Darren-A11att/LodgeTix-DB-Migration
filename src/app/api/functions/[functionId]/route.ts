import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

export async function GET(
  request: NextRequest,
  { params }: { params: { functionId: string } }
) {
  let client: MongoClient | null = null;

  try {
    const { functionId } = params;
    
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