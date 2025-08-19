import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import UnifiedInvoiceService from '@/services/unified-invoice-service';

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;

  try {
    const body = await request.json();
    const { paymentId, options = {} } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const uri = process.env.MONGODB_URI!;
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
    
    // Initialize invoice service
    const invoiceService = new UnifiedInvoiceService(db);
    
    // Generate invoice with specified options
    const result = await invoiceService.generateInvoice({
      paymentId,
      uploadToSupabase: options.uploadToSupabase !== false, // Default true
      sendEmail: options.sendEmail === true, // Default false (only send if explicitly requested)
      regenerate: options.regenerate || false,
      // Don't save to file system in API calls
      saveToFile: false,
      downloadInBrowser: false
    });

    if (result.success) {
      // Convert buffer to base64 for response
      const response: any = {
        success: true,
        invoiceNumber: result.invoiceNumber,
        url: result.url
      };

      // Include PDF data if requested
      if (options.includePdf && result.pdfBuffer) {
        response.pdfBase64 = result.pdfBuffer.toString('base64');
      }

      return NextResponse.json(response);
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to generate invoice' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Batch processing endpoint
export async function PUT(request: NextRequest) {
  let client: MongoClient | null = null;

  try {
    const body = await request.json();
    const { dateFrom, dateTo, limit, regenerate } = body;

    // Connect to MongoDB
    const uri = process.env.MONGODB_URI!;
    client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
    
    // Initialize invoice service
    const invoiceService = new UnifiedInvoiceService(db);
    
    // Batch process invoices
    const result = await invoiceService.batchProcessInvoices({
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit || 100,
      regenerate: regenerate || false
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Batch invoice processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}