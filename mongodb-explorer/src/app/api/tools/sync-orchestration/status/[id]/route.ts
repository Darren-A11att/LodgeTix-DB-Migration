import { NextRequest, NextResponse } from 'next/server';
import { activeWorkflows } from '../../start/route';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = activeWorkflows.get(params.id);
    
    if (!run) {
      return NextResponse.json(
        { error: 'Workflow run not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ run });
    
  } catch (error: any) {
    console.error('Get workflow status error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow status', details: error.message },
      { status: 500 }
    );
  }
}