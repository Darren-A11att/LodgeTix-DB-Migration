import { NextRequest, NextResponse } from 'next/server';
import { loadParentEnv } from '@/lib/load-parent-env';

// Load environment variables from the parent project BEFORE any other imports
loadParentEnv();

import { SquareClient, SquareEnvironment } from 'square';

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== Square API Test ===');
    
    // Check environment variables
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN || process.env._SQUARE_ACCESS_TOKEN;
    console.log('1. Environment Check:');
    console.log('   - SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
    console.log('   - _SQUARE_ACCESS_TOKEN exists:', !!process.env._SQUARE_ACCESS_TOKEN);
    console.log('   - Token exists:', !!squareAccessToken);
    console.log('   - Token length:', squareAccessToken?.length);
    console.log('   - Token prefix:', squareAccessToken?.substring(0, 4));
    
    if (!squareAccessToken) {
      return NextResponse.json({
        error: 'Square access token not found',
        details: {
          SQUARE_ACCESS_TOKEN: !!process.env.SQUARE_ACCESS_TOKEN,
          _SQUARE_ACCESS_TOKEN: !!process.env._SQUARE_ACCESS_TOKEN
        }
      }, { status: 500 });
    }
    
    // Determine environment
    const environment = squareAccessToken.startsWith('EAAA') ? 'production' : 'sandbox';
    console.log('   - Environment:', environment);
    
    // Create Square client
    console.log('\n2. Creating Square client...');
    const squareClient = new SquareClient({
      accessToken: squareAccessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    
    // Test API connection
    console.log('\n3. Testing Square API connection...');
    try {
      const locationsResponse = await squareClient.locations.list({
        limit: 1
      });
      
      console.log('   - API Response received');
      console.log('   - Response status:', locationsResponse.result ? 'success' : 'failed');
      
      if (locationsResponse.errors && locationsResponse.errors.length > 0) {
        console.error('   - API Errors:', locationsResponse.errors);
        return NextResponse.json({
          error: 'Square API returned errors',
          errors: locationsResponse.errors,
          tokenInfo: {
            exists: true,
            length: squareAccessToken.length,
            prefix: squareAccessToken.substring(0, 4),
            environment
          }
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'Square API connection successful',
        tokenInfo: {
          exists: true,
          length: squareAccessToken.length,
          prefix: squareAccessToken.substring(0, 4),
          environment
        },
        locations: locationsResponse.result?.locations?.length || 0
      });
      
    } catch (apiError) {
      console.error('   - API Error:', apiError);
      if (apiError instanceof Error) {
        console.error('   - Error message:', apiError.message);
        console.error('   - Error stack:', apiError.stack);
      }
      
      return NextResponse.json({
        error: 'Square API request failed',
        message: apiError instanceof Error ? apiError.message : 'Unknown error',
        tokenInfo: {
          exists: true,
          length: squareAccessToken.length,
          prefix: squareAccessToken.substring(0, 4),
          environment
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}