import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentDate } = body;
    
    console.log('Generating invoice number for payment date:', paymentDate);
    
    try {
      // Connect to MongoDB
      const { db } = await connectMongoDB();
      const invoiceSequence = new InvoiceSequence(db);
      
      // Parse the payment date
      const date = paymentDate ? new Date(paymentDate) : new Date();
      console.log('Parsed date:', date);
      
      // Generate customer invoice number
      const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(date);
      console.log('Generated customer invoice number:', customerInvoiceNumber);
      
      // Generate supplier invoice number (same number, different prefix)
      const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
      console.log('Generated supplier invoice number:', supplierInvoiceNumber);
      
      return NextResponse.json({
        success: true,
        customerInvoiceNumber,
        supplierInvoiceNumber
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // If MongoDB fails, generate a temporary invoice number
      const date = paymentDate ? new Date(paymentDate) : new Date();
      const yy = date.getFullYear().toString().slice(-2);
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const dd = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 999) + 1;
      const paddedRandom = random.toString().padStart(3, '0');
      
      const customerInvoiceNumber = `LTIV-${yy}${mm}${dd}${paddedRandom}`;
      const supplierInvoiceNumber = `LTSP-${yy}${mm}${dd}${paddedRandom}`;
      
      console.log('Generated fallback invoice numbers:', { customerInvoiceNumber, supplierInvoiceNumber });
      
      return NextResponse.json({
        success: true,
        customerInvoiceNumber,
        supplierInvoiceNumber,
        fallback: true
      });
    }
    
  } catch (error) {
    console.error('Error generating invoice numbers:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to generate invoice numbers',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}