import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { PaymentRegistrationMatcher } from '@/services/payment-registration-matcher';
import { InvoicePreviewGenerator } from '@/services/invoice-preview-generator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const minConfidence = parseInt(searchParams.get('minConfidence') || '0');

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    
    // Initialize services
    const matcher = new PaymentRegistrationMatcher(db);
    const previewGenerator = new InvoicePreviewGenerator(db);

    // Get all unprocessed payments
    const unprocessedPayments = await db.collection('payments')
      .find({ 
        $or: [
          { invoiceCreated: { $ne: true } },
          { invoiceCreated: { $exists: false } }
        ]
      })
      .toArray();
    
    // Match each payment
    const matchResults = await matcher.matchPayments(unprocessedPayments as any);

    // Filter by confidence
    const filteredResults = matchResults.filter(
      result => result.matchConfidence >= minConfidence
    );

    // Sort by payment date (oldest first) to ensure proper invoice numbering
    filteredResults.sort((a, b) => {
      const dateA = new Date(a.payment.timestamp).getTime();
      const dateB = new Date(b.payment.timestamp).getTime();
      return dateA - dateB; // Oldest first
    });

    // Apply pagination
    const paginatedResults = filteredResults.slice(offset, offset + limit);

    // Generate previews
    const previews = await previewGenerator.generatePreviews(paginatedResults);

    // Calculate statistics
    const stats = {
      totalPayments: unprocessedPayments.length,
      matchedPayments: matchResults.filter(r => r.registration !== null).length,
      unmatchedPayments: matchResults.filter(r => r.registration === null).length,
      highConfidence: matchResults.filter(r => r.matchConfidence >= 80).length,
      mediumConfidence: matchResults.filter(r => r.matchConfidence >= 50 && r.matchConfidence < 80).length,
      lowConfidence: matchResults.filter(r => r.matchConfidence > 0 && r.matchConfidence < 50).length
    };

    return NextResponse.json({
      success: true,
      data: {
        previews,
        pagination: {
          total: filteredResults.length,
          limit,
          offset,
          hasMore: offset + limit < filteredResults.length
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}