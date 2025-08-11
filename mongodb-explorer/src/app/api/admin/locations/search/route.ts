import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

let client: MongoClient | null = null;

async function getDatabase(): Promise<Db> {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db(DB_NAME);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    
    const database = await getDatabase();
    const locationsCollection = database.collection('locations');
    
    // Build search filter
    const filter = query 
      ? {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } },
            { address: { $regex: query, $options: 'i' } },
            { 'addressComponents.suburb': { $regex: query, $options: 'i' } },
            { 'addressComponents.city': { $regex: query, $options: 'i' } }
          ]
        }
      : {};
    
    // Find locations with limit
    const locations = await locationsCollection
      .find(filter)
      .limit(20)
      .toArray();
    
    // Transform to match frontend expectations
    const results = locations.map(loc => ({
      id: loc._id?.toString() || loc.id,
      name: loc.name,
      displayName: loc.displayName || loc.name,
      address: loc.address || '',
      addressComponents: loc.addressComponents || {},
      coordinates: loc.coordinates,
      type: loc.type || 'venue',
      capacity: loc.capacity,
      status: loc.status || 'active'
    }));
    
    return NextResponse.json({ 
      success: true,
      data: results 
    });
    
  } catch (error) {
    console.error('Error searching locations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search locations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      displayName, 
      address, 
      addressComponents = {},
      coordinates,
      type = 'venue',
      capacity
    } = body;
    
    if (!name || !address) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Location name and address are required' 
        },
        { status: 400 }
      );
    }
    
    const database = await getDatabase();
    const locationsCollection = database.collection('locations');
    
    // Check if location already exists at same address
    const existing = await locationsCollection.findOne({
      $and: [
        { name },
        { address }
      ]
    });
    
    if (existing) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Location already exists with this name and address' 
        },
        { status: 409 }
      );
    }
    
    // Parse address components if not provided
    const finalAddressComponents = Object.keys(addressComponents).length > 0 
      ? addressComponents 
      : parseAddressComponents(address);
    
    // Create location document
    const locationDoc = {
      name,
      displayName: displayName || name,
      address,
      addressComponents: finalAddressComponents,
      coordinates: coordinates || null,
      type,
      capacity: capacity || null,
      status: 'active',
      amenities: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert location
    const result = await locationsCollection.insertOne(locationDoc);
    
    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...locationDoc
      }
    });
    
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create location',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to parse address into components
function parseAddressComponents(address: string): Record<string, string> {
  const components: Record<string, string> = {};
  
  // Basic parsing - can be enhanced with proper address parsing library
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length > 0) {
    components.streetAddress = parts[0];
  }
  if (parts.length > 1) {
    components.suburb = parts[1];
  }
  if (parts.length > 2) {
    // Try to extract state and postcode from last part
    const lastPart = parts[parts.length - 1];
    const statePostcodeMatch = lastPart.match(/([A-Z]{2,3})\s*(\d{4})/);
    
    if (statePostcodeMatch) {
      components.state = statePostcodeMatch[1];
      components.postcode = statePostcodeMatch[2];
      components.city = parts[2].replace(/([A-Z]{2,3})\s*(\d{4})/, '').trim();
    } else {
      components.city = parts[2];
    }
  }
  
  components.country = 'South Africa'; // Default for ZA
  
  return components;
}