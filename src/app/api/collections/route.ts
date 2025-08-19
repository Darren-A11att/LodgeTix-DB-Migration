import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, parseDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const databaseParam = searchParams.get('database');
    
    if (!databaseParam) {
      return NextResponse.json({ error: 'Database parameter is required' }, { status: 400 });
    }
    
    console.log(`Fetching collections for database: ${databaseParam}`);
    
    // Parse database to get cluster information
    const dbInfo = parseDatabase(databaseParam);
    let clusterId = 'unknown';
    let databaseName = databaseParam;
    
    if (dbInfo) {
      clusterId = dbInfo.clusterId;
      databaseName = dbInfo.databaseName;
    }
    
    // Connect to the database
    const { db } = await connectToDatabase(databaseParam);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    // Get counts and sample data for each collection
    const collectionsWithDetails = await Promise.all(
      collections.map(async (collection) => {
        try {
          const coll = db.collection(collection.name);
          const count = await coll.countDocuments();
          const sampleDoc = await coll.findOne();
          
          return {
            name: collection.name,
            type: collection.type || 'collection',
            count,
            hasData: count > 0,
            sampleFields: sampleDoc ? Object.keys(sampleDoc).slice(0, 5) : [],
            sampleDocument: sampleDoc
          };
        } catch (error) {
          console.error(`Error processing collection ${collection.name}:`, error);
          return {
            name: collection.name,
            type: collection.type || 'collection',
            count: 0,
            hasData: false,
            sampleFields: [],
            sampleDocument: null,
            error: true
          };
        }
      })
    );
    
    // Sort collections by name
    collectionsWithDetails.sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json({
      success: true,
      database: databaseParam,
      clusterId: clusterId,
      databaseName: databaseName,
      collections: collectionsWithDetails,
      total: collectionsWithDetails.length
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch collections', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}