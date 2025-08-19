import { NextRequest, NextResponse } from 'next/server';
import { activeWorkflows } from '../../start/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = activeWorkflows.get(id);
    
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