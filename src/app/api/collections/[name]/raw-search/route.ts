import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { searchText, limit = 50 } = await request.json();
    
    if (!searchText || searchText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search text is required' },
        { status: 400 }
      );
    }

    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    const collection = params.name;
    
    // First, get all documents from the collection (with a reasonable limit)
    const docsUrl = `http://localhost:${apiPort}/api/collections/${collection}/documents?limit=1000`;
    const docsResponse = await fetch(docsUrl);
    
    if (!docsResponse.ok) {
      throw new Error(`Failed to fetch documents: ${docsResponse.statusText}`);
    }
    
    const docsData = await docsResponse.json();
    const documents = docsData.documents || [];
    
    // Perform raw text search on all documents
    const searchLower = searchText.toLowerCase();
    const matches = [];
    
    for (const doc of documents) {
      // Convert entire document to string and search
      const docString = JSON.stringify(doc).toLowerCase();
      
      if (docString.includes(searchLower)) {
        // Find which fields contain the search text
        const matchedFields = [];
        
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
        
        matches.push({
          document: doc,
          matchedFields,
          score: matchedFields.length
        });
      }
    }
    
    // Sort by score (number of matching fields)
    matches.sort((a, b) => b.score - a.score);
    
    // Limit results
    const limitedMatches = matches.slice(0, limit);
    
    return NextResponse.json({
      documents: limitedMatches.map(m => m.document),
      matches: limitedMatches,
      total: matches.length,
      limit,
      skip: 0,
      collection,
      searchText
    });
    
  } catch (error) {
    console.error('Raw search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform raw text search' },
      { status: 500 }
    );
  }
}