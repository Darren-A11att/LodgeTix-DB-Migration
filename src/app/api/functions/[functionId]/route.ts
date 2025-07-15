import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ functionId: string }> }
) {
  let client: MongoClient | null = null;

  try {
    // Await params as required in Next.js 15
    const { functionId } = await params;
    
    console.log('🎯 Functions API: GET request received');
    console.log('🎯 Function ID requested:', functionId);
    
    if (!functionId) {
      console.log('🎯 ❌ Function ID is missing');
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
    console.log('🎯 Searching by functionId field...');
    functionDoc = await db.collection('functions').findOne({ functionId });
    
    if (functionDoc) {
      console.log('🎯 ✅ Found by functionId field');
    } else {
      console.log('🎯 Not found by functionId field');
    }
    
    // If not found and the ID looks like an ObjectId, try finding by _id
    if (!functionDoc && ObjectId.isValid(functionId)) {
      console.log('🎯 Searching by _id field (ObjectId)...');
      functionDoc = await db.collection('functions').findOne({ _id: new ObjectId(functionId) });
      if (functionDoc) {
        console.log('🎯 ✅ Found by _id field');
      } else {
        console.log('🎯 Not found by _id field');
      }
    }
    
    // If still not found, try finding by id field (some systems store ObjectId as string in id field)
    if (!functionDoc) {
      console.log('🎯 Searching by id field...');
      functionDoc = await db.collection('functions').findOne({ id: functionId });
      if (functionDoc) {
        console.log('🎯 ✅ Found by id field');
      } else {
        console.log('🎯 Not found by id field');
      }
    }
    
    if (!functionDoc) {
      console.log('🎯 ❌ Function not found in any field');
      return NextResponse.json(
        { error: 'Function not found' },
        { status: 404 }
      );
    }

    console.log('🎯 Function found:', {
      _id: functionDoc._id,
      functionId: functionDoc.functionId,
      name: functionDoc.name
    });
    
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