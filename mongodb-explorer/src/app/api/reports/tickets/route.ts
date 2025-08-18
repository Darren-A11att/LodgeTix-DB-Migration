import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const databaseParam = request.nextUrl.searchParams.get('database');
    const { db } = await connectToDatabase(databaseParam || undefined);
    
    console.log('Fetching tickets report data from database:', databaseParam || 'default');
    
    // Get all tickets
    const ticketsCollection = db.collection('tickets');
    const tickets = await ticketsCollection.find({}).toArray();
    
    console.log(`Found ${tickets.length} tickets`);
    
    // Log sample ticket structure
    if (tickets.length > 0) {
      console.log('Sample ticket structure:', {
        ownerType: tickets[0].ownerType,
        ownerId: tickets[0].ownerId,
        registrationId: tickets[0].registrationId,
        price: tickets[0].price,
        eventName: tickets[0].eventName,
        name: tickets[0].name
      });
    }
    
    // Get related collections
    const attendeesCollection = db.collection('attendees');
    const lodgesCollection = db.collection('lodges');
    const customersCollection = db.collection('customers');
    const paymentsCollection = db.collection('payments');
    const registrationsCollection = db.collection('registrations');
    const grandLodgesCollection = db.collection('grandLodges');
    
    // Process each ticket
    const processedTickets = await Promise.all(tickets.map(async (ticket) => {
      let ownerName = '';
      let attendeeType = '';
      let lodgeNameNumber = '';
      let partnerOfName = '';
      
      // Look up owner based on type using correct ID field matching
      // Handle both 'attendee' and 'individual' as attendee types
      if ((ticket.ownerType === 'attendee' || ticket.ownerType === 'individual') && ticket.ownerId) {
        // For attendee/individual type, match ownerId against attendeeId field
        const attendee = await attendeesCollection.findOne({ attendeeId: ticket.ownerId });
        
        // Debug logging
        if (!attendee) {
          console.log(`No attendee found for attendeeId: ${ticket.ownerId}`);
        }
        if (attendee) {
          // Format owner name based on attendee type
          if (attendee.attendeeType === 'mason') {
            if (attendee.rank === 'GL') {
              // Mason with GL rank: title firstName lastName suffix
              ownerName = `${attendee.title || ''} ${attendee.firstName || ''} ${attendee.lastName || ''} ${attendee.suffix || ''}`.trim();
            } else {
              // Mason non-GL: title firstName lastName rank
              ownerName = `${attendee.title || ''} ${attendee.firstName || ''} ${attendee.lastName || ''} ${attendee.rank || ''}`.trim();
            }
          } else if (attendee.attendeeType === 'guest') {
            // Guest: title firstName lastName suffix
            ownerName = `${attendee.title || ''} ${attendee.firstName || ''} ${attendee.lastName || ''} ${attendee.suffix || ''}`.trim();
          } else {
            // Default format
            ownerName = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim();
          }
          
          // Get attendee type from attendee document
          attendeeType = attendee.attendeeType || '';
          
          // Get lodge name and number from attendee
          let partnerAttendee = null;
          
          // Look up partner information
          // First check 'partner' field, then fall back to 'partnerOf' field
          let partnerAttendeeId = null;
          if (attendee.partner) {
            // Use partner field if it exists
            partnerAttendeeId = attendee.partner;
          } else if (attendee.partnerOf) {
            // Fall back to partnerOf field if partner is null
            partnerAttendeeId = attendee.partnerOf;
          }
          
          if (partnerAttendeeId) {
            // The partner/partnerOf fields contain the original Supabase IDs
            // So we need to look up by originalAttendeeId, not attendeeId
            partnerAttendee = await attendeesCollection.findOne({ originalAttendeeId: partnerAttendeeId });
            if (partnerAttendee) {
              // Format partner name: title firstName lastName suffix
              partnerOfName = `${partnerAttendee.title || ''} ${partnerAttendee.firstName || ''} ${partnerAttendee.lastName || ''} ${partnerAttendee.suffix || ''}`.trim();
            }
          }
          
          // Set lodge name/number based on attendee type
          if (attendee.attendeeType === 'guest' && partnerAttendee && partnerAttendee.attendeeType === 'mason') {
            // For guests with mason partners, use partner's lodge info
            if (partnerAttendee.membership?.name || partnerAttendee.constitution?.abbreviation) {
              const parts = [];
              if (partnerAttendee.membership?.name) parts.push(partnerAttendee.membership.name);
              if (partnerAttendee.constitution?.abbreviation) parts.push(partnerAttendee.constitution.abbreviation);
              lodgeNameNumber = parts.join(' | ');
            }
          } else {
            // For all others, use their own membership info
            if (attendee.membership?.name || attendee.constitution?.abbreviation) {
              const parts = [];
              if (attendee.membership?.name) parts.push(attendee.membership.name);
              if (attendee.constitution?.abbreviation) parts.push(attendee.constitution.abbreviation);
              lodgeNameNumber = parts.join(' | ');
            }
          }
        }
      } else if (ticket.ownerType === 'lodge' && ticket.ownerId) {
        // For lodge type, match ownerId against lodgeId field
        const lodge = await lodgesCollection.findOne({ lodgeId: ticket.ownerId });
        
        // Debug logging
        if (!lodge) {
          console.log(`No lodge found for lodgeId: ${ticket.ownerId}`);
        }
        if (lodge) {
          ownerName = lodge.name || '';
          // For lodge owners, set the lodge name/number
          lodgeNameNumber = `${lodge.name || ''} ${lodge.number || ''}`.trim();
          // Lodge type doesn't have attendeeType or partnerOf
          attendeeType = 'lodge';
        }
      } else if (ticket.ownerType === 'registration' && ticket.ownerId) {
        // For registration type, the ownerId is the registrationId
        // We'll get the owner info from the registration's booking contact
        const registration = await registrationsCollection.findOne({ registrationId: ticket.ownerId });
        if (registration) {
          // Try to get the booking contact name
          if (registration.bookingContact) {
            ownerName = `${registration.bookingContact.firstName || ''} ${registration.bookingContact.lastName || ''}`.trim();
          } else if (registration.contactName) {
            ownerName = registration.contactName;
          }
          attendeeType = 'registration';
        }
      }
      
      // Look up registration using ticket.details.registrationId for all registration-related data
      let confirmationNumber = '';
      let invoiceNumber = '';
      let paymentStatus = 'unknown';
      let grandLodgeAbbreviation = '';
      let registrationDate = '';
      
      // Use details.registrationId first, fall back to top-level registrationId
      const registrationId = ticket.details?.registrationId || ticket.registrationId;
      
      if (registrationId) {
        const registration = await registrationsCollection.findOne({ registrationId: registrationId });
        if (registration) {
          confirmationNumber = registration.confirmationNumber || '';
          
          // Get registration date from registration.createdAt
          registrationDate = registration.createdAt || registration.registrationDate || '';
          
          // Get invoice number from registration
          invoiceNumber = registration.invoiceNumber || registration.invoice?.invoiceNumber || '';
          
          // Get payment status from registration or related payment
          if (registration.paymentStatus) {
            paymentStatus = registration.paymentStatus;
          } else if (registration.paymentId) {
            const payment = await paymentsCollection.findOne({ paymentId: registration.paymentId });
            if (payment) {
              paymentStatus = payment.status || 'unknown';
            }
          }
          
          // Get grandLodgeId from registrationData.attendees and look up abbreviation
          if (registration.registrationData?.attendees && Array.isArray(registration.registrationData.attendees)) {
            // Look for the first attendee with a grandLodgeId
            const attendeeWithGL = registration.registrationData.attendees.find(att => att.grandLodgeId);
            if (attendeeWithGL && attendeeWithGL.grandLodgeId) {
              // Look up the grand lodge to get the abbreviation
              const grandLodge = await grandLodgesCollection.findOne({ grandLodgeId: attendeeWithGL.grandLodgeId });
              if (grandLodge) {
                grandLodgeAbbreviation = grandLodge.abbreviation || '';
              }
            }
          }
        }
      }
      
      return {
        ticketNumber: ticket._id?.toString() || '',
        name: ticket.eventName || ticket.name || '',
        quantity: ticket.quantity || 1,
        price: ticket.price || 0,
        ownerType: ticket.ownerType || '',
        ownerName: ownerName,
        ownerId: ticket.ownerId || '',
        attendeeType: attendeeType,
        partnerOfName: partnerOfName,
        lodgeNameNumber: lodgeNameNumber,
        grandLodge: grandLodgeAbbreviation,
        confirmationNumber: confirmationNumber,
        invoiceNumber: invoiceNumber,
        paymentStatus: paymentStatus,
        registrationId: registrationId || '',
        registrationDate: registrationDate
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
      const headers = ['Ticket Number', 'Event Name', 'Quantity', 'Price', 'Owner Type', 'Owner Name', 'Attendee Type', 'Partner Of', 'Lodge Name/Number', 'Grand Lodge', 'Confirmation Number', 'Invoice Number', 'Payment Status', 'Registration Date'];
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
          t.grandLodge || '',
          t.confirmationNumber || '',
          t.invoiceNumber || '',
          t.paymentStatus || '',
          t.registrationDate || ''
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