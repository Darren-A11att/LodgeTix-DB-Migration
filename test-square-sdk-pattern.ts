import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Test both patterns
console.log('Testing Square SDK patterns...\n');

const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
console.log('Token exists:', !!token);
console.log('Token prefix:', token?.substring(0, 4));
console.log('Token length:', token?.length);

interface SquareLocation {
  id: string;
  name: string;
}

interface LocationsResponse {
  result?: {
    locations?: SquareLocation[];
  };
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

// Pattern 1: Using destructured imports (current code)
console.log('\n--- Pattern 1: Using SquareClient ---');

(async (): Promise<void> => {
  try {
    const { SquareClient, SquareEnvironment } = await import('square');
    
    if (!token) {
      console.log('✗ No token available');
      return;
    }
    
    const client1 = new SquareClient({
      token: token,
      environment: SquareEnvironment.Production
    });
    
    try {
      const response: LocationsResponse = await client1.locations.list();
      console.log('✓ SquareClient pattern works!');
      console.log('Locations found:', response.result?.locations?.length || 0);
      if (response.result?.locations) {
        response.result.locations.forEach((loc: SquareLocation) => {
          console.log(`- ${loc.name} (${loc.id})`);
        });
      }
    } catch (error: any) {
      console.log('✗ SquareClient pattern failed:', error.message);
    }
  } catch (error: any) {
    console.log('✗ SquareClient instantiation failed:', error.message);
  }
})();

// Pattern 2: Using legacy Client class (deprecated)
console.log('\n--- Pattern 2: Using legacy Client (deprecated) ---');
console.log('Skipping deprecated Client class pattern');