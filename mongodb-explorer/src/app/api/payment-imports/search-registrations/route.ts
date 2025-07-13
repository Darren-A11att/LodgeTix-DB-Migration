import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';

// Calculate match score based on ID-only criteria
function calculateMatchScore(registration: any, searchCriteria: any, matchedFields: string[]): number {
  // High-priority ID matches
  const hasPaymentIdMatch = searchCriteria.paymentId && (
    registration.stripePaymentIntentId === searchCriteria.paymentId ||
    registration.stripe_payment_intent_id === searchCriteria.paymentId ||
    registration.squarePaymentId === searchCriteria.paymentId ||
    registration.square_payment_id === searchCriteria.paymentId ||
    registration.registrationData?.paymentIntentId === searchCriteria.paymentId
  );

  const hasConfirmationMatch = matchedFields.includes('confirmationNumber');
  const hasRegistrationIdMatch = matchedFields.includes('registrationId');

  // Apply ID-only matching criteria - ONLY ID fields allowed
  if (hasPaymentIdMatch) {
    // Priority 1: Payment ID matches (highest confidence)
    if (registration.stripePaymentIntentId === searchCriteria.paymentId ||
        registration.stripe_payment_intent_id === searchCriteria.paymentId) {
      return 100;
    } else if (registration.registrationData?.paymentIntentId === searchCriteria.paymentId) {
      return 90;
    } else if (registration.squarePaymentId === searchCriteria.paymentId ||
               registration.square_payment_id === searchCriteria.paymentId) {
      return 85;
    }
  } else if (hasConfirmationMatch) {
    // Priority 2: Confirmation number match
    return 80;
  } else if (hasRegistrationIdMatch) {
    // Priority 3: Registration ID match
    return 85;
  }
  
  // NO other field matching allowed
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchCriteria } = body;
    
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Build MongoDB query
    const query: any = { $and: [] };
    const matchedFields: string[] = [];
    
    // Priority 1-3: Search by payment ID (highest priority)
    if (searchCriteria.paymentId) {
      query.$and.push({
        $or: [
          // Priority 1: stripePaymentIntentId
          { stripePaymentIntentId: searchCriteria.paymentId },
          { stripe_payment_intent_id: searchCriteria.paymentId },
          
          // Priority 2: registrationData.paymentIntentId
          { 'registrationData.paymentIntentId': searchCriteria.paymentId },
          { 'paymentInfo.stripe_payment_intent_id': searchCriteria.paymentId },
          { 'paymentData.transactionId': searchCriteria.paymentId },
          
          // Priority 3: squarePaymentId
          { squarePaymentId: searchCriteria.paymentId },
          { square_payment_id: searchCriteria.paymentId },
          { 'paymentInfo.square_payment_id': searchCriteria.paymentId },
          { 'paymentData.paymentId': searchCriteria.paymentId },
          
          // General payment fields
          { paymentId: searchCriteria.paymentId },
          { transactionId: searchCriteria.paymentId }
        ]
      });
      matchedFields.push('paymentId');
    }
    
    // Search by registration ID if provided
    if (searchCriteria.registrationId) {
      query.$and.push({
        $or: [
          { _id: searchCriteria.registrationId },
          { registrationId: searchCriteria.registrationId },
          { 'registrationData.registrationId': searchCriteria.registrationId }
        ]
      });
      matchedFields.push('registrationId');
    }
    
    // Search by confirmation number (camelCase and snake_case)
    if (searchCriteria.confirmationNumber) {
      query.$and.push({
        $or: [
          { confirmationNumber: searchCriteria.confirmationNumber },
          { confirmation_number: searchCriteria.confirmationNumber }
        ]
      });
      matchedFields.push('confirmationNumber');
    }
    
    // NO other field matching allowed - ID fields only
    
    // If no criteria provided, return empty results
    if (query.$and.length === 0) {
      return NextResponse.json({
        registrations: [],
        totalCount: 0,
        searchCriteria
      });
    }
    
    // Execute search
    const registrations = await db.collection('registrations')
      .find(query)
      .limit(50)
      .toArray();
    
    // Also search in registration_imports
    const registrationImports = await db.collection('registration_imports')
      .find(query)
      .limit(20)
      .toArray();
    
    // Transform results - handle both camelCase (registrations) and snake_case (registration_imports)
    const results = [...registrations, ...registrationImports].map(reg => ({
      registration: {
        id: reg._id,
        email: reg.email || reg.customerEmail || reg.registrationData?.bookingContact?.email,
        full_name: reg.primaryAttendee || reg.customerName || reg.full_name ||
                   `${reg.registrationData?.bookingContact?.firstName || reg.first_name || ''} ${reg.registrationData?.bookingContact?.lastName || reg.last_name || ''}`.trim(),
        first_name: reg.registrationData?.bookingContact?.firstName || reg.first_name,
        last_name: reg.registrationData?.bookingContact?.lastName || reg.last_name,
        confirmation_number: reg.confirmationNumber || reg.confirmation_number,
        total_amount: reg.totalAmount || reg.totalAmountPaid || reg.total_amount || reg.total_amount_paid || 0,
        registration_type: reg.registrationType || reg.registration_type,
        created_at: reg.createdAt || reg.importedAt || reg.created_at,
        payment_status: reg.paymentStatus || reg.payment_status,
        // Include payment IDs for debugging
        stripePaymentIntentId: reg.stripePaymentIntentId || reg.stripe_payment_intent_id,
        squarePaymentId: reg.squarePaymentId || reg.square_payment_id,
        _isPending: reg._id && registrationImports.some(p => p._id.equals(reg._id))
      },
      matchScore: calculateMatchScore(reg, searchCriteria, matchedFields),
      matchedFields
    }));
    
    // Sort by match score and filter out invalid matches (ID-only criteria)
    const sortedResults = results
      .filter(r => r.matchScore > 0) // Only exact ID matches
      .sort((a, b) => b.matchScore - a.matchScore);
    
    return NextResponse.json({
      registrations: sortedResults,
      totalCount: sortedResults.length,
      searchCriteria
    });
    
  } catch (error) {
    console.error('Error searching registrations:', error);
    return NextResponse.json(
      { error: 'Failed to search registrations' },
      { status: 500 }
    );
  }
}