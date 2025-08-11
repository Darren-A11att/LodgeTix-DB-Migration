import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    const query = await request.json();
    
    // Await params as required in Next.js 15
    const { name } = await params;
    
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(name);
    
    // Build MongoDB query from provided criteria
    const mongoQuery: any = {};
    
    // Handle different query patterns
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        // Handle ObjectId fields
        if (key === '_id' || key.endsWith('Id')) {
          mongoQuery[key] = value;
        } else {
          mongoQuery[key] = value;
        }
      }
    });
    
    // Find matching documents
    const results = await collection
      .find(mongoQuery)
      .limit(100) // Limit to prevent huge result sets
      .toArray();
    
    return NextResponse.json({
      results,
      count: results.length,
      query: mongoQuery
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      { error: 'Failed to search documents' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}