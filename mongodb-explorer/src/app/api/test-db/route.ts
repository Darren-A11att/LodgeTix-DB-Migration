import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { client, db } = await connectMongoDB();
    
    // Get database name
    const dbName = db.databaseName;
    
    // Count documents in key collections
    const paymentCount = await db.collection('payments').countDocuments();
    const registrationCount = await db.collection('registrations').countDocuments();
    const invoiceCount = await db.collection('invoices').countDocuments();
    const transactionCount = await db.collection('transactions').countDocuments();
    
    return NextResponse.json({
      success: true,
      database: dbName,
      environment: {
        MONGODB_DB: process.env.MONGODB_DB,
        MONGODB_DATABASE: process.env.MONGODB_DATABASE,
        NODE_ENV: process.env.NODE_ENV
      },
      collections: {
        payments: paymentCount,
        registrations: registrationCount,
        invoices: invoiceCount,
        transactions: transactionCount
      }
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}