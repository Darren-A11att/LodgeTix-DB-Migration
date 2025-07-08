function getMonetaryValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function generateIndividualInvoice(payment, registration, invoiceNumber, relatedDocuments) {
  // Extract booking contact info for bill-to
  const bookingContact = registration?.registrationData?.bookingContact || {};
  
  // Get attendees and selected tickets
  const attendees = registration?.attendees || [];
  const selectedTickets = registration?.selectedTickets || [];
  const eventTickets = relatedDocuments?.eventTickets || [];
  
  // Create lookup map for event tickets
  const ticketLookup = new Map();
  eventTickets.forEach((ticket) => {
    ticketLookup.set(ticket.eventTicketId, ticket);
  });
  
  // Build line items
  const items = [];
  
  // 1. Add confirmation number line item (header)
  items.push({
    id: 'confirmation_header',
    description: `${registration.confirmationNumber || 'N/A'} | Registration for Grand Proclamation 2025`,
    quantity: 0,
    price: 0,
    type: 'other'
  });
  
  // 2. Add attendees as line items with their tickets as sub-items
  attendees.forEach((attendee, index) => {
    // Get tickets for this attendee
    const attendeeTickets = selectedTickets.filter(
      ticket => ticket.attendeeId === attendee.attendeeId
    );
    
    // Build sub-items for this attendee's tickets
    const subItems = attendeeTickets.map((selectedTicket, subIndex) => {
      const ticketInfo = ticketLookup.get(selectedTicket.event_ticket_id);
      
      return {
        id: `ticket_${attendee.attendeeId}_${subIndex}`,
        description: `- ${ticketInfo?.name || selectedTicket.name || 'Ticket'}`,
        quantity: 1,
        price: getMonetaryValue(ticketInfo?.price || selectedTicket.price || 0)
      };
    });
    
    // Create attendee line item
    const attendeeName = [
      attendee.title,
      attendee.firstName,
      attendee.lastName
    ].filter(Boolean).join(' ') || `Attendee ${index + 1}`;
    
    items.push({
      id: `attendee_${attendee.attendeeId}`,
      description: attendeeName,
      quantity: null, // No quantity for attendee line
      price: null, // No price for attendee line
      type: 'attendee',
      subItems: subItems
    });
  });
  
  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    if (item.subItems) {
      item.subItems.forEach((subItem) => {
        subtotal += (subItem.quantity || 0) * (subItem.price || 0);
      });
    } else if (item.quantity && item.price) {
      subtotal += item.quantity * item.price;
    }
  });
  
  // Get payment amount and calculate processing fees
  const totalAmount = getMonetaryValue(payment.grossAmount || payment.amount || 0);
  const processingFees = Math.round((totalAmount - subtotal) * 100) / 100;
  
  // Generate the invoice object
  const invoice = {
    invoiceType: 'customer',
    invoiceNumber: invoiceNumber,
    paymentId: payment._id || payment.paymentId,
    registrationId: registration._id || registration.registrationId,
    date: payment.paymentDate || payment.createdAt || new Date().toISOString(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), // 30 days from now
    
    billTo: {
      businessName: bookingContact.businessName || '',
      businessNumber: bookingContact.businessNumber || '',
      firstName: bookingContact.firstName || '',
      lastName: bookingContact.lastName || '',
      email: bookingContact.email || bookingContact.emailAddress || payment.customerEmail || '',
      addressLine1: bookingContact.addressLine1 || bookingContact.address?.line1 || '',
      addressLine2: bookingContact.addressLine2 || bookingContact.address?.line2 || '',
      city: bookingContact.city || bookingContact.address?.city || '',
      postalCode: bookingContact.postalCode || bookingContact.address?.postalCode || '',
      stateProvince: bookingContact.stateProvince || bookingContact.address?.state || '',
      country: bookingContact.country || bookingContact.address?.country || 'Australia'
    },
    
    supplier: {
      name: 'United Grand Lodge of NSW & ACT',
      abn: '93 230 340 687',
      address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
      issuedBy: 'LodgeTix as Agent'
    },
    
    items: items,
    subtotal: subtotal,
    processingFees: processingFees,
    total: totalAmount,
    
    payment: {
      method: payment.paymentMethod || 'credit_card',
      transactionId: payment.transactionId || payment.originalData?.id || '',
      paidDate: payment.paymentDate || payment.createdAt,
      amount: totalAmount,
      currency: payment.currency || 'AUD',
      last4: payment.cardLast4 || payment.last4 || '',
      cardBrand: payment.cardBrand || '',
      status: payment.status?.toLowerCase() === 'paid' ? 'completed' : payment.status || 'completed',
      source: payment.source || 'stripe'
    },
    
    status: 'paid',
    notes: ''
  };
  
  return invoice;
}

// Helper function to generate invoice for the current match
function generateInvoiceForMatch(currentMatch, invoiceNumber) {
  const { payment, registration, relatedDocuments } = currentMatch;
  return generateIndividualInvoice(payment, registration, invoiceNumber, relatedDocuments);
}

module.exports = {
  generateIndividualInvoice,
  generateInvoiceForMatch
};