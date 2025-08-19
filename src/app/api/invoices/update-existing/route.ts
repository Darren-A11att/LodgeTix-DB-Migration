import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, registrationId, customerInvoice, supplierInvoice } = body;
    
    if (!paymentId || !registrationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    
    // Update payment document
    const paymentUpdate = await db.collection('payments').updateOne(
      { _id: paymentId },
      { 
        $set: { 
          customerInvoice: customerInvoice,
          supplierInvoice: supplierInvoice
        }
      }
    );
    
    // Update registration document
    const registrationUpdate = await db.collection('registrations').updateOne(
      { _id: registrationId },
      { 
        $set: { 
          customerInvoice: customerInvoice,
          supplierInvoice: supplierInvoice
        }
      }
    );
    
    return NextResponse.json({
      success: true,
      paymentModified: paymentUpdate.modifiedCount,
      registrationModified: registrationUpdate.modifiedCount
    });
    
  } catch (error) {
    console.error('Error updating documents:', error);
    return NextResponse.json(
      { error: 'Failed to update documents' },
      { status: 500 }
    );
  }
}