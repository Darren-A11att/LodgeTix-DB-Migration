import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { 
  Cart, 
  CartItem, 
  Order, 
  OrderItem,
  OrderPayment,
  Customer,
  CustomerType
} from './ecommerce-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface TransformationResult {
  cartsCreated: number;
  ordersCreated: number;
  errors: string[];
}

async function transformRegistrationsToOrders(): Promise<TransformationResult> {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔄 TRANSFORMING REGISTRATIONS → CARTS → ORDERS');
  console.log('='.repeat(80));
  
  const result: TransformationResult = {
    cartsCreated: 0,
    ordersCreated: 0,
    errors: []
  };
  
  try {
    // Collections
    const registrationsCollection = db.collection('old_registrations');
    const attendeesCollection = db.collection('old_attendees');
    const ticketsCollection = db.collection('old_tickets');
    const cartsCollection = db.collection('carts');
    const ordersCollection = db.collection('orders');
    const productsCollection = db.collection('products');
    
    // Get the main function product
    const functionProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!functionProduct) {
      throw new Error('Function product not found');
    }
    
    // Read all registrations
    console.log('\n📖 Reading registrations...');
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`✅ Found ${registrations.length} registrations to transform`);
    
    // Process each registration
    for (const registration of registrations) {
      try {
        console.log(`\n📄 Processing registration ${registration.registrationId}`);
        
        // Step 1: Create Cart
        const cart = await createCartFromRegistration(
          registration, 
          functionProduct,
          attendeesCollection,
          ticketsCollection
        );
        
        await cartsCollection.replaceOne(
          { cartId: cart.cartId },
          cart,
          { upsert: true }
        );
        result.cartsCreated++;
        console.log(`  ✅ Created cart with ${cart.cartItems.length} items`);
        
        // Step 2: Only create Order if payment is actually paid (not pending or failed)
        const isPaid = registration.paymentCompleted === true || 
                      registration.paymentStatus === 'paid' ||
                      registration.paymentStatus === 'completed';
        
        const isRefunded = registration.paymentStatus === 'refunded' ||
                          registration.refundStatus === 'refunded' ||
                          registration.isRefunded === true;
        
        if (isPaid || isRefunded) {
          const order = await createOrderFromCart(cart, registration, isRefunded);
          
          await ordersCollection.replaceOne(
            { orderId: order.orderId },
            order,
            { upsert: true }
          );
          result.ordersCreated++;
          const status = isRefunded ? 'REFUNDED' : 'PAID';
          console.log(`  ✅ Created order ${order.orderNumber} (${status})`);
        } else {
          console.log(`  ⏭️  Skipped order creation - payment status: ${registration.paymentStatus || 'unpaid'}`);
        }
        
      } catch (error: any) {
        const errorMsg = `Failed to transform registration ${registration.registrationId}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TRANSFORMATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Carts Created: ${result.cartsCreated}`);
    console.log(`✅ Orders Created: ${result.ordersCreated}`);
    console.log(`📋 Conversion Rate: ${((result.ordersCreated / result.cartsCreated) * 100).toFixed(1)}%`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    }
    
    return result;
    
  } finally {
    await client.close();
  }
}

function createCustomerFromRegistration(registration: any): Customer {
  const bookingContact = registration.registrationData?.bookingContact || {};
  const billingDetails = registration.registrationData?.billingDetails || {};
  
  // Determine if this is an organisation based on businessName
  const businessName = bookingContact.businessName || billingDetails.businessName || '';
  const isOrganisation = businessName.trim() !== '';
  
  // Try to extract name from various sources
  const firstName = bookingContact.firstName || billingDetails.firstName || '';
  const lastName = bookingContact.lastName || billingDetails.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || bookingContact.name || billingDetails.name || 'Guest';
  
  const customer: Customer = {
    customerId: registration.customerId || registration.userId || uuidv4(),
    name: registration.customerId ? fullName : 'guest',
    type: isOrganisation ? 'organisation' : 'person',
    email: bookingContact.email || billingDetails.email || registration.email,
    phone: bookingContact.phone || billingDetails.phone || registration.phone,
    addressLine1: bookingContact.addressLine1 || billingDetails.addressLine1 || bookingContact.address,
    addressLine2: bookingContact.addressLine2 || billingDetails.addressLine2,
    suburb: bookingContact.suburb || billingDetails.suburb || bookingContact.city,
    state: bookingContact.state || billingDetails.state,
    postCode: bookingContact.postCode || billingDetails.postCode || bookingContact.postalCode,
    country: bookingContact.country || billingDetails.country || 'Australia',
    businessName: businessName || undefined,
    businessNumber: bookingContact.businessNumber || billingDetails.businessNumber || bookingContact.abn || billingDetails.abn
  };
  
  return customer;
}

async function createCartFromRegistration(
  registration: any,
  functionProduct: any,
  attendeesCollection: any,
  ticketsCollection: any
): Promise<Cart> {
  const cartItems: CartItem[] = [];
  
  // Determine the registration type from the registration data
  const registrationType = registration.registrationType || 
                          (registration.registrationData?.packageId ? 'lodge' : 'individual');
  
  // Get all attendees for this registration
  const attendees = await attendeesCollection.find({ 
    registrationId: registration.registrationId 
  }).toArray();
  
  // Get all tickets for all attendees
  const tickets = await ticketsCollection.find({
    attendeeId: { $in: attendees.map((a: any) => a.attendeeId) }
  }).toArray();
  
  // Group tickets by attendee
  const ticketsByAttendee = new Map<string, any[]>();
  for (const ticket of tickets) {
    const attendeeId = ticket.attendeeId || ticket.ticketHolder?.attendeeId;
    if (attendeeId) {
      if (!ticketsByAttendee.has(attendeeId)) {
        ticketsByAttendee.set(attendeeId, []);
      }
      ticketsByAttendee.get(attendeeId)!.push(ticket);
    }
  }
  
  // Handle based on registration type
  if (registrationType === 'lodge' || registrationType === 'lodges' || registrationType === 'delegation') {
    // LODGE REGISTRATION: Create ONE bundle for the lodge
    const lodgeData = registration.registrationData?.lodge || {};
    
    // Find the lodge variant (lodge-mason as default for lodge registrations)
    const variant = functionProduct.variants?.find((v: any) => 
      v.options.registration === 'lodge' &&
      v.options.attendee === 'mason'
    ) || functionProduct.variants?.[3]; // lodge-mason variant
    
    if (variant) {
      // Create the main lodge bundle cart item
      const lodgeBundleItem: any = {
        cartItemId: uuidv4(),
        productId: functionProduct.productId,
        variantId: variant.variantId,
        quantity: attendees.length || 1, // Quantity is number of attendees
        price: variant.price || 0,
        subtotal: (variant.price || 0) * (attendees.length || 1),
        formData: {
          // For lodge registrations, formData contains the lodge details
          lodgeName: lodgeData.name || registration.registrationData?.lodgeName || '',
          lodgeNumber: lodgeData.number || registration.registrationData?.lodgeNumber || '',
          lodgeAddress: lodgeData.address || registration.registrationData?.address || '',
          lodgeCity: lodgeData.city || registration.registrationData?.city || '',
          lodgeState: lodgeData.state || registration.registrationData?.state || '',
          lodgePostcode: lodgeData.postcode || registration.registrationData?.postcode || '',
          lodgeCountry: lodgeData.country || registration.registrationData?.country || 'Australia',
          // Representative/booking contact details
          representativeName: registration.registrationData?.bookingContact?.firstName + ' ' + 
                            registration.registrationData?.bookingContact?.lastName || '',
          representativeEmail: registration.registrationData?.bookingContact?.email || '',
          representativePhone: registration.registrationData?.bookingContact?.phone || '',
          // Grand Lodge or Masonic Order details if applicable
          grandLodge: registration.registrationData?.grandLodge || '',
          masonicOrder: registration.registrationData?.masonicOrder || '',
          // Attendee information
          attendeeCount: attendees.length,
          attendees: attendees.map((a: any) => ({
            name: `${a.firstName || ''} ${a.lastName || ''}`.trim(),
            email: a.email,
            rank: a.rank
          }))
        },
        metadata: {
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          registrationType: 'lodge',
          attendeeCount: attendees.length
        },
        addedAt: new Date(registration.createdAt || Date.now()),
        updatedAt: new Date(registration.updatedAt || Date.now())
      };
      cartItems.push(lodgeBundleItem);
      
      // Add lodge package kit as sub-item if there's a package
      if (registration.registrationData?.packageId) {
        const packageItem = {
          cartItemId: uuidv4(),
          productId: registration.registrationData.packageId,
          variantId: `${registration.registrationData.packageId}-default`,
          quantity: 1,
          price: registration.registrationData.packagePrice || 0,
          subtotal: registration.registrationData.packagePrice || 0,
          parentItemId: lodgeBundleItem.cartItemId,
          metadata: {
            packageName: registration.registrationData.packageName || 'Lodge Package',
            isPackage: true
          },
          addedAt: new Date(registration.createdAt || Date.now()),
          updatedAt: new Date(registration.updatedAt || Date.now())
        };
        cartItems.push(packageItem);
      }
      
      // Add all tickets as bundled items under the lodge bundle
      for (const ticket of tickets) {
        const eventProductId = ticket.eventId;
        const bundledProduct = functionProduct.bundledProducts?.find(
          (bp: any) => bp.productId === eventProductId
        );
        
        if (bundledProduct || eventProductId) {
          cartItems.push({
            cartItemId: uuidv4(),
            productId: eventProductId,
            variantId: `${eventProductId}-default`,
            quantity: 1,
            price: ticket.pricePaid || ticket.price || 0,
            subtotal: ticket.pricePaid || ticket.price || 0,
            parentItemId: lodgeBundleItem.cartItemId,
            metadata: {
              eventName: ticket.eventName || bundledProduct?.displayName || '',
              ticketNumber: ticket.ticketNumber,
              attendeeName: `${ticket.attendeeFirstName || ''} ${ticket.attendeeLastName || ''}`.trim(),
              isBundledProduct: true
            },
            addedAt: new Date(ticket.createdAt || Date.now()),
            updatedAt: new Date(ticket.updatedAt || Date.now())
          });
        }
      }
    }
  } else {
    // INDIVIDUAL REGISTRATION: Create one bundle per attendee
    for (const attendee of attendees) {
      const attendeeType = determineAttendeeType(attendee);
      
      // Find the correct variant for this attendee
      const variant = functionProduct.variants?.find((v: any) => 
        v.options.registration === 'individual' &&
        v.options.attendee === attendeeType
      ) || functionProduct.variants?.[0];
      
      if (variant) {
        // Create bundle cart item for this attendee
        const attendeeBundleItem: any = {
          cartItemId: uuidv4(),
          productId: functionProduct.productId,
          variantId: variant.variantId,
          quantity: 1,
          price: variant.price || 0,
          subtotal: variant.price || 0,
          formData: {
            // For individual registrations, formData contains the attendee details
            attendeeId: attendee.attendeeId,
            firstName: attendee.firstName || attendee.attendeeData?.firstName || '',
            lastName: attendee.lastName || attendee.attendeeData?.lastName || '',
            email: attendee.email || attendee.attendeeData?.email || '',
            phone: attendee.phone || attendee.attendeeData?.phone || '',
            title: attendee.title || '',
            lodgeName: attendee.lodgeNameNumber || attendee.lodge || '',
            lodgeNumber: attendee.lodgeNumber || '',
            rank: attendee.rank || '',
            dietary: attendee.dietary || attendee.dietaryRequirements || '',
            accessibility: attendee.accessibility || '',
            specialNeeds: attendee.specialNeeds || '',
            // Partner relationship from original data
            isPartner: attendee.isPartner || false,
            partnerOf: attendee.partnerOf || attendee.partner || '',
            relationship: attendee.relationship || ''
          },
          metadata: {
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            registrationType: 'individual',
            attendeeType: attendeeType,
            attendeeId: attendee.attendeeId
          },
          addedAt: new Date(registration.createdAt || Date.now()),
          updatedAt: new Date(registration.updatedAt || Date.now())
        };
        cartItems.push(attendeeBundleItem);
        
        // Add this attendee's tickets as bundled items
        const attendeeTickets = ticketsByAttendee.get(attendee.attendeeId) || [];
        for (const ticket of attendeeTickets) {
          const eventProductId = ticket.eventId;
          const bundledProduct = functionProduct.bundledProducts?.find(
            (bp: any) => bp.productId === eventProductId
          );
          
          if (bundledProduct || eventProductId) {
            cartItems.push({
              cartItemId: uuidv4(),
              productId: eventProductId,
              variantId: `${eventProductId}-default`,
              quantity: 1,
              price: ticket.pricePaid || ticket.price || 0,
              subtotal: ticket.pricePaid || ticket.price || 0,
              parentItemId: attendeeBundleItem.cartItemId,
              metadata: {
                eventName: ticket.eventName || bundledProduct?.displayName || '',
                ticketNumber: ticket.ticketNumber,
                isBundledProduct: true
              },
              addedAt: new Date(ticket.createdAt || Date.now()),
              updatedAt: new Date(ticket.updatedAt || Date.now())
            });
          }
        }
      }
    }
  }
  
  // Calculate totals from all cart items
  const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Use the actual total paid if available, otherwise use calculated subtotal
  const total = registration.totalAmount || registration.totalPricePaid || subtotal;
  
  // Create customer object from registration data
  const customer = createCustomerFromRegistration(registration);
  
  const cart: Cart = {
    cartId: registration.registrationId || uuidv4(),
    customerId: customer.customerId,
    customer: customer,
    status: registration.paymentCompleted ? 'converted' : 'active',
    cartItems,
    subtotal: subtotal,
    tax: 0,
    discount: 0,
    total: total,
    currency: 'AUD',
    source: 'migration' as any,
    createdAt: new Date(registration.createdAt || Date.now()),
    updatedAt: new Date(registration.updatedAt || Date.now()),
    convertedAt: registration.paymentCompleted ? new Date(registration.paymentDate || Date.now()) : undefined
  };
  
  return cart;
}

async function createOrderFromCart(cart: Cart, registration: any, isRefunded: boolean = false): Promise<Order> {
  // Create order items from cart items (should be just one for the bundle)
  const orderItems: OrderItem[] = cart.cartItems.map(item => ({
    orderItemId: uuidv4(),
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    status: 'fulfilled',
    fulfilledAt: new Date(registration.paymentDate || Date.now()),
    metadata: item.metadata
  }));
  
  // Use customer from cart
  const customer = cart.customer;
  
  // Create payment info with correct status
  const payment: OrderPayment = {
    paymentId: registration.paymentId || uuidv4(),
    method: registration.stripePaymentIntentId ? 'stripe' : 
            registration.squarePaymentId ? 'square' : 'other',
    status: isRefunded ? 'refunded' : 'paid',
    amount: cart.total,
    transactionId: registration.stripePaymentIntentId || 
                  registration.squarePaymentId || 
                  registration.paymentId,
    processedAt: new Date(registration.paymentDate || Date.now()),
    processor: {
      stripe: registration.stripePaymentIntentId ? {
        paymentIntentId: registration.stripePaymentIntentId,
        chargeId: registration.stripeChargeId
      } : undefined,
      square: registration.squarePaymentId ? {
        paymentId: registration.squarePaymentId,
        orderId: registration.squareOrderId
      } : undefined
    }
  };
  
  const order: Order = {
    orderId: uuidv4(),
    orderNumber: registration.confirmationNumber || 
                 registration.registrationId || 
                 `ORD-${Date.now()}`,
    cartId: cart.cartId,
    customer,
    orderItems,
    subtotal: cart.subtotal,
    tax: cart.tax || 0,
    discount: cart.discount || 0,
    shipping: 0,
    total: cart.total,
    currency: cart.currency,
    payment,
    status: isRefunded ? 'refunded' : 'completed',
    paymentStatus: isRefunded ? 'refunded' : 'paid',
    fulfillmentStatus: isRefunded ? 'unfulfilled' : 'fulfilled',
    source: 'migration' as any,
    originalRegistrationId: registration.registrationId,
    createdAt: new Date(registration.createdAt || Date.now()),
    updatedAt: new Date(registration.updatedAt || Date.now()),
    completedAt: isRefunded ? undefined : new Date(registration.paymentDate || Date.now()),
    cancelledAt: isRefunded ? new Date(registration.refundDate || Date.now()) : undefined
  };
  
  return order;
}

function determineAttendeeType(attendee: any): 'mason' | 'guest' | 'member' {
  if (!attendee) return 'guest';
  
  const data = attendee.attendeeData || attendee;
  
  // Check if mason (primary attendee or has lodge info)
  if (data.isPrimary || data.attendeeType === 'primary' || data.lodgeNumber || data.rank) {
    return 'mason';
  }
  
  // Check if member (for lodge registrations)
  if (data.isMember || data.memberType === 'member') {
    return 'member';
  }
  
  // Everyone else is guest (including partners)
  // Partners will have their relationship captured in formData.partnerOf
  return 'guest';
}

// Export for testing
export { transformRegistrationsToOrders };

// Always run when this file is executed
transformRegistrationsToOrders()
  .then(result => {
    console.log('\n✅ Transformation completed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Transformation failed:', error);
  });