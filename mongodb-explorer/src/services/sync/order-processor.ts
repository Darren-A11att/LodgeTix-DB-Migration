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

/**
 * Process a registration into an Order document
 * @param registration - Registration data from import_registrations
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
        productId: ticket.eventTicketId ? new ObjectId(ticket.eventTicketId) : undefined,
        ticketId: ticket.ticketId ? new ObjectId(ticket.ticketId) : undefined,
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
    functionId: registration.functionId ? new ObjectId(registration.functionId) : undefined,
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
  errors: any[] 
}> {
  const ordersCollection = db.collection('orders');
  const customersCollection = db.collection('customers');
  const importRegistrationsCollection = db.collection('import_registrations');
  
  let ordersCreated = 0;
  let ordersSkipped = 0;
  const errors: any[] = [];
  
  console.log(`\n📦 Processing ${registrations.length} registrations into orders...`);
  
  for (const registration of registrations) {
    try {
      // Skip if already processed
      const existingOrder = await ordersCollection.findOne({
        'externalIds.lodgetixOrderId': registration.registrationId
      });
      
      if (existingOrder) {
        ordersSkipped++;
        continue;
      }
      
      // Find or create customer
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
      
    } catch (error: any) {
      errors.push({
        registrationId: registration.registrationId,
        error: error.message
      });
      ordersSkipped++;
    }
  }
  
  console.log(`✅ Order processing complete: ${ordersCreated} created, ${ordersSkipped} skipped`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors occurred during processing`);
  }
  
  return { ordersCreated, ordersSkipped, errors };
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