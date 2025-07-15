import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '10';
  const offset = searchParams.get('offset') || '0';
  const sortBy = searchParams.get('sortBy') || '';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  
  try {
    // Await params as required in Next.js 15
    const { name } = await params;
    
    // Get API port from environment
    const apiPort = process.env.API_PORT || '3006';
    
    // Proxy to backend API - Note: backend expects 'skip' not 'offset'
    const apiUrl = `http://localhost:${apiPort}/api/collections/${name}/documents?limit=${limit}&skip=${offset}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const document = await request.json();
    
    // Await params as required in Next.js 15
    const { name } = await params;
    
    // Get API port from environment
    const apiPort = process.env.API_PORT || '3006';
    
    // Proxy to backend API
    const apiUrl = `http://localhost:${apiPort}/api/collections/${name}/documents`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}