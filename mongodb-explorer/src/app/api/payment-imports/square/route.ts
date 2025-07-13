import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { SquarePaymentImportServiceV2 } from '../../../../../src/services/square-payment-import-v2';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    console.log('Square import API called');
    
    // Load parent .env.local directly in the route handler
    console.log('Current working directory:', process.cwd());
    const parentEnvPath = path.join(process.cwd(), '..', '.env.local');
    console.log('Looking for parent .env.local at:', parentEnvPath);
    
    if (fs.existsSync(parentEnvPath)) {
      console.log('Parent .env.local found, loading...');
      const result = dotenv.config({ path: parentEnvPath });
      if (result.error) {
        console.error('Error loading parent .env.local:', result.error);
      } else {
        console.log('Parent .env.local loaded successfully');
      }
    }
    
    const { db } = await connectMongoDB();
    const body = await request.json();
    console.log('Request body:', body);
    
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN || process.env._SQUARE_ACCESS_TOKEN;
    console.log('Square access token exists:', !!squareAccessToken);
    console.log('Token first 4 chars:', squareAccessToken?.substring(0, 4));
    
    if (!squareAccessToken) {
      console.error('Square access token not found in environment variables');
      console.error('Checked: SQUARE_ACCESS_TOKEN and _SQUARE_ACCESS_TOKEN');
      return NextResponse.json(
        { error: 'Square access token not configured. Please set SQUARE_ACCESS_TOKEN in mongodb-explorer/.env.local' },
        { status: 500 }
      );
    }
    
    const { startDate, endDate, locationIds } = body;
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    // Determine environment based on token prefix
    const environment = squareAccessToken.startsWith('EAAA') ? 'production' : 'sandbox';
    console.log('Square environment detected:', environment);
    
    const importService = new SquarePaymentImportServiceV2(db, squareAccessToken, environment);
    
    const batch = await importService.importPayments({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      locationIds,
      importedBy: 'api'
    });
    
    return NextResponse.json({
      batchId: batch.batchId,
      imported: batch.importedPayments,
      skipped: batch.skippedPayments,
      failed: batch.failedPayments,
      total: batch.totalPayments,
      status: batch.status,
      error: batch.error
    });
  } catch (error) {
    console.error('Error importing from Square:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name
    });
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('UNAUTHORIZED') || error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Square authentication failed. Please check your access token.' },
          { status: 401 }
        );
      }
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'Failed to connect to Square API. Please check your network connection.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}