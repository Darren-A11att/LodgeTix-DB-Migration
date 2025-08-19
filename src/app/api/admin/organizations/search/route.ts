import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';
const COMMERCE_DB_NAME = process.env.MONGODB_COMMERCE_DB || 'lodgetix_commerce';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

let client: MongoClient | null = null;

async function getDatabase(): Promise<{ lodgetixDb: Db; commerceDb: Db }> {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return {
    lodgetixDb: client.db(DB_NAME),
    commerceDb: client.db(COMMERCE_DB_NAME)
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    
    const { lodgetixDb } = await getDatabase();
    const organizationsCollection = lodgetixDb.collection('organisations');
    
    // Build search filter
    const filter = query 
      ? {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } },
            { subdomain: { $regex: query, $options: 'i' } }
          ]
        }
      : {};
    
    // Find organizations with limit
    const organizations = await organizationsCollection
      .find(filter)
      .limit(20)
      .toArray();
    
    // Transform to match frontend expectations
    const results = organizations.map(org => ({
      id: org._id?.toString() || org.id,
      name: org.name,
      displayName: org.displayName || org.name,
      subdomain: org.subdomain,
      type: org.type || 'organisation',
      status: org.status || 'active',
      // Include additional fields from the organisation
      legalEntityName: org.legalEntityName || org.name,
      businessNumber: org.businessNumber || '',
      address: org.address || '',
      website: org.website || ''
    }));
    
    return NextResponse.json({ 
      success: true,
      data: results 
    });
    
  } catch (error) {
    console.error('Error searching organizations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search organizations',
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
      subdomain,
      legalEntityName,
      businessNumber,
      address,
      website,
      email
    } = body;
    
    if (!name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Organization name is required' 
        },
        { status: 400 }
      );
    }
    
    const { lodgetixDb, commerceDb } = await getDatabase();
    const organizationsCollection = lodgetixDb.collection('organisations');
    const suppliersCollection = commerceDb.collection('suppliers');
    
    // Check if organization already exists (case-insensitive)
    const normalizedName = name.trim();
    const normalizedSubdomain = subdomain || normalizedName.toLowerCase().replace(/\s+/g, '-');
    
    const existing = await organizationsCollection.findOne({
      $or: [
        { name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { subdomain: normalizedSubdomain }
      ]
    });
    
    if (existing) {
      console.log('Organization already exists:', {
        searchedName: normalizedName,
        searchedSubdomain: normalizedSubdomain,
        foundName: existing.name,
        foundSubdomain: existing.subdomain,
        foundId: existing._id
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: `Organization "${existing.name}" already exists`,
          existing: {
            id: existing._id?.toString(),
            name: existing.name,
            subdomain: existing.subdomain
          }
        },
        { status: 409 }
      );
    }
    
    // Create organization document
    const organizationDoc = {
      name,
      displayName: displayName || name,
      subdomain: subdomain || name.toLowerCase().replace(/\s+/g, '-'),
      type: 'organisation',
      status: 'active',
      legalEntityName: legalEntityName || name,
      businessNumber: businessNumber || '',
      address: address || '',
      website: website || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        currency: 'AUD',
        timezone: 'Africa/Johannesburg'
      }
    };
    
    // Insert organization
    const orgResult = await organizationsCollection.insertOne(organizationDoc);
    
    // Always create supplier record for invoicing
    const supplierDoc = {
      organizationId: orgResult.insertedId,
      name: legalEntityName || name,
      displayName: displayName || name,
      status: 'active',
      type: 'vendor',
      legalEntityName: legalEntityName || name,
      businessNumber: businessNumber || '',
      address: address || '',
      website: website || '',
      contactInfo: {
        email: email || '',
        phone: ''
      },
      invoicing: {
        billTo: {
          name: legalEntityName || name,
          address: address || '',
          businessNumber: businessNumber || ''
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const supplierResult = await suppliersCollection.insertOne(supplierDoc);
    
    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: orgResult.insertedId.toString(),
          ...organizationDoc
        },
        supplier: {
          id: supplierResult.insertedId.toString(),
          ...supplierDoc
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}