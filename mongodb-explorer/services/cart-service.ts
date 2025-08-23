/**
 * Cart Service
 * Handles registration to cart conversion and cart operations
 * for the e-commerce architecture
 */

import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// ============================================================================
// TYPES
// ============================================================================

export interface RegistrationData {
  registrationId: string;
  registrationType: 'individual' | 'lodge' | 'grandLodge' | 'masonicOrder';
  registrationDate: Date;
  confirmationNumber: string;
  bookingContact: BookingContact;
  attendees?: Attendee[];
  lodgeDetails?: LodgeDetails;
  grandLodgeDetails?: GrandLodgeDetails;
  masonicOrderDetails?: MasonicOrderDetails;
  tickets?: Ticket[];
  metadata?: Record<string, any>;
}

export interface BookingContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobile?: string;
  businessName?: string;
  businessNumber?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface Attendee {
  attendeeId: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  lodgeName?: string;
  lodgeNumber?: string;
  rank?: string;
  grandLodge?: string;
  dietaryRequirements?: string;
  specialNeeds?: string;
  relationship?: Array<{
    type: string;
    partnerOf: string;
    partnerId: string;
  }>;
  [key: string]: any; // Allow additional fields
}

export interface LodgeDetails {
  lodgeId?: string;
  lodgeName: string;
  lodgeNumber?: string;
  lodgeAddress?: string;
  lodgeCity?: string;
  lodgeState?: string;
  lodgePostcode?: string;
  lodgeCountry?: string;
}

export interface GrandLodgeDetails {
  grandLodgeId?: string;
  grandLodgeName: string;
  grandLodgeJurisdiction?: string;
  grandLodgeCountry?: string;
}

export interface MasonicOrderDetails {
  orderName: string;
  orderType?: string;
  chapterName?: string;
}

export interface Ticket {
  ticketId: string;
  eventId: string;
  eventName: string;
  price: number;
  attendeeId?: string; // For individual registrations
}

export interface Customer {
  customerId: string;
  name: string;
  type: 'person' | 'organisation';
  email: string;
  phone?: string;
  businessName?: string;
  businessNumber?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postCode?: string;
  country?: string;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  subtotal: number;
  parentItemId?: string; // For bundled items
  formData?: Record<string, any>;
  metadata?: Record<string, any>;
  addedAt: Date;
  updatedAt: Date;
}

export interface Cart {
  cartId: string;
  customer: Customer;
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: 'active' | 'abandoned' | 'converted' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CART SERVICE CLASS
// ============================================================================

export class CartService {
  private db: Db;
  private cartsCollection: Collection;
  private productsCollection: Collection;
  private bundleProductCache: any = null;

  constructor(db: Db) {
    this.db = db;
    this.cartsCollection = db.collection('carts');
    this.productsCollection = db.collection('products');
  }

  /**
   * Get or cache the bundle product
   */
  private async getBundleProduct() {
    if (!this.bundleProductCache) {
      this.bundleProductCache = await this.productsCollection.findOne({ type: 'bundle' });
      if (!this.bundleProductCache) {
        throw new Error('Bundle product not found in database');
      }
    }
    return this.bundleProductCache;
  }

  /**
   * Convert a registration to a cart
   */
  async registrationToCart(registration: RegistrationData): Promise<Cart> {
    const bundleProduct = await this.getBundleProduct();
    
    // Create customer from booking contact
    const customer = this.createCustomer(registration.bookingContact);
    
    // Create cart items based on registration type
    const cartItems = registration.registrationType === 'individual'
      ? await this.createIndividualCartItems(registration, bundleProduct)
      : await this.createOrganizationCartItems(registration, bundleProduct);
    
    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = 0; // Calculate based on your tax rules
    const discount = 0; // Apply any discounts
    const total = subtotal + tax - discount;
    
    // Create cart
    const cart: Cart = {
      cartId: uuidv4(),
      customer,
      cartItems,
      subtotal,
      tax,
      discount,
      total,
      currency: 'AUD',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return cart;
  }

  /**
   * Create customer object from booking contact
   */
  private createCustomer(bookingContact: BookingContact): Customer {
    const hasBusinessName = bookingContact.businessName && bookingContact.businessName.trim() !== '';
    
    return {
      customerId: uuidv4(),
      name: `${bookingContact.firstName} ${bookingContact.lastName}`.trim(),
      type: hasBusinessName ? 'organisation' : 'person',
      email: bookingContact.email,
      phone: bookingContact.phone || bookingContact.mobile,
      businessName: bookingContact.businessName,
      businessNumber: bookingContact.businessNumber,
      addressLine1: bookingContact.addressLine1,
      city: bookingContact.city,
      state: bookingContact.state,
      postCode: bookingContact.postcode,
      country: bookingContact.country || 'Australia'
    };
  }

  /**
   * Create cart items for individual registration (one bundle per attendee)
   */
  private async createIndividualCartItems(
    registration: RegistrationData, 
    bundleProduct: any
  ): Promise<CartItem[]> {
    const cartItems: CartItem[] = [];
    const attendees = registration.attendees || [];
    
    for (const attendee of attendees) {
      // Determine variant based on attendee type
      const isGuest = !attendee.rank || attendee.rank === '';
      const variantType = isGuest ? 'guest' : 'mason';
      
      const variant = bundleProduct.variants.find((v: any) => 
        v.options.registration === 'individual' && 
        v.options.attendee === variantType
      );
      
      if (!variant) {
        console.warn(`No variant found for individual-${variantType}`);
        continue;
      }
      
      // Create bundle item for this attendee
      const bundleItem: CartItem = {
        cartItemId: uuidv4(),
        productId: bundleProduct.productId,
        variantId: variant.variantId,
        quantity: 1,
        price: variant.price || 0,
        subtotal: variant.price || 0,
        formData: { ...attendee }, // Copy ALL attendee data to formData
        metadata: {
          registrationId: registration.registrationId,
          registrationType: 'individual',
          attendeeType: variantType
        },
        addedAt: new Date(),
        updatedAt: new Date()
      };
      
      cartItems.push(bundleItem);
      
      // Add child items for this attendee's tickets
      const attendeeTickets = registration.tickets?.filter(t => 
        t.attendeeId === attendee.attendeeId
      ) || [];
      
      for (const ticket of attendeeTickets) {
        const eventProduct = await this.productsCollection.findOne({
          sourceId: ticket.eventId,
          type: 'product'
        });
        
        if (eventProduct) {
          const childItem: CartItem = {
            cartItemId: uuidv4(),
            productId: eventProduct.productId,
            variantId: eventProduct.variants?.[0]?.variantId || '',
            quantity: 1,
            price: ticket.price,
            subtotal: ticket.price,
            parentItemId: bundleItem.cartItemId, // Link to parent bundle
            metadata: {
              eventName: ticket.eventName,
              ticketId: ticket.ticketId
            },
            addedAt: new Date(),
            updatedAt: new Date()
          };
          
          cartItems.push(childItem);
        }
      }
    }
    
    return cartItems;
  }

  /**
   * Create cart items for organization registration (single bundle)
   */
  private async createOrganizationCartItems(
    registration: RegistrationData, 
    bundleProduct: any
  ): Promise<CartItem[]> {
    const cartItems: CartItem[] = [];
    
    // Determine variant based on registration type
    const variant = bundleProduct.variants.find((v: any) => 
      v.options.registration === registration.registrationType && 
      v.options.attendee === 'member'
    );
    
    if (!variant) {
      throw new Error(`No variant found for ${registration.registrationType}-member`);
    }
    
    // Build formData with organization details only
    const formData: any = {
      registrationType: registration.registrationType,
      registrationId: registration.registrationId,
      registrationDate: registration.registrationDate,
      confirmationNumber: registration.confirmationNumber
    };
    
    // Add type-specific details
    if (registration.registrationType === 'lodge' && registration.lodgeDetails) {
      formData.lodgeDetails = registration.lodgeDetails;
    } else if (registration.registrationType === 'grandLodge' && registration.grandLodgeDetails) {
      formData.grandLodgeDetails = registration.grandLodgeDetails;
    } else if (registration.registrationType === 'masonicOrder' && registration.masonicOrderDetails) {
      formData.masonicOrderDetails = registration.masonicOrderDetails;
    }
    
    // Add attendee list for reference (not booking contact)
    if (registration.attendees && registration.attendees.length > 0) {
      formData.attendees = registration.attendees;
      formData.attendeeCount = registration.attendees.length;
    }
    
    // Add any additional metadata
    if (registration.metadata) {
      Object.assign(formData, registration.metadata);
    }
    
    // Create single bundle item for organization
    const bundleItem: CartItem = {
      cartItemId: uuidv4(),
      productId: bundleProduct.productId,
      variantId: variant.variantId,
      quantity: registration.attendees?.length || 1,
      price: variant.price || 0,
      subtotal: (variant.price || 0) * (registration.attendees?.length || 1),
      formData,
      metadata: {
        registrationId: registration.registrationId,
        registrationType: registration.registrationType
      },
      addedAt: new Date(),
      updatedAt: new Date()
    };
    
    cartItems.push(bundleItem);
    
    // Add child items for organization's tickets
    const tickets = registration.tickets || [];
    
    for (const ticket of tickets) {
      const eventProduct = await this.productsCollection.findOne({
        sourceId: ticket.eventId,
        type: 'product'
      });
      
      if (eventProduct) {
        const childItem: CartItem = {
          cartItemId: uuidv4(),
          productId: eventProduct.productId,
          variantId: eventProduct.variants?.[0]?.variantId || '',
          quantity: 1,
          price: ticket.price,
          subtotal: ticket.price,
          parentItemId: bundleItem.cartItemId, // Link to parent bundle
          metadata: {
            eventName: ticket.eventName,
            ticketId: ticket.ticketId
          },
          addedAt: new Date(),
          updatedAt: new Date()
        };
        
        cartItems.push(childItem);
      }
    }
    
    return cartItems;
  }

  /**
   * Save cart to database
   */
  async saveCart(cart: Cart): Promise<void> {
    await this.cartsCollection.insertOne(cart);
  }

  /**
   * Update existing cart
   */
  async updateCart(cartId: string, updates: Partial<Cart>): Promise<void> {
    await this.cartsCollection.updateOne(
      { cartId },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Get cart by ID
   */
  async getCart(cartId: string): Promise<Cart | null> {
    return await this.cartsCollection.findOne({ cartId }) as Cart | null;
  }

  /**
   * Convert cart to order
   */
  async convertCartToOrder(cartId: string, paymentInfo: any): Promise<any> {
    const cart = await this.getCart(cartId);
    if (!cart) {
      throw new Error('Cart not found');
    }
    
    // Create order from cart
    const order = {
      orderId: uuidv4(),
      orderNumber: this.generateOrderNumber(),
      cartId: cart.cartId,
      customer: cart.customer,
      orderItems: cart.cartItems.map(item => ({
        ...item,
        orderItemId: uuidv4(),
        status: 'pending'
      })),
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      total: cart.total,
      currency: cart.currency,
      payment: paymentInfo,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'unfulfilled',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save order
    await this.db.collection('orders').insertOne(order);
    
    // Update cart status
    await this.updateCart(cartId, { status: 'converted' });
    
    return order;
  }

  /**
   * Generate order number
   */
  private generateOrderNumber(): string {
    const prefix = 'ORD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  }
}