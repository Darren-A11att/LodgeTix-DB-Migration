import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { generateConfirmationNumber, isValidConfirmationNumber } from '@/utils/confirmation-number';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params as required in Next.js 15
    const { id } = await params;
    const body = await request.json();
    const { confirmationNumber, registrationType } = body;
    
    const { db } = await connectMongoDB();
    
    // First, get the registration to check current state
    const registration = await db.collection('registrations').findOne({ _id: new ObjectId(id) });
    
    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }
    
    // If registration already has a confirmation number, don't overwrite
    if (registration.confirmationNumber) {
      return NextResponse.json(
        { 
          message: 'Registration already has a confirmation number',
          confirmationNumber: registration.confirmationNumber 
        },
        { status: 200 }
      );
    }
    
    // Generate or validate confirmation number
    let finalConfirmationNumber = confirmationNumber;
    
    if (!finalConfirmationNumber) {
      // Generate new confirmation number based on registration type
      const type = registrationType || registration.registrationType || 'registration';
      finalConfirmationNumber = generateConfirmationNumber(type);
    } else if (!isValidConfirmationNumber(finalConfirmationNumber)) {
      return NextResponse.json(
        { error: 'Invalid confirmation number format' },
        { status: 400 }
      );
    }
    
    // Update the registration with the confirmation number
    const result = await db.collection('registrations').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          confirmationNumber: finalConfirmationNumber,
          confirmationGeneratedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      confirmationNumber: finalConfirmationNumber,
      message: 'Confirmation number generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating confirmation number:', error);
    return NextResponse.json(
      { error: 'Failed to generate confirmation number' },
      { status: 500 }
    );
  }
}