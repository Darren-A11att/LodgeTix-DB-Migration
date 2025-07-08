import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    // Await params as required in Next.js 15
    const { name: collection, id } = await params;
    
    // Validate collection name to prevent injection
    const allowedCollections = ['eventTickets', 'products', 'attendees', 'organisations', 'functions'];
    if (!allowedCollections.includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection' },
        { status: 400 }
      );
    }
    
    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    
    // Try to get document from backend API
    const response = await fetch(`http://localhost:${apiPort}/api/collections/${collection}/documents/${id}`);
    
    if (!response.ok) {
      // Try alternative ID field searches
      const searchResponse = await fetch(`http://localhost:${apiPort}/api/collections/${collection}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            $or: [
              { id: id },
              { eventTicketId: id },
              { ticketId: id },
              { _id: id }
            ]
          }
        }),
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.documents && searchData.documents.length > 0) {
          return NextResponse.json({ 
            data: searchData.documents[0],
            success: true 
          });
        }
      }
      
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({ 
      data,
      success: true 
    });
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup document' },
      { status: 500 }
    );
  }
}