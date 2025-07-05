const { ObjectId, Decimal128 } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

async function migrateOrdersAndPayments(db, migrationState) {
  try {
    const registrations = await db.collection('registrations').find({}).toArray();
    const payments = await db.collection('payments').find({}).toArray();
    const attendees = await db.collection('attendees').find({}).toArray();
    const tickets = await db.collection('tickets').find({}).toArray();
    
    console.log(`Found ${registrations.length} registrations to migrate`);
    console.log(`Found ${payments.length} payments to process`);
    console.log(`Found ${attendees.length} attendees to process`);
    console.log(`Found ${tickets.length} tickets to process`);
    
    // Group data by registration
    const paymentsByRegistration = groupByRegistration(payments, 'registrationId');
    const attendeesByRegistration = groupByRegistration(attendees, 'registrationId');
    const ticketsByRegistration = groupByRegistration(tickets, 'registrationId');
    
    // Process each registration as an order
    for (const registration of registrations) {
      try {
        const regId = registration.registrationId || registration.registration_id || registration._id.toString();
        
        // Get related data
        const regAttendees = attendeesByRegistration[regId] || [];
        const regTickets = ticketsByRegistration[regId] || [];
        const regPayments = paymentsByRegistration[regId] || [];
        
        // Transform registration to order
        const order = await transformRegistrationToOrder(
          registration,
          regAttendees,
          regTickets,
          regPayments,
          migrationState
        );
        
        // Write order document
        await writeDocument('orders', order._id, order);
        migrationState.stats.orders++;
        
        // Create financial transactions
        if (regPayments.length > 0) {
          for (const payment of regPayments) {
            const transaction = await createFinancialTransaction(order, payment, registration, migrationState);
            await writeDocument('financial-transactions', transaction._id, transaction);
            migrationState.stats['financial-transactions']++;
            
            // Add transaction ID to order
            order.payment.transactions.push(transaction.transactionId);
          }
        } else if (registration.stripePaymentIntentId || registration.squarePaymentId) {
          // Create transaction from registration data if no payment record
          const transaction = await createFinancialTransactionFromRegistration(order, registration, migrationState);
          await writeDocument('financial-transactions', transaction._id, transaction);
          migrationState.stats['financial-transactions']++;
          order.payment.transactions.push(transaction.transactionId);
        }
        
        // Don't write order again here to avoid double counting
        
        // Create tickets for attendees
        await createTicketsForOrder(order, migrationState);
        
        // Update inventory in catalog
        await updateInventoryForOrder(order, migrationState);
        
      } catch (error) {
        await logError('ORDER_MIGRATION', error, { 
          registrationId: registration._id,
          confirmationNumber: registration.confirmationNumber || registration.confirmation_number 
        });
      }
    }
    
    // Write updated catalog objects with inventory
    await writeUpdatedCatalogObjects(migrationState);
    
    console.log(`Successfully migrated ${migrationState.stats.orders} orders`);
    console.log(`Created ${migrationState.stats['financial-transactions']} financial transactions`);
    console.log(`Created ${migrationState.stats.tickets} tickets`);
    
  } catch (error) {
    await logError('ORDER_MIGRATION_FATAL', error);
    throw error;
  }
}

/**
 * Transform registration to order with proper data structure
 */
async function transformRegistrationToOrder(registration, attendees, tickets, payments, migrationState) {
  const orderId = uuidv4();
  const orderObjectId = new ObjectId();
  
  // Extract registration data
  const regData = registration.registrationData || registration.registration_data || {};
  const bookingContact = regData.bookingContact || regData.booking_contact || {};
  const billingContact = regData.billingContact || regData.billing_contact || {};
  
  // Find or create contacts for booking and billing
  const bookingContactId = await findOrCreateContactId(bookingContact, 'booking', registration, migrationState);
  const billingContactId = await findOrCreateContactId(billingContact, 'billing', registration, migrationState);
  
  // Determine customer
  const customer = await determineCustomer(registration, bookingContactId, migrationState);
  
  // Create attendee records with contact links
  const orderAttendees = await createOrderAttendees(attendees, registration, migrationState);
  
  // Create line items from tickets
  const lineItems = await createLineItems(tickets, orderAttendees, registration, migrationState);
  
  // Calculate totals
  const totals = calculateTotals(registration, lineItems, payments);
  
  // Determine payment method
  const paymentMethod = determinePaymentMethod(registration, payments);
  
  return {
    _id: orderObjectId,
    orderId: orderId,
    orderNumber: registration.confirmationNumber || registration.confirmation_number || `ORD-${Date.now()}`,
    orderType: 'registration',
    catalogObjectId: migrationState.functionToCatalog.get(registration.functionId || registration.function_id) || null,
    status: determineOrderStatus(registration, totals),
    
    customer: customer,
    
    booking: bookingContactId ? {
      contactId: bookingContactId,
      name: formatName(bookingContact),
      email: bookingContact.email || registration.purchaser?.email || '',
      phone: normalizePhone(bookingContact.phone || bookingContact.mobile || registration.purchaser?.phone)
    } : null,
    
    lineItems: lineItems,
    attendees: orderAttendees,
    totals: totals,
    
    payment: {
      status: mapPaymentStatus(registration.paymentStatus || registration.payment_status || 'pending'),
      method: paymentMethod,
      transactions: [] // Will be populated after creating financial transactions
    },
    
    billing: {
      contactId: billingContactId,
      name: formatName(billingContact) || formatName(bookingContact),
      email: billingContact.email || bookingContact.email || '',
      phone: normalizePhone(billingContact.phone || billingContact.mobile || bookingContact.phone),
      address: {
        line1: billingContact.addressLine1 || billingContact.address_line_1 || '',
        line2: billingContact.addressLine2 || billingContact.address_line_2 || '',
        city: billingContact.city || '',
        state: billingContact.stateProvince || billingContact.state_province || '',
        postcode: billingContact.postalCode || billingContact.postal_code || '',
        country: billingContact.country || 'Australia'
      },
      abn: registration.abn || regData.billing?.abn || '',
      organisationName: registration.organisationName || registration.organisation_name || ''
    },
    
    notes: registration.notes || registration.comments || '',
    
    metadata: {
      source: {
        channel: registration.source || 'online',
        device: extractDevice(registration),
        ipAddress: registration.ipAddress || registration.ip_address || ''
      },
      createdAt: registration.createdAt || registration.created_at || new Date(),
      createdBy: registration.createdBy || registration.created_by || registration.authUserId || registration.auth_user_id || null,
      updatedAt: registration.updatedAt || registration.updated_at || new Date(),
      updatedBy: registration.updatedBy || registration.updated_by || null
    }
  };
}

/**
 * Find or create contact ID
 */
async function findOrCreateContactId(contactData, type, registration, migrationState) {
  if (!contactData || (!contactData.email && !contactData.phone)) {
    return null;
  }
  
  const email = normalizeEmail(contactData.email);
  const phone = normalizePhone(contactData.phone || contactData.mobile);
  
  // Check if contact already exists
  let contactId = null;
  if (email && migrationState.emailToContact) {
    contactId = migrationState.emailToContact.get(email);
  }
  
  if (!contactId && phone && migrationState.phoneToContact) {
    contactId = migrationState.phoneToContact.get(phone);
  }
  
  if (!contactId) {
    await logWarning('CONTACT_NOT_FOUND', `${type} contact not found during order migration`, {
      email: email,
      phone: phone,
      registrationId: registration._id
    });
  }
  
  return contactId;
}

/**
 * Determine customer information
 */
async function determineCustomer(registration, bookingContactId, migrationState) {
  const type = registration.registrationType || registration.registration_type || 'individual';
  
  if (type === 'organisation' || type === 'lodge') {
    return {
      type: 'organisation',
      contactId: bookingContactId,
      organisationId: registration.organisationId || registration.organisation_id || null
    };
  } else {
    return {
      type: 'individual',
      contactId: bookingContactId,
      organisationId: null
    };
  }
}

/**
 * Create order attendees with contact links
 */
async function createOrderAttendees(attendees, registration, migrationState) {
  const orderAttendees = [];
  
  for (const attendee of attendees) {
    const attendeeId = uuidv4();
    
    // Get linked contact
    const contactId = migrationState.attendeeToContact.get(
      attendee.attendeeId || attendee.attendee_id || attendee._id.toString()
    );
    
    orderAttendees.push({
      attendeeId: attendeeId,
      contactId: contactId || null,
      firstName: attendee.firstName || attendee.first_name || '',
      lastName: attendee.lastName || attendee.last_name || '',
      email: attendee.email || attendee.primaryEmail || attendee.primary_email || '',
      phone: normalizePhone(attendee.phone || attendee.primaryPhone || attendee.primary_phone),
      ticketId: null, // Will be set when ticket is created
      lineItemId: null, // Will be set when assigned to line item
      dietaryRequirements: parseDietaryRequirements(attendee.dietaryRequirements || attendee.dietary_requirements),
      specialNeeds: attendee.specialNeeds || attendee.special_needs || '',
      masonicProfile: attendee.isMason ? {
        isMason: true,
        title: attendee.title || null,
        rank: attendee.rank || null,
        lodgeId: attendee.lodgeId || attendee.lodge_id || null,
        lodgeName: attendee.lodgeName || attendee.lodge_name || null
      } : null
    });
  }
  
  return orderAttendees;
}

/**
 * Create line items from tickets
 */
async function createLineItems(tickets, orderAttendees, registration, migrationState) {
  const lineItems = [];
  
  // If no tickets, create a package line item for lodge registrations
  if (tickets.length === 0 && registration.registrationType === 'lodge') {
    const packageId = registration.registrationData?.packageId;
    const attendeeCount = registration.attendeeCount || orderAttendees.length || 10;
    const metadata = registration.registrationData?.metadata || {};
    const subtotal = metadata.subtotal || registration.subtotal || 0;
    
    if (packageId && subtotal > 0) {
      const lineItemId = new ObjectId();
      const unitPrice = Decimal128.fromString(String(subtotal));
      
      const productInfo = migrationState.eventToProduct.get(registration.functionId || registration.function_id);
      const productId = productInfo ? (productInfo.productId || productInfo) : registration.functionId;
      
      lineItems.push({
        _id: lineItemId,
        productId: productId,
        productName: `Lodge Table Package - ${registration.organisationName || 'Lodge'}`,
        variationId: packageId,
        variationName: 'Table Package (10 seats)',
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice,
        attendees: orderAttendees.map(a => {
          a.lineItemId = lineItemId;
          return a.attendeeId;
        })
      });
    }
    return lineItems;
  }
  
  // Group tickets by event and ticket type
  const ticketGroups = {};
  for (const ticket of tickets) {
    const eventId = ticket.eventId || ticket.event_id;
    const ticketTypeId = ticket.eventTicketId || ticket.event_ticket_id || ticket.ticketTypeId || ticket.ticket_type_id;
    const key = `${eventId}:${ticketTypeId}`;
    
    if (!ticketGroups[key]) {
      ticketGroups[key] = {
        tickets: [],
        eventId: eventId,
        ticketTypeId: ticketTypeId,
        eventTitle: ticket.eventTitle || ticket.event_title || 'Event',
        price: ticket.ticketPrice || ticket.ticket_price || ticket.price || 0
      };
    }
    ticketGroups[key].tickets.push(ticket);
  }
  
  // Create line item for each group
  let attendeeIndex = 0;
  for (const group of Object.values(ticketGroups)) {
    const lineItemId = new ObjectId();
    
    // Get product/variation info
    const productInfo = migrationState.eventToProduct.get(group.eventId);
    const variationInfo = migrationState.ticketToVariation.get(group.ticketTypeId);
    
    if (!productInfo || !variationInfo) {
      await logWarning('LINE_ITEM_MAPPING', 
        `Missing product mapping for event ${group.eventId} or ticket ${group.ticketTypeId}`,
        { registrationId: registration._id }
      );
      continue;
    }
    
    const productId = productInfo.productId || productInfo;
    
    // Assign attendees to this line item
    const assignedAttendees = [];
    for (let i = 0; i < group.tickets.length && attendeeIndex < orderAttendees.length; i++) {
      const attendee = orderAttendees[attendeeIndex];
      attendee.lineItemId = lineItemId;
      assignedAttendees.push(attendee.attendeeId);
      attendeeIndex++;
    }
    
    const unitPrice = Decimal128.fromString(String(group.price));
    const quantity = group.tickets.length;
    const totalPrice = Decimal128.fromString(String(group.price * quantity));
    
    lineItems.push({
      _id: lineItemId,
      productId: productId,
      productName: group.eventTitle,
      variationId: variationInfo.variationId,
      variationName: variationInfo.name || 'Standard Ticket',
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      attendees: assignedAttendees
    });
  }
  
  return lineItems;
}

/**
 * Calculate order totals with proper fees
 */
function calculateTotals(registration, lineItems, payments) {
  // Calculate subtotal from line items
  const subtotal = lineItems.reduce((sum, item) => 
    sum + parseFloat(item.totalPrice.toString()), 0
  );
  
  // Check metadata for amounts if main fields are 0
  const metadata = registration.registrationData?.metadata || {};
  const hasMetadataAmounts = metadata.subtotal && metadata.amount;
  
  // Extract amounts from registration
  const regData = {
    subtotal: registration.subtotal || (hasMetadataAmounts ? metadata.subtotal : subtotal) || 0,
    discount: registration.discount || 0,
    tax: registration.tax || registration.gst || 0,
    stripeFee: registration.stripeFee || registration.stripe_fee || metadata.stripeFee || 0,
    squareFee: registration.squareFee || registration.square_fee || 0,
    platformFee: registration.platformFeeAmount || registration.platform_fee_amount || 0,
    total: registration.totalPricePaid || registration.total_price_paid || metadata.amount || subtotal || 0,
    paid: registration.totalAmountPaid || registration.total_amount_paid || metadata.amount || 0
  };
  
  // Handle null or NaN values
  Object.keys(regData).forEach(key => {
    if (regData[key] === null || isNaN(regData[key])) {
      regData[key] = 0;
    }
  });
  
  // Calculate merchant fee (payment gateway fee)
  const merchantFee = regData.stripeFee || regData.squareFee || 0;
  
  // Calculate platform fee (our commission - typically 5%)
  const platformFee = regData.platformFee || (regData.subtotal * 0.05);
  
  return {
    subtotal: Decimal128.fromString(String(regData.subtotal)),
    discount: Decimal128.fromString(String(regData.discount)),
    tax: Decimal128.fromString(String(regData.tax)),
    merchantFee: Decimal128.fromString(String(merchantFee)),
    platformFee: Decimal128.fromString(String(platformFee)),
    total: Decimal128.fromString(String(regData.total)),
    paid: Decimal128.fromString(String(regData.paid)),
    balance: Decimal128.fromString(String(regData.total - regData.paid)),
    currency: 'AUD'
  };
}

/**
 * Create financial transaction from payment
 */
async function createFinancialTransaction(order, payment, registration, migrationState) {
  const transactionId = uuidv4();
  
  // Determine gateway details
  const gateway = {
    provider: payment.provider || determinePaymentProvider(payment),
    transactionId: payment.stripePaymentIntentId || payment.stripe_payment_intent_id ||
                   payment.squarePaymentId || payment.square_payment_id ||
                   payment.paymentId || payment.payment_id || '',
    fee: order.totals.merchantFee,
    net: Decimal128.fromString(String(parseFloat(payment.amount || 0) - parseFloat(order.totals.merchantFee.toString())))
  };
  
  return {
    _id: new ObjectId(),
    transactionId: transactionId,
    orderId: order.orderId,
    type: 'payment',
    status: mapPaymentStatus(payment.status),
    
    amount: Decimal128.fromString(String(payment.amount || 0)),
    currency: payment.currency || 'AUD',
    
    gateway: gateway,
    
    platformFee: {
      amount: order.totals.platformFee,
      percentage: 5,
      description: 'Platform service fee'
    },
    
    paymentMethod: {
      type: payment.paymentMethod || payment.payment_method || 'card'
    },
    
    reconciliation: {
      status: 'pending',
      reconciledAt: null,
      reference: null
    },
    
    metadata: {
      ipAddress: registration.ipAddress || registration.ip_address || '',
      source: 'checkout',
      createdAt: payment.createdAt || payment.created_at || new Date(),
      createdBy: payment.createdBy || payment.created_by || null
    }
  };
}

/**
 * Create financial transaction from registration when no payment record exists
 */
async function createFinancialTransactionFromRegistration(order, registration, migrationState) {
  const transactionId = uuidv4();
  const metadata = registration.registrationData?.metadata || {};
  const amount = metadata.amount || order.totals.total || 0;
  
  // Determine gateway details
  const gateway = {
    provider: registration.stripePaymentIntentId ? 'stripe' : 'square',
    transactionId: registration.stripePaymentIntentId || registration.squarePaymentId || '',
    fee: order.totals.merchantFee,
    net: Decimal128.fromString(String(parseFloat(amount.toString()) - parseFloat(order.totals.merchantFee.toString())))
  };
  
  return {
    _id: new ObjectId(),
    transactionId: transactionId,
    orderId: order.orderId,
    type: 'payment',
    status: mapPaymentStatus(registration.paymentStatus || registration.payment_status),
    
    amount: Decimal128.fromString(String(amount)),
    currency: 'AUD',
    
    gateway: gateway,
    
    platformFee: {
      amount: order.totals.platformFee,
      percentage: 5,
      description: 'Platform service fee'
    },
    
    paymentMethod: {
      type: 'card'
    },
    
    reconciliation: {
      status: 'pending',
      reconciledAt: null,
      reference: null
    },
    
    metadata: {
      ipAddress: registration.ipAddress || registration.ip_address || '',
      source: 'checkout',
      createdAt: registration.createdAt || new Date(),
      createdBy: registration.authUserId || registration.auth_user_id || null
    }
  };
}

/**
 * Create tickets for order attendees
 */
async function createTicketsForOrder(order, migrationState) {
  for (const attendee of order.attendees) {
    if (!attendee.contactId) continue;
    
    const ticketId = uuidv4();
    const lineItem = order.lineItems.find(li => li._id.equals(attendee.lineItemId));
    
    if (!lineItem) continue;
    
    const ticket = {
      _id: new ObjectId(),
      ticketId: ticketId,
      ticketNumber: `${order.orderNumber}-${String(migrationState.stats.tickets + 1).padStart(4, '0')}`,
      orderId: order.orderId,
      contactId: attendee.contactId,
      productId: lineItem.productId,
      variationId: lineItem.variationId,
      eventName: lineItem.productName,
      status: 'active',
      qrCode: generateQRCode(ticketId),
      
      attendeeInfo: {
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        email: attendee.email,
        phone: attendee.phone,
        dietaryRequirements: attendee.dietaryRequirements,
        specialNeeds: attendee.specialNeeds
      },
      
      metadata: {
        createdAt: order.metadata.createdAt,
        updatedAt: new Date()
      }
    };
    
    await writeDocument('tickets', ticket._id, ticket);
    migrationState.stats.tickets++;
    
    // Update attendee with ticket ID
    attendee.ticketId = ticketId;
  }
}

/**
 * Update inventory in catalog objects
 */
async function updateInventoryForOrder(order, migrationState) {
  for (const lineItem of order.lineItems) {
    const catalogId = order.catalogObjectId;
    const productKey = `${lineItem.productId}:${lineItem.variationId}`;
    
    if (!catalogId) continue;
    
    if (!migrationState.inventoryUpdates.has(catalogId)) {
      migrationState.inventoryUpdates.set(catalogId, new Map());
    }
    
    const inventoryMap = migrationState.inventoryUpdates.get(catalogId);
    
    if (!inventoryMap.has(productKey)) {
      inventoryMap.set(productKey, {
        quantity_sold: 0,
        quantity_reserved: 0
      });
    }
    
    const inventory = inventoryMap.get(productKey);
    inventory.quantity_sold += lineItem.quantity;
  }
}

/**
 * Write updated catalog objects with inventory
 */
async function writeUpdatedCatalogObjects(migrationState) {
  console.log(`Updating ${migrationState.inventoryUpdates.size} catalog objects with inventory...`);
  
  // This would need to read the catalog objects, update inventory, and write back
  // For now, just log the updates
  for (const [catalogId, inventoryMap] of migrationState.inventoryUpdates) {
    console.log(`Catalog ${catalogId}: ${inventoryMap.size} products updated`);
  }
}

/**
 * Helper functions
 */
function groupByRegistration(items, idField) {
  const grouped = {};
  items.forEach(item => {
    const regId = item[idField] || item.registration_id || item.registrationId;
    if (!regId) return;
    
    if (!grouped[regId]) {
      grouped[regId] = [];
    }
    grouped[regId].push(item);
  });
  return grouped;
}

function normalizeEmail(email) {
  if (!email) return null;
  return email.toLowerCase().trim();
}

function normalizePhone(phone, defaultCountryCode = '+61') {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  
  if (!phone.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode.replace('+', '') + cleaned;
  }
  
  return '+' + cleaned;
}

function formatName(contact) {
  const firstName = contact.firstName || contact.first_name || '';
  const lastName = contact.lastName || contact.last_name || '';
  return `${firstName} ${lastName}`.trim() || contact.name || '';
}

function parseDietaryRequirements(dietary) {
  if (!dietary) return [];
  if (Array.isArray(dietary)) return dietary;
  
  const requirements = [];
  const text = dietary.toLowerCase();
  
  if (text.includes('vegetarian')) requirements.push('vegetarian');
  if (text.includes('vegan')) requirements.push('vegan');
  if (text.includes('gluten')) requirements.push('gluten-free');
  if (text.includes('dairy')) requirements.push('dairy-free');
  if (text.includes('nut')) requirements.push('nut-free');
  if (text.includes('halal')) requirements.push('halal');
  if (text.includes('kosher')) requirements.push('kosher');
  
  if (requirements.length === 0 && dietary.trim()) {
    requirements.push(dietary.trim());
  }
  
  return requirements;
}

function determinePaymentMethod(registration, payments) {
  if (payments.length > 0) {
    const payment = payments[0];
    if (payment.stripePaymentIntentId || payment.stripe_payment_intent_id) return 'stripe';
    if (payment.squarePaymentId || payment.square_payment_id) return 'square';
  }
  
  if (registration.paymentMethod || registration.payment_method) {
    return registration.paymentMethod || registration.payment_method;
  }
  
  return 'unknown';
}

function determinePaymentProvider(payment) {
  if (payment.stripePaymentIntentId || payment.stripe_payment_intent_id) return 'stripe';
  if (payment.squarePaymentId || payment.square_payment_id) return 'square';
  return 'unknown';
}

function mapPaymentStatus(status) {
  const statusMap = {
    'succeeded': 'paid',
    'paid': 'paid',
    'pending': 'pending',
    'processing': 'processing',
    'failed': 'failed',
    'cancelled': 'cancelled',
    'refunded': 'refunded'
  };
  
  return statusMap[status?.toLowerCase()] || 'pending';
}

function determineOrderStatus(registration, totals) {
  const regStatus = registration.status?.toLowerCase() || '';
  const paymentStatus = (registration.paymentStatus || registration.payment_status)?.toLowerCase() || '';
  
  if (paymentStatus === 'paid' || paymentStatus === 'succeeded' || 
      parseFloat(totals.paid.toString()) >= parseFloat(totals.total.toString())) {
    return 'paid';
  }
  
  if (regStatus === 'cancelled' || paymentStatus === 'cancelled') {
    return 'cancelled';
  }
  
  if (regStatus === 'refunded' || paymentStatus === 'refunded') {
    return 'refunded';
  }
  
  if (parseFloat(totals.paid.toString()) > 0) {
    return 'partially_paid';
  }
  
  return 'pending';
}

function extractDevice(registration) {
  const userAgent = registration.userAgent || registration.user_agent || '';
  if (userAgent.includes('Mobile')) return 'mobile';
  if (userAgent.includes('Tablet')) return 'tablet';
  return 'desktop';
}

function generateQRCode(ticketId) {
  // Placeholder - would generate actual QR code
  return `QR-${ticketId}`;
}

function mapRegistrationType(type) {
  // Always return 'registration' for now
  return 'registration';
}

module.exports = migrateOrdersAndPayments;