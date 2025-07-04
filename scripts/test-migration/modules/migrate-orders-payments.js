const { ObjectId, Decimal128 } = require('mongodb');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

async function migrateOrdersAndPayments(db, migrationState) {
  try {
    const registrations = await db.collection('registrations').find({}).toArray();
    const payments = await db.collection('payments').find({}).toArray();
    const attendees = await db.collection('attendees').find({}).toArray();
    const tickets = await db.collection('tickets').find({}).toArray();
    
    console.log(`Found ${registrations.length} registrations to migrate`);
    console.log(`Found ${payments.length} payments to process`);
    console.log(`Found ${tickets.length} tickets to process`);
    
    // Group payments by registration
    const paymentsByRegistration = {};
    payments.forEach(payment => {
      const regId = payment.registrationId || payment.registration_id;
      if (!paymentsByRegistration[regId]) {
        paymentsByRegistration[regId] = [];
      }
      paymentsByRegistration[regId].push(payment);
    });
    
    // Group attendees by registration
    const attendeesByRegistration = {};
    attendees.forEach(attendee => {
      const regId = attendee.registrationId || attendee.registration_id;
      if (!attendeesByRegistration[regId]) {
        attendeesByRegistration[regId] = [];
      }
      attendeesByRegistration[regId].push(attendee);
    });
    
    // Group tickets by registration and attendee
    const ticketsByRegistration = {};
    const ticketsByAttendee = {};
    tickets.forEach(ticket => {
      const regId = ticket.registrationId || ticket.registration_id;
      if (regId) {
        if (!ticketsByRegistration[regId]) {
          ticketsByRegistration[regId] = [];
        }
        ticketsByRegistration[regId].push(ticket);
      }
      
      const attId = ticket.attendee_id || ticket.attendeeId;
      if (attId) {
        if (!ticketsByAttendee[attId]) {
          ticketsByAttendee[attId] = [];
        }
        ticketsByAttendee[attId].push(ticket);
      }
    });
    
    // Process each registration as an order
    for (const registration of registrations) {
      let regId; // Declare variable in outer scope
      try {
        // Transform registration to order
        regId = registration.registrationId || registration.registration_id || registration._id.toString();
        const order = await transformRegistrationToOrder(
          registration,
          attendeesByRegistration[regId] || [],
          ticketsByRegistration[regId] || [],
          ticketsByAttendee,
          migrationState
        );
        
        // Write order document
        await writeDocument('orders', order._id, order);
        
        // Process payments for this registration
        const regPayments = paymentsByRegistration[regId] || [];
        for (const payment of regPayments) {
          const transaction = await createFinancialTransaction(order, payment, migrationState);
          await writeDocument('financial-transactions', transaction._id, transaction);
        }
        
        // Create tickets for fulfilled items
        await createTicketsForOrder(order, registration, migrationState);
        
        // Update inventory for purchased items
        await updateInventoryForOrder(order, migrationState);
        
      } catch (error) {
        await logError('ORDER_MIGRATION', error, { 
          registrationId: regId || 'unknown',
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

async function transformRegistrationToOrder(registration, attendees, tickets, ticketsByAttendee, migrationState) {
  const orderId = registration._id;
  
  // Determine customer info
  const customer = await determineCustomer(registration, migrationState);
  
  // Transform tickets to line items
  const lineItems = await createLineItems(registration, attendees, tickets, ticketsByAttendee, migrationState);
  
  // Calculate totals
  const totals = calculateTotals(registration, lineItems);
  
  // Determine order status
  const status = determineOrderStatus(registration, totals);
  
  return {
    _id: orderId,
    orderNumber: registration.confirmation_number || registration.confirmationNumber || `ORD-${Date.now()}`,
    orderType: mapRegistrationType(registration.registration_type || registration.registrationType),
    catalogObjectId: migrationState.functionToCatalog.get(registration.function_id || registration.functionId) || null,
    status: status,
    
    customer: customer,
    lineItems: lineItems,
    totals: totals,
    
    payment: {
      status: mapPaymentStatus(registration.payment_status || registration.paymentStatus || registration.status),
      transactions: [] // Will be linked when creating financial transactions
    },
    
    billing: {
      contact: {
        name: registration.registration_data?.billing?.contact?.name || registration.registrationData?.billing?.contact?.name || registration.primary_attendee?.name || registration.primaryAttendee?.name || '',
        email: registration.registration_data?.billing?.contact?.email || registration.registrationData?.billing?.contact?.email || registration.primary_attendee?.email || registration.primaryAttendee?.email || '',
        phone: registration.registration_data?.billing?.contact?.phone || registration.registrationData?.billing?.contact?.phone || registration.primary_attendee?.phone || registration.primaryAttendee?.phone || ''
      },
      address: registration.registration_data?.billing?.address || registration.registrationData?.billing?.address || {},
      abn: registration.registration_data?.billing?.abn || registration.registrationData?.billing?.abn || '',
      organisationName: registration.organisation_name || registration.organisationName || ''
    },
    
    notes: registration.notes || registration.comments || '',
    
    metadata: {
      source: {
        channel: registration.source || 'online',
        device: extractDevice(registration),
        ipAddress: registration.ip_address || registration.ipAddress || ''
      },
      createdAt: registration.created_at || registration.createdAt || new Date(),
      createdBy: registration.created_by || registration.createdBy || registration.auth_user_id || registration.authUserId || null,
      updatedAt: registration.updated_at || registration.updatedAt || new Date(),
      updatedBy: registration.updated_by || registration.updatedBy || null
    }
  };
}

async function determineCustomer(registration, migrationState) {
  const purchaserType = registration.registration_type || registration.registrationType;
  
  if (purchaserType === 'organisation' || purchaserType === 'lodge' || purchaserType === 'organisations') {
    return {
      type: 'organisation',
      contactId: (registration.booking_contact_id || registration.bookingContactId) && ObjectId.isValid(registration.booking_contact_id || registration.bookingContactId) ? 
        new ObjectId(registration.booking_contact_id || registration.bookingContactId) : null,
      organisationId: registration.organisation_id || registration.organisationId || null,
      rawData: {
        name: registration.organisation_name || registration.organisationName || '',
        email: registration.primary_attendee?.email || registration.primaryAttendee?.email || registration.registration_data?.billing?.email || registration.registrationData?.billing?.email || '',
        phone: registration.primary_attendee?.phone || registration.primaryAttendee?.phone || registration.registration_data?.billing?.phone || registration.registrationData?.billing?.phone || ''
      }
    };
  } else {
    return {
      type: 'individual',
      contactId: (registration.booking_contact_id || registration.bookingContactId) && ObjectId.isValid(registration.booking_contact_id || registration.bookingContactId) ? 
        new ObjectId(registration.booking_contact_id || registration.bookingContactId) : null,
      organisationId: null,
      rawData: {
        name: registration.primary_attendee?.name || registration.primaryAttendee?.name || '',
        email: registration.primary_attendee?.email || registration.primaryAttendee?.email || '',
        phone: registration.primary_attendee?.phone || registration.primaryAttendee?.phone || ''
      }
    };
  }
}

async function createLineItems(registration, attendees, tickets, ticketsByAttendee, migrationState) {
  const lineItems = [];
  
  // Group tickets by event and ticket type
  const ticketsByEventAndType = {};
  
  for (const ticket of tickets) {
    const eventId = ticket.event_id || ticket.eventId;
    const ticketTypeId = ticket.event_ticket_id || ticket.eventTicketId || ticket.ticket_type_id || ticket.ticketTypeId;
    
    // Check if this is a package ticket
    const packageInfo = migrationState.packageMappings?.get(ticketTypeId);
    if (packageInfo) {
      // For packages, create line items for each included item
      const packageLineItems = await createLineItemsFromPackage(ticket, packageInfo, registration, attendees, migrationState);
      lineItems.push(...packageLineItems);
      continue;
    }
    
    const ticketKey = `${eventId}:${ticketTypeId}`;
    if (!ticketsByEventAndType[ticketKey]) {
      ticketsByEventAndType[ticketKey] = [];
    }
    ticketsByEventAndType[ticketKey].push(ticket);
  }
  
  // Create line items for each ticket type
  for (const [ticketKey, groupedTickets] of Object.entries(ticketsByEventAndType)) {
    const [eventId, ticketTypeId] = ticketKey.split(':');
    
    // Get product/variation info from mappings
    const productInfo = migrationState.eventToProduct.get(eventId);
    const variationInfo = migrationState.ticketToVariation.get(ticketTypeId);
    
    if (!productInfo || !variationInfo) {
      await logWarning('LINE_ITEM_MAPPING', `Missing mapping for event ${eventId} or ticket ${ticketTypeId}`);
      continue;
    }
    
    // Get attendees for these tickets
    const attendeesForTickets = [];
    for (const ticket of groupedTickets) {
      const attId = ticket.attendee_id || ticket.attendeeId;
      if (attId) {
        const attendee = attendees.find(a => (a.attendee_id || a.attendeeId) === attId);
        if (attendee) {
          attendeesForTickets.push(attendee);
        }
      }
    }
    
    // Create line item
    const lineItem = {
      _id: new ObjectId(),
      productId: productInfo.productId,
      productName: groupedTickets[0]?.event_title || groupedTickets[0]?.eventTitle || 'Unknown Event',
      variationId: variationInfo.variationId,
      variationName: 'Standard Ticket', // We don't have ticket type names in tickets
      quantity: groupedTickets.length,
      unitPrice: Decimal128.fromString(String(groupedTickets[0]?.ticket_price || groupedTickets[0]?.ticketPrice || groupedTickets[0]?.original_price || groupedTickets[0]?.originalPrice || 0)),
      totalPrice: Decimal128.fromString(String((groupedTickets[0]?.ticket_price || groupedTickets[0]?.ticketPrice || groupedTickets[0]?.original_price || groupedTickets[0]?.originalPrice || 0) * groupedTickets.length)),
      
      owner: determineLineItemOwner(registration, attendeesForTickets, migrationState),
      
      fulfillment: {
        status: 'pending',
        ticketId: null,
        fulfilledAt: null
      }
    };
    
    lineItems.push(lineItem);
  }
  
  return lineItems;
}

function determineLineItemOwner(registration, attendees, migrationState) {
  // For individual registrations, assign to attendee
  const regType = registration.registration_type || registration.registrationType;
  if ((regType === 'individual' || regType === 'individuals') && attendees.length === 1) {
    const attendee = attendees[0];
    const contactId = migrationState.attendeeToContact.get(attendee.attendee_id || attendee.attendeeId);
    
    return {
      type: 'contact',
      contactId: contactId || null,
      organisationId: null,
      rawAttendee: contactId ? null : {
        firstName: attendee.first_name || attendee.firstName || '',
        lastName: attendee.last_name || attendee.lastName || '',
        email: attendee.email || attendee.primary_email || attendee.primaryEmail || '',
        phone: attendee.phone || attendee.primary_phone || attendee.primaryPhone || '',
        dietaryRequirements: attendee.dietary_requirements || attendee.dietaryRequirements || '',
        specialNeeds: attendee.special_needs || attendee.specialNeeds || ''
      }
    };
  }
  
  // For lodge/organisation registrations, initially unassigned
  if (regType === 'lodge' || regType === 'organisation' || regType === 'organisations') {
    return {
      type: 'unassigned',
      contactId: null,
      organisationId: registration.organisation_id || registration.organisationId || null,
      rawAttendee: attendees.map(a => ({
        firstName: a.first_name || a.firstName || '',
        lastName: a.last_name || a.lastName || '',
        email: a.email || a.primary_email || a.primaryEmail || '',
        phone: a.phone || a.primary_phone || a.primaryPhone || '',
        dietaryRequirements: a.dietary_requirements || a.dietaryRequirements || '',
        specialNeeds: a.special_needs || a.specialNeeds || ''
      }))
    };
  }
  
  // Default to unassigned
  return {
    type: 'unassigned',
    contactId: null,
    organisationId: null,
    rawAttendee: null
  };
}

function calculateTotals(registration, lineItems) {
  const subtotal = lineItems.reduce((sum, item) => 
    sum + parseFloat(item.totalPrice.toString()), 0
  );
  
  // Helper to safely convert to Decimal128
  const toDecimal = (value) => {
    if (value == null) return Decimal128.fromString('0');
    if (typeof value === 'object') {
      // Handle Decimal128 or other object types
      return Decimal128.fromString(String(value.value || value.$numberDecimal || 0));
    }
    return Decimal128.fromString(String(value));
  };
  
  return {
    subtotal: toDecimal(registration.subtotal || subtotal),
    discount: toDecimal(registration.discount),
    tax: toDecimal(registration.tax || registration.gst),
    fees: toDecimal(registration.stripe_fee || registration.stripeFee || registration.square_fee || registration.squareFee || registration.platform_fee_amount || registration.platformFeeAmount),
    total: toDecimal(registration.total_price_paid || registration.totalPricePaid || subtotal),
    paid: toDecimal(registration.total_amount_paid || registration.totalAmountPaid),
    balance: toDecimal((registration.total_price_paid || registration.totalPricePaid || subtotal) - (registration.total_amount_paid || registration.totalAmountPaid || 0)),
    currency: 'AUD'
  };
}

function determineOrderStatus(registration, totals) {
  const regStatus = registration.status?.toLowerCase() || '';
  const paymentStatus = (registration.payment_status || registration.paymentStatus)?.toLowerCase() || '';
  
  // Fix inconsistent statuses
  if (paymentStatus === 'paid' || paymentStatus === 'succeeded' || parseFloat(totals.paid.toString()) >= parseFloat(totals.total.toString())) {
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
  
  if (regStatus === 'pending' || regStatus === 'processing') {
    return 'processing';
  }
  
  return 'pending';
}

async function createFinancialTransaction(order, payment, migrationState) {
  const transactionId = new ObjectId();
  
  return {
    _id: transactionId,
    transactionId: payment.transaction_id || payment.transactionId || `TXN-${new Date().getFullYear()}-${String(migrationState.stats['financial-transactions'] + 1).padStart(5, '0')}`,
    type: 'order_payment',
    
    reference: {
      type: 'order',
      id: order._id,
      number: order.orderNumber,
      catalogObjectId: order.catalogObjectId,
      catalogName: '' // Would be looked up in real migration
    },
    
    parties: {
      customer: {
        type: order.customer.type,
        id: order.customer.contactId || order.customer.organisationId,
        name: payment.customer_name || payment.customerName || order.customer.rawData.name,
        abn: order.billing.abn || '',
        email: order.customer.rawData.email,
        contact: {
          name: order.billing.contact.name,
          phone: order.billing.contact.phone
        }
      },
      supplier: {
        name: payment.organisation || 'Lodge Organisation',
        abn: '12345678901',
        address: '123 Lodge Street, Sydney NSW 2000'
      }
    },
    
    amounts: {
      gross: Decimal128.fromString(String(payment.gross_amount || payment.grossAmount || 0)),
      fees: Decimal128.fromString(String(payment.fee_amount || payment.feeAmount || 0)),
      tax: Decimal128.fromString('0'), // Calculate from payment
      net: Decimal128.fromString(String(payment.net_amount || payment.netAmount || 0)),
      total: Decimal128.fromString(String(payment.gross_amount || payment.grossAmount || 0)),
      currency: payment.currency || 'AUD'
    },
    
    payments: [{
      _id: new ObjectId(),
      method: payment.source === 'card' ? 'credit_card' : payment.source || 'credit_card',
      gateway: payment.source || 'stripe',
      gatewayTransactionId: payment.payment_id || payment.paymentId || payment.transaction_id || payment.transactionId || '',
      status: payment.status || 'succeeded',
      amount: Decimal128.fromString(String(payment.gross_amount || payment.grossAmount || 0)),
      processedAt: payment.timestamp || new Date(),
      
      card: (payment.card_last4 || payment.cardLast4) ? {
        last4: payment.card_last4 || payment.cardLast4 || '',
        brand: payment.card_brand || payment.cardBrand || '',
        expiryMonth: null,
        expiryYear: null
      } : null,
      
      fees: {
        amount: Decimal128.fromString(String(payment.fee_amount || payment.feeAmount || 0)),
        rate: '1.75% + $0.30',
        breakdown: {
          percentage: Decimal128.fromString('0.0175'),
          fixed: Decimal128.fromString('0.30')
        }
      },
      
      metadata: {
        chargeId: payment.payment_id || payment.paymentId || '',
        receiptUrl: '',
        riskScore: null
      }
    }],
    
    invoices: {
      customer: null, // Would create invoice in real migration
      creditNotes: [],
      supplier: []
    },
    
    remittance: {
      required: false,
      sentDate: null,
      method: null,
      recipient: null,
      reference: null,
      details: null
    },
    
    reconciliation: {
      status: 'pending',
      reconciledDate: null,
      reconciledBy: null,
      bankStatementRef: null,
      bankDate: null,
      notes: null
    },
    
    accounting: {
      exported: false,
      exportedAt: null,
      exportBatchId: null,
      entries: [],
      externalReferences: {}
    },
    
    refund: null,
    
    audit: {
      createdAt: payment.timestamp || new Date(),
      createdBy: 'migration',
      updatedAt: payment.timestamp || new Date(),
      updatedBy: 'migration',
      version: 1,
      changes: [],
      notes: []
    }
  };
}

async function createTicketsForOrder(order, registration, migrationState) {
  let ticketCounter = 1;
  
  for (const lineItem of order.lineItems) {
    // Create tickets based on quantity
    for (let i = 0; i < lineItem.quantity; i++) {
      const ticket = {
        _id: new ObjectId(),
        ticketNumber: `TKT-${order.orderNumber}-${String(ticketCounter++).padStart(3, '0')}`,
        
        catalog: {
          catalogObjectId: order.catalogObjectId,
          catalogName: '', // Would be looked up
          productId: lineItem.productId,
          productName: lineItem.productName,
          variationId: lineItem.variationId,
          variationName: lineItem.variationName,
          
          eventStart: null, // Would be looked up from catalog
          eventEnd: null,
          location: {},
          
          description: '',
          price: lineItem.unitPrice,
          features: [],
          restrictions: []
        },
        
        order: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          lineItemId: lineItem._id,
          purchasedBy: {
            type: order.customer.type,
            contactId: order.customer.contactId,
            organisationId: order.customer.organisationId,
            name: order.customer.rawData.name
          },
          purchaseDate: order.metadata.createdAt,
          
          pricePaid: lineItem.unitPrice,
          currency: order.totals.currency,
          
          fulfilledAt: new Date(),
          fulfillmentStatus: 'fulfilled'
        },
        
        owner: {
          type: lineItem.owner.type,
          contactId: lineItem.owner.contactId,
          organisationId: lineItem.owner.organisationId,
          name: lineItem.owner.rawAttendee && Array.isArray(lineItem.owner.rawAttendee) ? 
            `${lineItem.owner.rawAttendee[i]?.firstName} ${lineItem.owner.rawAttendee[i]?.lastName}` : ''
        },
        
        transferHistory: [],
        
        access: {
          zones: ['all'],
          gates: ['main'],
          validFrom: null,
          validUntil: null,
          
          singleUse: false,
          multiEntry: true,
          maxEntries: null,
          entryCount: 0,
          
          status: 'valid',
          revokedReason: null,
          revokedAt: null,
          revokedBy: null
        },
        
        usageHistory: [],
        
        delivery: {
          method: 'digital',
          status: 'sent',
          
          digital: {
            sentAt: new Date(),
            email: (lineItem.owner.rawAttendee && Array.isArray(lineItem.owner.rawAttendee) ? lineItem.owner.rawAttendee[i]?.email : null) || order.customer.rawData.email,
            downloadCount: 0,
            lastDownloadAt: null
          },
          
          physical: null,
          willCall: null
        },
        
        seat: null,
        addOns: [],
        
        security: {
          barcode: generateBarcode(order.orderNumber, ticketCounter),
          qrData: generateQRData(order.orderNumber, ticketCounter),
          securityCode: generateSecurityCode(),
          
          ipAddress: order.metadata.source.ipAddress,
          deviceFingerprint: '',
          riskScore: null,
          
          verified: false,
          verifiedAt: null,
          verificationMethod: null
        },
        
        status: 'active',
        customFields: new Map(),
        
        metadata: {
          createdAt: new Date(),
          createdBy: null,
          updatedAt: new Date(),
          updatedBy: null,
          version: 1,
          
          source: 'migration',
          importBatch: 'test-migration',
          migrationId: registration.registrationId || registration._id.toString()
        }
      };
      
      await writeDocument('tickets', ticket._id, ticket);
      
      // Update line item fulfillment
      lineItem.fulfillment.status = 'fulfilled';
      lineItem.fulfillment.ticketId = ticket._id;
      lineItem.fulfillment.fulfilledAt = new Date();
    }
  }
}

async function updateInventoryForOrder(order, migrationState) {
  for (const lineItem of order.lineItems) {
    const catalogId = order.catalogObjectId?.toString();
    
    // Check if this is a package
    if (lineItem.metadata && lineItem.metadata.isPackage && lineItem.metadata.includedItems) {
      // Update inventory for each item in the package
      for (const includedItem of lineItem.metadata.includedItems) {
        const itemVariationInfo = migrationState.ticketToVariation.get(includedItem.variationId);
        if (itemVariationInfo) {
          const inventoryKey = `${itemVariationInfo.productId}:${includedItem.variationId}`;
          
          if (catalogId && migrationState.inventoryUpdates.has(catalogId)) {
            const catalogInventory = migrationState.inventoryUpdates.get(catalogId);
            
            if (catalogInventory.has(inventoryKey)) {
              const inventory = catalogInventory.get(inventoryKey);
              // Update by quantity in package * number of packages sold
              inventory.quantity_sold += (includedItem.quantity * lineItem.quantity);
            } else {
              // Initialize if not exists
              catalogInventory.set(inventoryKey, {
                quantity_sold: includedItem.quantity * lineItem.quantity,
                quantity_reserved: 0
              });
            }
          }
        }
      }
      
      // Also update the package's own inventory
      const packageInventoryKey = `${lineItem.productId}:${lineItem.variationId}`;
      if (catalogId && migrationState.inventoryUpdates.has(catalogId)) {
        const catalogInventory = migrationState.inventoryUpdates.get(catalogId);
        
        if (catalogInventory.has(packageInventoryKey)) {
          const inventory = catalogInventory.get(packageInventoryKey);
          inventory.quantity_sold += lineItem.quantity;
        } else {
          catalogInventory.set(packageInventoryKey, {
            quantity_sold: lineItem.quantity,
            quantity_reserved: 0
          });
        }
      }
    } else {
      // Regular item inventory update
      const inventoryKey = `${lineItem.productId}:${lineItem.variationId}`;
      
      if (catalogId && migrationState.inventoryUpdates.has(catalogId)) {
        const catalogInventory = migrationState.inventoryUpdates.get(catalogId);
        
        if (catalogInventory.has(inventoryKey)) {
          const inventory = catalogInventory.get(inventoryKey);
          inventory.quantity_sold += lineItem.quantity;
        }
      }
    }
  }
}

async function writeUpdatedCatalogObjects(migrationState) {
  const fs = require('fs').promises;
  const path = require('path');
  
  console.log(`Updating ${migrationState.inventoryUpdates.size} catalog objects with inventory...`);
  
  for (const [catalogIdStr, inventoryMap] of migrationState.inventoryUpdates) {
    try {
      // Read the catalog object
      const catalogPath = path.join(
        __dirname, 
        '../../../test-migration-output/catalog-objects',
        `${catalogIdStr}.json`
      );
      
      const catalogData = await fs.readFile(catalogPath, 'utf8');
      const catalog = JSON.parse(catalogData);
      
      // Update inventory for each product/variation
      for (const [inventoryKey, updates] of inventoryMap) {
        const [productId, variationId] = inventoryKey.split(':');
        
        // Find product and variation
        const product = catalog.products.find(p => p.productId === productId);
        if (product) {
          const variation = product.variations.find(v => v.variationId === variationId);
          if (variation) {
            variation.inventory.quantity_sold = updates.quantity_sold;
            variation.inventory.quantity_available = 
              variation.inventory.quantity_total - updates.quantity_sold - updates.quantity_reserved;
          }
        }
      }
      
      // Update catalog totals
      catalog.inventory.totalSold = catalog.products.reduce((sum, p) => 
        sum + p.variations.reduce((vSum, v) => vSum + (v.inventory.quantity_sold || 0), 0), 0
      );
      
      catalog.inventory.totalAvailable = catalog.products.reduce((sum, p) => 
        sum + p.variations.reduce((vSum, v) => vSum + (v.inventory.quantity_available || 0), 0), 0
      );
      
      // Calculate revenue
      let totalRevenue = 0;
      catalog.products.forEach(p => {
        p.variations.forEach(v => {
          let price = 0;
          if (v.price && v.price.amount) {
            if (typeof v.price.amount === 'object' && v.price.amount.$numberDecimal) {
              price = parseFloat(v.price.amount.$numberDecimal);
            } else if (typeof v.price.amount === 'string') {
              price = parseFloat(v.price.amount);
            } else if (typeof v.price.amount === 'number') {
              price = v.price.amount;
            }
          }
          const sold = v.inventory.quantity_sold || 0;
          totalRevenue += price * sold;
        });
      });
      
      catalog.inventory.totalRevenue = { $numberDecimal: String(totalRevenue) };
      
      // Write updated catalog
      await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
      
    } catch (error) {
      logError('CATALOG_UPDATE', error, { catalogId: catalogIdStr });
    }
  }
}

// Helper functions
function mapRegistrationType(type) {
  const typeMap = {
    'individual': 'registration',
    'lodge': 'registration',
    'delegation': 'registration',
    'organisation': 'registration'
  };
  
  return typeMap[type] || 'registration';
}

function mapPaymentStatus(status) {
  const statusMap = {
    'completed': 'paid',
    'paid': 'paid',
    'pending': 'pending',
    'processing': 'processing',
    'failed': 'failed',
    'cancelled': 'failed',
    'refunded': 'refunded'
  };
  
  return statusMap[status?.toLowerCase()] || 'pending';
}

function extractDevice(registration) {
  const userAgent = registration.user_agent || '';
  
  if (userAgent.includes('Mobile')) return 'mobile';
  if (userAgent.includes('Tablet')) return 'tablet';
  if (userAgent.includes('Desktop')) return 'desktop';
  
  return 'unknown';
}

async function findContactByEmail(email, migrationState) {
  if (!email) return null;
  
  // This would normally do a lookup, but for migration we'll return null
  // The contact should already exist from contact migration
  return null;
}

function generateBarcode(orderNumber, ticketNumber) {
  return `${orderNumber}-${String(ticketNumber).padStart(3, '0')}`;
}

function generateQRData(orderNumber, ticketNumber) {
  const data = {
    o: orderNumber,
    t: ticketNumber,
    v: 1
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function generateSecurityCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

async function createLineItemsFromPackage(ticket, packageInfo, registration, attendees, migrationState) {
  const { logWarning } = require('../utils/helpers');
  const lineItems = [];
  
  // Package price (what the customer paid)
  const packagePrice = parseFloat(ticket.ticket_price || ticket.ticketPrice || ticket.package_price || ticket.packagePrice || packageInfo.price || 0);
  
  // For each item in the package, create a line item
  for (const includedItem of packageInfo.includedItems) {
    // Get the variation info for this included item
    const variationInfo = migrationState.ticketToVariation.get(includedItem.variationId);
    if (!variationInfo) {
      await logWarning('PACKAGE_ITEM_MAPPING', `Missing variation mapping for package item ${includedItem.variationId}`);
      continue;
    }
    
    // Get product info
    const productInfo = migrationState.eventToProduct.get(variationInfo.productId);
    if (!productInfo) {
      await logWarning('PACKAGE_PRODUCT_MAPPING', `Missing product mapping for package item product ${variationInfo.productId}`);
      continue;
    }
    
    // Calculate proportional price for this item based on package discount
    // For now, we'll divide the package price evenly among all items
    const totalQuantity = packageInfo.includedItems.reduce((sum, item) => sum + item.quantity, 0);
    const unitPrice = packagePrice / totalQuantity;
    
    const lineItem = {
      _id: new ObjectId(),
      productId: variationInfo.productId,
      productName: includedItem.name || 'Package Item',
      variationId: includedItem.variationId,
      variationName: includedItem.name || 'Package Item',
      quantity: includedItem.quantity,
      unitPrice: Decimal128.fromString(String(unitPrice)),
      totalPrice: Decimal128.fromString(String(unitPrice * includedItem.quantity)),
      
      owner: determineLineItemOwner(registration, attendees, migrationState),
      
      fulfillment: {
        status: 'pending',
        ticketId: null,
        fulfilledAt: null
      },
      
      // Store metadata to indicate this came from a package
      metadata: {
        fromPackage: true,
        packageId: packageInfo.packageId,
        packageName: packageInfo.name
      }
    };
    
    lineItems.push(lineItem);
  }
  
  return lineItems;
}

module.exports = migrateOrdersAndPayments;