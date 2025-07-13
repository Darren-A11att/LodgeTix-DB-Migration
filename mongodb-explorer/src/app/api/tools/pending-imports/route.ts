import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';

export async function GET(request: NextRequest) {
  try {
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Get all pending imports
    const imports = await db.collection('pending-imports')
      .find()
      .sort({ pendingSince: 1 })
      .toArray();
    
    // Calculate statistics
    const stats = {
      total: imports.length,
      noPaymentId: imports.filter(i => !i.squarePaymentId && !i.stripePaymentIntentId).length,
      withPaymentId: imports.filter(i => i.squarePaymentId || i.stripePaymentIntentId).length,
      previouslyFailed: imports.filter(i => i.previouslyFailed).length,
      avgDaysPending: 0
    };
    
    if (imports.length > 0) {
      const totalDays = imports.reduce((sum, imp) => {
        const days = Math.floor((Date.now() - new Date(imp.pendingSince).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      stats.avgDaysPending = totalDays / imports.length;
    }
    
    return NextResponse.json({ imports, stats });
    
  } catch (error: any) {
    console.error('Pending imports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending imports', details: error.message },
      { status: 500 }
    );
  }
}