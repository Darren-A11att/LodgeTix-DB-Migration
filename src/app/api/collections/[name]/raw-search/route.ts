import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { search } = body;
    
    if (!search) {
      return NextResponse.json(
        { error: 'Search text is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectMongoDB();
    
    // Check if collection exists
    const collections = await db.listCollections({ name }).toArray();
    if (collections.length === 0) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    // Get all documents from collection
    const documents = await db.collection(name).find({}).toArray();
    
    const searchLower = search.toLowerCase();
    const matches = [];
    
    for (const doc of documents) {
      // Convert entire document to string and search
      const docString = JSON.stringify(doc).toLowerCase();
      
      if (docString.includes(searchLower)) {
        // Find which fields contain the search text
        const matchedFields: { field: string; value: any; snippet: string }[] = [];
        
        const searchInObject = (obj: any, path: string = '') => {
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              const currentPath = path ? `${path}.${key}` : key;
              
              if (value !== null && value !== undefined) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                  searchInObject(value, currentPath);
                } else if (Array.isArray(value)) {
                  value.forEach((item, index) => {
                    if (typeof item === 'object') {
                      searchInObject(item, `${currentPath}[${index}]`);
                    } else if (String(item).toLowerCase().includes(searchLower)) {
                      matchedFields.push({
                        field: `${currentPath}[${index}]`,
                        value: item,
                        snippet: String(item)
                      });
                    }
                  });
                } else {
                  const stringValue = String(value).toLowerCase();
                  if (stringValue.includes(searchLower)) {
                    matchedFields.push({
                      field: currentPath,
                      value: value,
                      snippet: String(value).substring(0, 100) + (String(value).length > 100 ? '...' : '')
                    });
                  }
                }
              }
            }
          }
        };
        
        searchInObject(doc);
        
        if (matchedFields.length > 0) {
          matches.push({
            document: doc,
            matchedFields
          });
        }
      }
    }
    
    return NextResponse.json({
      total: documents.length,
      matchCount: matches.length,
      matches
    });
    
  } catch (error) {
    console.error('Raw search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}