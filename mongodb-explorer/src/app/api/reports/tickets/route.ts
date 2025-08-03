import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    console.log('Fetching tickets report data...');
    
    // Get all tickets
    const ticketsCollection = db.collection('tickets');
    const tickets = await ticketsCollection.find({}).toArray();
    
    console.log(`Found ${tickets.length} tickets`);
    
    // Get related collections
    const attendeesCollection = db.collection('attendees');
    const lodgesCollection = db.collection('lodges');
    const customersCollection = db.collection('customers');
    const paymentsCollection = db.collection('payments');
    const registrationsCollection = db.collection('registrations');
    
    // Process each ticket
    const processedTickets = await Promise.all(tickets.map(async (ticket) => {
      let ownerName = '';
      
      // Look up owner based on type
      if (ticket.ownerType === 'attendee' && ticket.ownerId) {
        const attendee = await attendeesCollection.findOne({ attendeeId: ticket.ownerId });
        if (attendee) {
          ownerName = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim();
        } else {
          // Fallback: check customers collection
          const customer = await customersCollection.findOne({ attendeeId: ticket.ownerId });
          if (customer) {
            ownerName = customer.name || '';
          }
        }
      } else if (ticket.ownerType === 'lodge' && ticket.ownerId) {
        const lodge = await lodgesCollection.findOne({ lodgeId: ticket.ownerId });
        if (lodge) {
          ownerName = lodge.name || '';
        }
      }
      
      // Look up payment status
      let paymentStatus = 'unknown';
      if (ticket.details?.paymentId) {
        const payment = await paymentsCollection.findOne({ paymentId: ticket.details.paymentId });
        if (payment) {
          paymentStatus = payment.status || 'unknown';
        }
      }
      
      // Look up registration for confirmation and invoice
      let confirmationNumber = '';
      let invoiceNumber = '';
      if (ticket.registrationId) {
        const registration = await registrationsCollection.findOne({ registrationId: ticket.registrationId });
        if (registration) {
          confirmationNumber = registration.confirmationNumber || '';
          invoiceNumber = registration.invoiceNumber || '';
        }
      }
      
      return {
        ticketNumber: ticket._id?.toString() || '',
        name: ticket.name || '',
        quantity: ticket.quantity || 1,
        price: ticket.price || 0,
        ownerType: ticket.ownerType || '',
        ownerName: ownerName,
        ownerId: ticket.ownerId || '',
        attendeeType: ticket.attendeeType || '',
        partnerOfName: ticket.partnerOfName || '',
        lodgeNameNumber: ticket.lodgeNameNumber || '',
        confirmationNumber: confirmationNumber,
        invoiceNumber: invoiceNumber,
        paymentStatus: paymentStatus,
        registrationId: ticket.registrationId || '',
        registrationDate: ticket.createdAt || ''
      };
    }));
    
    // Calculate summary
    const summary = {
      totalTickets: processedTickets.reduce((sum, t) => sum + (t.quantity || 0), 0),
      lodgeTickets: processedTickets.filter(t => t.ownerType === 'lodge').reduce((sum, t) => sum + (t.quantity || 0), 0),
      individualTickets: processedTickets.filter(t => t.ownerType === 'attendee').reduce((sum, t) => sum + (t.quantity || 0), 0),
      totalValue: processedTickets.reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 0)), 0)
    };
    
    const format = request.nextUrl.searchParams.get('format');
    
    if (format === 'csv') {
      // CSV export
      const headers = ['Ticket Number', 'Name', 'Quantity', 'Price', 'Owner Type', 'Owner Name', 'Attendee Type', 'Partner Of', 'Lodge Name/Number', 'Confirmation Number', 'Invoice Number', 'Payment Status'];
      const csvContent = [
        headers.join(','),
        ...processedTickets.map(t => [
          t.ticketNumber || '',
          `"${(t.name || '').replace(/"/g, '""')}"`,
          t.quantity,
          t.price || 0,
          t.ownerType || '',
          `"${(t.ownerName || '').replace(/"/g, '""')}"`,
          t.attendeeType || '',
          `"${(t.partnerOfName || '').replace(/"/g, '""')}"`,
          `"${(t.lodgeNameNumber || '').replace(/"/g, '""')}"`,
          t.confirmationNumber || '',
          t.invoiceNumber || '',
          t.paymentStatus || ''
        ].join(','))
      ].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tickets-report.csv"'
        }
      });
    }
    
    return NextResponse.json({
      tickets: processedTickets,
      total: processedTickets.length,
      summary
    });
    
  } catch (error) {
    console.error('Error generating tickets report:', error);
    return NextResponse.json({ error: 'Failed to generate tickets report' }, { status: 500 });
  }
}