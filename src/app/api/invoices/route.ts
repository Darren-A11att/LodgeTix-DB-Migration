import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    const apiUrl = `http://localhost:${apiPort}/api/invoices`;
    
    // Forward the request to the main API server
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error proxying invoice creation:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    const apiUrl = new URL(`http://localhost:${apiPort}/api/invoices`);
    
    // Forward query parameters
    searchParams.forEach((value, key) => {
      apiUrl.searchParams.append(key, value);
    });
    
    // Forward the request to the main API server
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}