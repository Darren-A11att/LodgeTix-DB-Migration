import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { getDatabaseById } from '@/lib/database-selector';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = parseInt(searchParams.get('skip') || '0');
  const search = searchParams.get('search') || '';
  const databaseId = searchParams.get('database') || 'lodgetix-clean-db';
  
  let client: MongoClient | null = null;
  
  try {
    // Await params as required in Next.js 15
    const { name } = await params;
    
    // Get database configuration
    const dbConfig = getDatabaseById(databaseId);
    if (!dbConfig) {
      return NextResponse.json(
        { error: 'Invalid database configuration' },
        { status: 400 }
      );
    }
    
    // Connect directly to MongoDB
    client = new MongoClient(dbConfig.connectionString);
    await client.connect();
    
    // Parse database name from connection string
    const dbName = dbConfig.connectionString.split('/').pop()?.split('?')[0] || 'lodgetix';
    const db = client.db(dbName);
    const collection = db.collection(name);
    
    // Build query
    let query = {};
    if (search) {
      // Simple text search on common fields
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { _id: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Get documents with pagination
    const documents = await collection
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await collection.countDocuments(query);
    
    return NextResponse.json({
      documents,
      pagination: {
        page: Math.floor(skip / limit) + 1,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  let client: MongoClient | null = null;
  
  try {
    const document = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const databaseId = searchParams.get('database') || 'lodgetix-clean-db';
    
    // Await params as required in Next.js 15
    const { name } = await params;
    
    // Get database configuration
    const dbConfig = getDatabaseById(databaseId);
    if (!dbConfig) {
      return NextResponse.json(
        { error: 'Invalid database configuration' },
        { status: 400 }
      );
    }
    
    // Connect directly to MongoDB
    client = new MongoClient(dbConfig.connectionString);
    await client.connect();
    
    // Parse database name from connection string
    const dbName = dbConfig.connectionString.split('/').pop()?.split('?')[0] || 'lodgetix';
    const db = client.db(dbName);
    const collection = db.collection(name);
    
    // Insert document
    const result = await collection.insertOne(document);
    
    return NextResponse.json({
      success: true,
      insertedId: result.insertedId,
      document: { ...document, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}