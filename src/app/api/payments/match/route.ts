import { NextRequest, NextResponse } from 'next/server';

interface MatchCriteria {
  paymentField: string;
  paymentValue: any;
  registrationField: string;
  registrationValue: any;
}

interface MatchRequest {
  paymentId: string;
  registrationId: string;
  matchCriteria: MatchCriteria[];
  matchedBy?: string;
  matchedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MatchRequest = await request.json();
    const { paymentId, registrationId, matchCriteria, matchedBy = 'manual', matchedAt = new Date().toISOString() } = body;

    if (!paymentId || !registrationId || !matchCriteria || matchCriteria.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, registrationId, and matchCriteria are required' },
        { status: 400 }
      );
    }

    const apiPort = process.env.API_PORT || '3006';
    
    // Since the API server doesn't have a payment update endpoint,
    // we'll store the match information in the registration only
    // and rely on the invoice creation process to link them

    // Update registration with matched payment
    const registrationUpdateUrl = `http://localhost:${apiPort}/api/registrations/${registrationId}`;
    const registrationUpdateData = {
      matchedPaymentId: paymentId,
      matchCriteria,
      matchedBy,
      matchedAt
    };

    const registrationResponse = await fetch(registrationUpdateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationUpdateData),
    });

    if (!registrationResponse.ok) {
      throw new Error(`Failed to update registration: ${registrationResponse.statusText}`);
    }

    // TODO: Store match criteria for future automated matching
    // This would require a new endpoint on the API server
    // const matchCriteriaUrl = `http://localhost:${apiPort}/api/match-criteria`;
    // await fetch(matchCriteriaUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     paymentId,
    //     registrationId,
    //     criteria: matchCriteria,
    //     createdBy: matchedBy,
    //     createdAt: matchedAt,
    //     successful: true
    //   }),
    // });

    return NextResponse.json({
      success: true,
      paymentId,
      registrationId,
      matchCriteria,
      message: 'Payment and registration successfully matched'
    });
    
  } catch (error) {
    console.error('Match error:', error);
    return NextResponse.json(
      { error: 'Failed to match payment and registration' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to unmatch payment and registration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const registrationId = searchParams.get('registrationId');

    if (!paymentId || !registrationId) {
      return NextResponse.json(
        { error: 'Missing required parameters: paymentId and registrationId' },
        { status: 400 }
      );
    }

    const apiPort = process.env.API_PORT || '3006';
    
    // Remove match from registration only (since we can't update payments directly)
    const registrationUpdateUrl = `http://localhost:${apiPort}/api/registrations/${registrationId}`;
    const registrationResponse = await fetch(registrationUpdateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchedPaymentId: null,
        matchCriteria: null,
        matchedBy: null,
        matchedAt: null
      }),
    });

    if (!registrationResponse.ok) {
      throw new Error(`Failed to update registration: ${registrationResponse.statusText}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Registration match information successfully removed'
    });
    
  } catch (error) {
    console.error('Unmatch error:', error);
    return NextResponse.json(
      { error: 'Failed to unmatch payment and registration' },
      { status: 500 }
    );
  }
}