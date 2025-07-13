import * as dotenv from 'dotenv';
import { SquareClient, SquareEnvironment } from 'square';
import * as https from 'https';

dotenv.config({ path: '.env.local' });

interface SquareLocation {
  id: string;
  name: string;
  address?: {
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    administrativeDistrictLevel1?: string;
    postalCode?: string;
    country?: string;
  };
  timezone?: string;
  capabilities?: string[];
  status?: string;
  createdAt?: string;
  merchantId?: string;
  country?: string;
  languageCode?: string;
  currency?: string;
  phoneNumber?: string;
  businessName?: string;
  type?: string;
  websiteUrl?: string;
  businessHours?: any;
  businessEmail?: string;
  description?: string;
  twitterUsername?: string;
  instagramUsername?: string;
  facebookUrl?: string;
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  logoUrl?: string;
  posSquareLogoUrl?: string;
  mcc?: string;
  fullFormatLogoUrl?: string;
  taxIds?: any;
}

interface SquareLocationResponse {
  locations?: SquareLocation[];
}

interface SquareApiResponse {
  result?: SquareLocationResponse;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
    field?: string;
  }>;
}

async function debugSquare(): Promise<void> {
  const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Token exists:', !!token);
  console.log('Token prefix:', token?.substring(0, 4));
  console.log('Token length:', token?.length);
  
  if (!token) {
    console.error('No Square access token found');
    return;
  }
  
  // First, test with direct HTTPS (we know this works)
  console.log('\n--- Testing with direct HTTPS ---');
  await new Promise<void>((resolve) => {
    const options = {
      hostname: 'connect.squareup.com',
      path: '/v2/locations',
      method: 'GET',
      headers: {
        'Square-Version': '2025-06-18',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data: string = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response: SquareLocationResponse = JSON.parse(data);
          console.log('✓ Direct HTTPS works!');
          console.log('Locations found:', response.locations?.length || 0);
          if (response.locations) {
            response.locations.forEach((loc: SquareLocation) => {
              console.log(`- ${loc.name} (${loc.id})`);
            });
          }
        } else {
          console.log('✗ Direct HTTPS failed:', res.statusCode);
        }
        resolve();
      });
    });
    
    req.on('error', (error: Error) => {
      console.error('Request error:', error);
      resolve();
    });
    
    req.end();
  });
  
  // Now test with SDK
  console.log('\n--- Testing with Square SDK ---');
  const client: SquareClient = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    const response: SquareApiResponse = await client.locations.list();
    console.log('✓ SDK request completed');
    console.log('Response structure:', {
      hasResult: !!response.result,
      hasLocations: !!response.result?.locations,
      locationsCount: response.result?.locations?.length || 0,
      hasErrors: !!response.errors,
      errorsCount: response.errors?.length || 0
    });
    
    if (response.errors && response.errors.length > 0) {
      console.log('Errors:', response.errors);
    }
    
    if (response.result?.locations) {
      console.log('Locations found:', response.result.locations.length);
      response.result.locations.forEach((loc: SquareLocation) => {
        console.log(`- ${loc.name} (${loc.id})`);
      });
    } else {
      console.log('No locations in response');
    }
    
    // Try to get more details
    console.log('\n--- Raw response ---');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error: any) {
    console.log('✗ SDK request failed:', error.message);
    console.error('Error details:', error);
  }
}

debugSquare();