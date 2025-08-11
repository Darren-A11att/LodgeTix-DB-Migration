import { NextRequest, NextResponse } from 'next/server';
import { DATABASE_CONFIGS, getDatabaseById } from '@/lib/database-selector';

export async function GET() {
  try {
    return NextResponse.json({
      databases: DATABASE_CONFIGS,
      success: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch database configurations', success: false },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { databaseId } = await request.json();
    
    if (!databaseId) {
      return NextResponse.json(
        { error: 'Database ID is required', success: false },
        { status: 400 }
      );
    }
    
    const database = getDatabaseById(databaseId);
    if (!database) {
      return NextResponse.json(
        { error: 'Database not found', success: false },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      database,
      success: true
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to select database', success: false },
      { status: 500 }
    );
  }
}