import { NextRequest, NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';

export async function GET(request: NextRequest) {
  try {
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN || process.env._SQUARE_ACCESS_TOKEN;
    
    if (!squareAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'Square access token not configured',
        checkedVars: ['SQUARE_ACCESS_TOKEN', '_SQUARE_ACCESS_TOKEN']
      }, { status: 500 });
    }
    
    // Determine environment
    const environment = squareAccessToken.startsWith('EAAA') ? 'production' : 'sandbox';
    
    // Create Square client
    const squareClient = new SquareClient({
      accessToken: squareAccessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    
    // Test the connection by fetching locations
    try {
      const locationsResponse = await squareClient.locations.list();
      
      return NextResponse.json({
        success: true,
        environment,
        tokenPrefix: squareAccessToken.substring(0, 4),
        locations: locationsResponse.result?.locations?.map(loc => ({
          id: loc.id,
          name: loc.name,
          status: loc.status
        })) || [],
        locationsCount: locationsResponse.result?.locations?.length || 0
      });
    } catch (apiError: any) {
      console.error('Square API Error:', apiError);
      
      // Extract error details
      const errorDetails = {
        message: apiError.message || 'Unknown error',
        statusCode: apiError.statusCode,
        errors: apiError.errors || [],
        body: apiError.body
      };
      
      return NextResponse.json({
        success: false,
        environment,
        tokenPrefix: squareAccessToken.substring(0, 4),
        error: 'Square API call failed',
        details: errorDetails
      }, { status: apiError.statusCode || 500 });
    }
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}