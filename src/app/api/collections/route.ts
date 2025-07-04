import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'LodgeTix-migration-test-1';

export async function GET(request: NextRequest) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    // Get document count for each collection
    const collectionInfo = await Promise.all(
      collections.map(async (col) => {
        const collection = db.collection(col.name);
        const count = await collection.countDocuments();
        
        // Get a sample document
        const sampleDocument = await collection.findOne({});
        
        return {
          name: col.name,
          count,
          sampleDocument
        };
      })
    );
    
    return NextResponse.json(collectionInfo);
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}