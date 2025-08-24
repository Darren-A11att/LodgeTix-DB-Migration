/**
 * Order Processing Service
 * Transforms registrations into order documents with tax calculations
 */

import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  Order, 
  OrderItem,
  OrderReference,
  TaxCalculation,
  calculateTax as calculateTaxFromSchema,
  generateOrderId as generateOrderIdFromSchema,
  createOrderReference as createOrderReferenceFromSchema
} from './nested-schemas';
import { mapSupabaseToMongo, validateRequiredFields } from './supabase-field-mapper';

/**
 * Process a registration into an Order document
 * @param registration - Registration data from import_registrations (with Supabase UUIDs)
 * @param customer - Customer data (with customerId)
 * @returns Complete Order document ready for insertion
 */
export function processOrder(registration: any, customer: any): Order {
  const orderId = generateOrderIdFromSchema();
  
  // Extract items from registration tickets
  const orderedItems: OrderItem[] = [];
  let subtotal = 0;
  
  // Process tickets into order items
  if (registration.registrationData?.tickets) {
    for (const ticket of registration.registrationData.tickets) {
      const itemPrice = ticket.price || 0;
      subtotal += itemPrice;
      
      orderedItems.push({
        itemId: new ObjectId(),
        productId: ticket.eventTicketId || undefined, // Keep as UUID string
        ticketId: ticket.ticketId || undefined, // Keep as UUID string
        name: ticket.ticketName || ticket.ticketType || 'Event Ticket',
        description: `${ticket.eventName || 'Event'} - ${ticket.ticketType || 'General'}`,
        quantity: 1,
        unitPrice: itemPrice,
        totalPrice: itemPrice,
        category: 'ticket',
        metadata: {
          attendeeId: ticket.attendeeId,
          attendeeName: ticket.attendeeName,
          originalTicketData: ticket
        }
      });
    }
  }
  
  // Calculate fees (from registration or default to 0)
  const fees = registration.fees || registration.registrationData?.fees || 0;
  
  // Calculate tax (GST 10% inclusive)
  const taxCalculation = calculateTaxFromSchema(subtotal, fees);
  
  // Create the Order document
  const order: Order = {
    _id: new ObjectId(),
    orderId,
    
    // Customer Information
    customerId: customer._id,
    contactId: customer.contactId,
    
    // Billing Information
    billTo: {
      firstName: customer.firstName || registration.firstName || '',
      lastName: customer.lastName || registration.lastName || '',
      email: customer.email || registration.email || '',
      phone: customer.phone || registration.phone,
      address: customer.address || {
        street: registration.address || '',
        city: registration.city || '',
        state: registration.state || '',
        postcode: registration.postcode || '',
        country: registration.country || 'Australia'
      },
      company: customer.businessName
    },
    
    // Order Details
    orderedItems,
    
    // Financial Calculations
    subtotal,
    fees,
    taxCalculation,
    totalAmount: taxCalculation.totalAmount,
    
    // Payment Information
    paymentStatus: mapPaymentStatus(registration.paymentStatus),
    paymentMethod: mapPaymentMethod(registration.paymentMethod || registration.registrationData?.paymentMethod),
    paymentGateway: determinePaymentGateway(registration),
    paymentReference: registration.stripePaymentIntentId || registration.squarePaymentId || registration.paymentId,
    paidAmount: registration.paymentStatus === 'paid' ? taxCalculation.totalAmount : 0,
    paidDate: registration.paymentStatus === 'paid' ? new Date(registration.paidAt || registration.createdAt) : undefined,
    
    // Order Status
    status: registration.paymentStatus === 'paid' ? 'completed' : 'pending',
    orderDate: new Date(registration.createdAt || registration.registrationDate),
    completedDate: registration.paymentStatus === 'paid' ? new Date() : undefined,
    
    // Function/Event Information
    functionId: registration.functionId || undefined, // Keep as UUID string
    functionName: registration.functionName || registration.registrationData?.functionName,
    functionDate: registration.eventDate ? new Date(registration.eventDate) : undefined,
    
    // Additional Information
    notes: registration.notes || registration.registrationData?.notes,
    internalNotes: `Imported from registration ${registration.registrationId}`,
    
    // Metadata
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'sync-processor',
    
    // Sync Information
    syncStatus: 'synced',
    lastSyncDate: new Date(),
    externalIds: {
      lodgetixOrderId: registration.registrationId,
      stripePaymentIntentId: registration.stripePaymentIntentId,
      squareOrderId: registration.squarePaymentId
    }
  };
  
  return order;
}

/**
 * Create a reference from an order for customer records
 */
export function createOrderReferenceFromOrder(order: Order): OrderReference {
  return createOrderReferenceFromSchema(order);
}

/**
 * Process multiple registrations into orders
 * @param registrations - Array of registration documents
 * @param db - MongoDB database connection
 * @returns Results of order processing
 */
export async function processOrdersFromRegistrations(
  registrations: any[],
  db: any
): Promise<{ 
  ordersCreated: number; 
  ordersSkipped: number; 
  errors: any[];
  auditLog: any[];
}> {
  const ordersCollection = db.collection('orders');
  const customersCollection = db.collection('customers');
  const importRegistrationsCollection = db.collection('import_registrations');
  
  let ordersCreated = 0;
  let ordersSkipped = 0;
  const errors: any[] = [];
  const auditLog: any[] = [];
  
  console.log(`\n📦 Processing ${registrations.length} registrations into orders...`);
  
  for (const registration of registrations) {
    try {
      // Skip if already processed - match on UUID string
      const existingOrder = await ordersCollection.findOne({
        'externalIds.lodgetixOrderId': registration.registrationId  // UUID string comparison
      });
      
      if (existingOrder) {
        ordersSkipped++;
        auditLog.push({
          timestamp: new Date(),
          registrationId: registration.registrationId,
          decision: 'SKIP',
          businessRule: 'DUPLICATE_ORDER',
          reason: 'Order already exists for this registration',
          metadata: {
            existingOrderId: existingOrder.orderId,
            existingOrderCreated: existingOrder.createdAt,
            registrationDate: registration.createdAt
          }
        });
        console.log(`⏭️ Skipped ${registration.registrationId}: Order already exists (${existingOrder.orderId})`);
        continue;
      }
      
      // Find or create customer - using exact field matching
      let customer = await customersCollection.findOne({
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName
      });
      
      if (!customer) {
        // Create a minimal customer if not found
        customer = {
          _id: new ObjectId(),
          customerId: uuidv4(),
          firstName: registration.firstName || '',
          lastName: registration.lastName || '',
          email: registration.email || '',
          phone: registration.phone,
          address: {
            street: registration.address || '',
            city: registration.city || '',
            state: registration.state || '',
            postcode: registration.postcode || '',
            country: registration.country || 'Australia'
          },
          businessName: registration.businessName,
          orders: [],
          totalOrders: 0,
          totalSpent: 0,
          status: 'active',
          customerType: registration.businessName ? 'organization' : 'individual',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await customersCollection.insertOne(customer);
      }
      
      // Create order
      const order = processOrder(registration, customer);
      
      // Insert order
      await ordersCollection.insertOne(order);
      
      // Update customer with order reference
      const orderRef = createOrderReferenceFromOrder(order);
      await customersCollection.updateOne(
        { _id: customer._id },
        {
          $push: { orders: orderRef },
          $inc: { 
            totalOrders: 1,
            totalSpent: order.totalAmount
          },
          $set: { 
            lastOrderDate: order.orderDate,
            updatedAt: new Date()
          }
        }
      );
      
      // Mark registration as having an order
      await importRegistrationsCollection.updateOne(
        { registrationId: registration.registrationId },
        {
          $set: {
            orderId: order.orderId,
            orderProcessed: true,
            orderProcessedAt: new Date()
          }
        }
      );
      
      ordersCreated++;
      
      auditLog.push({
        timestamp: new Date(),
        registrationId: registration.registrationId,
        decision: 'CREATE',
        businessRule: 'NEW_ORDER',
        reason: 'Successfully created order from registration',
        metadata: {
          orderId: order.orderId,
          customerId: customer._id,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
          itemCount: order.orderedItems.length
        }
      });
      
      console.log(`✅ Created order ${order.orderId} for registration ${registration.registrationId}`);
      
    } catch (error: any) {
      const errorDetail = {
        registrationId: registration.registrationId,
        error: error.message,
        stack: error.stack,
        registration: {
          id: registration.registrationId,
          paymentStatus: registration.paymentStatus,
          totalAmount: registration.totalAmountPaid,
          customerEmail: registration.registrationData?.bookingContact?.email
        }
      };
      errors.push(errorDetail);
      ordersSkipped++;
      
      auditLog.push({
        timestamp: new Date(),
        registrationId: registration.registrationId,
        decision: 'ERROR',
        businessRule: 'PROCESSING_ERROR',
        reason: error.message,
        metadata: {
          errorType: error.name,
          errorStack: error.stack,
          paymentStatus: registration.paymentStatus,
          isObjectIdError: error.stack?.includes('ObjectId')
        }
      });
      
      // Log detailed error immediately
      console.error(`❌ Order processing failed for ${registration.registrationId}:`);
      console.error(`   Error: ${error.message}`);
      if (error.stack?.includes('ObjectId')) {
        console.error(`   Issue: Attempting to convert UUID to ObjectId`);
        console.error(`   Solution: Keep UUIDs as strings in the database`);
      }
    }
  }
  
  console.log(`✅ Order processing complete: ${ordersCreated} created, ${ordersSkipped} skipped`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors occurred during processing`);
  }
  
  // Generate audit summary
  console.log('\n📊 AUDIT SUMMARY:');
  const decisionCounts = auditLog.reduce((acc, log) => {
    acc[log.decision] = (acc[log.decision] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(decisionCounts).forEach(([decision, count]) => {
    console.log(`  ${decision}: ${count} registrations`);
  });
  
  // Log business rule breakdown
  const ruleCounts = auditLog.reduce((acc, log) => {
    acc[log.businessRule] = (acc[log.businessRule] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📋 BUSINESS RULES APPLIED:');
  Object.entries(ruleCounts).forEach(([rule, count]) => {
    console.log(`  ${rule}: ${count} times`);
  });
  
  return { ordersCreated, ordersSkipped, errors, auditLog };
}

// Helper functions

function mapPaymentStatus(status: string): 'unpaid' | 'partial' | 'paid' | 'refunded' | 'cancelled' {
  const statusMap: { [key: string]: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'cancelled' } = {
    'paid': 'paid',
    'complete': 'paid',
    'completed': 'paid',
    'pending': 'unpaid',
    'unpaid': 'unpaid',
    'partial': 'partial',
    'refunded': 'refunded',
    'cancelled': 'cancelled',
    'failed': 'cancelled'
  };
  
  return statusMap[status?.toLowerCase()] || 'unpaid';
}

function mapPaymentMethod(method: string): 'card' | 'bank_transfer' | 'cash' | 'cheque' | undefined {
  const methodMap: { [key: string]: 'card' | 'bank_transfer' | 'cash' | 'cheque' } = {
    'card': 'card',
    'credit_card': 'card',
    'debit_card': 'card',
    'bank_transfer': 'bank_transfer',
    'bank': 'bank_transfer',
    'transfer': 'bank_transfer',
    'cash': 'cash',
    'cheque': 'cheque',
    'check': 'cheque'
  };
  
  return methodMap[method?.toLowerCase()];
}

function determinePaymentGateway(registration: any): 'stripe' | 'square' | 'manual' | undefined {
  if (registration.stripePaymentIntentId || registration.stripe_charge_id) {
    return 'stripe';
  }
  if (registration.squarePaymentId || registration.square_payment_id) {
    return 'square';
  }
  if (registration.paymentMethod === 'cash' || registration.paymentMethod === 'cheque') {
    return 'manual';
  }
  return undefined;
}