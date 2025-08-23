/**
 * Cart API Example
 * Example implementation of cart operations using the services
 */

import { MongoClient, Db } from 'mongodb';
import { CartService, RegistrationData } from '../services/cart-service';
import { CartValidationService } from '../services/cart-validation-service';
import { MigrationUtilities } from '../services/migration-utilities';

// Example Express.js route handlers (or similar framework)

export class CartAPI {
  private db: Db;
  private cartService: CartService;
  private validationService: CartValidationService;
  private migrationUtils: MigrationUtilities;
  
  constructor(db: Db) {
    this.db = db;
    this.cartService = new CartService(db);
    this.validationService = new CartValidationService();
    this.migrationUtils = new MigrationUtilities(db);
  }
  
  /**
   * Create cart from new registration
   * POST /api/carts/from-registration
   */
  async createCartFromRegistration(req: any, res: any) {
    try {
      const registrationData: RegistrationData = req.body;
      
      // Validate input
      if (!registrationData.registrationId) {
        return res.status(400).json({
          error: 'Registration ID is required'
        });
      }
      
      // Create cart
      const cart = await this.cartService.registrationToCart(registrationData);
      
      // Validate cart structure
      const validation = this.validationService.validateCart(cart);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Cart validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
      
      // Save cart
      await this.cartService.saveCart(cart);
      
      return res.status(201).json({
        success: true,
        cartId: cart.cartId,
        cart
      });
      
    } catch (error) {
      console.error('Error creating cart:', error);
      return res.status(500).json({
        error: 'Failed to create cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Get cart by ID
   * GET /api/carts/:cartId
   */
  async getCart(req: any, res: any) {
    try {
      const { cartId } = req.params;
      
      const cart = await this.cartService.getCart(cartId);
      
      if (!cart) {
        return res.status(404).json({
          error: 'Cart not found'
        });
      }
      
      // Validate and include validation results
      const validation = this.validationService.validateCart(cart);
      
      return res.json({
        cart,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
      
    } catch (error) {
      console.error('Error getting cart:', error);
      return res.status(500).json({
        error: 'Failed to get cart'
      });
    }
  }
  
  /**
   * Update cart
   * PUT /api/carts/:cartId
   */
  async updateCart(req: any, res: any) {
    try {
      const { cartId } = req.params;
      const updates = req.body;
      
      // Get existing cart
      const existingCart = await this.cartService.getCart(cartId);
      if (!existingCart) {
        return res.status(404).json({
          error: 'Cart not found'
        });
      }
      
      // Merge updates
      const updatedCart = { ...existingCart, ...updates };
      
      // Validate updated cart
      const validation = this.validationService.validateCart(updatedCart);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Cart validation failed',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
      
      // Save updates
      await this.cartService.updateCart(cartId, updates);
      
      return res.json({
        success: true,
        cart: updatedCart
      });
      
    } catch (error) {
      console.error('Error updating cart:', error);
      return res.status(500).json({
        error: 'Failed to update cart'
      });
    }
  }
  
  /**
   * Convert cart to order
   * POST /api/carts/:cartId/convert-to-order
   */
  async convertToOrder(req: any, res: any) {
    try {
      const { cartId } = req.params;
      const { paymentInfo } = req.body;
      
      // Get cart
      const cart = await this.cartService.getCart(cartId);
      if (!cart) {
        return res.status(404).json({
          error: 'Cart not found'
        });
      }
      
      // Validate for order conversion
      const validation = this.validationService.validateForOrderConversion(cart);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Cart cannot be converted to order',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
      
      // Convert to order
      const order = await this.cartService.convertCartToOrder(cartId, paymentInfo);
      
      return res.json({
        success: true,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        order
      });
      
    } catch (error) {
      console.error('Error converting to order:', error);
      return res.status(500).json({
        error: 'Failed to convert cart to order'
      });
    }
  }
  
  /**
   * Validate cart
   * POST /api/carts/:cartId/validate
   */
  async validateCart(req: any, res: any) {
    try {
      const { cartId } = req.params;
      
      const cart = await this.cartService.getCart(cartId);
      if (!cart) {
        return res.status(404).json({
          error: 'Cart not found'
        });
      }
      
      const validation = this.validationService.validateCart(cart);
      
      return res.json({
        cartId,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      });
      
    } catch (error) {
      console.error('Error validating cart:', error);
      return res.status(500).json({
        error: 'Failed to validate cart'
      });
    }
  }
  
  /**
   * Migrate registrations to carts (admin endpoint)
   * POST /api/admin/migrate-registrations
   */
  async migrateRegistrations(req: any, res: any) {
    try {
      const options = req.body || {};
      
      const result = await this.migrationUtils.migrateRegistrationsToCarts(options);
      
      return res.json({
        success: true,
        result
      });
      
    } catch (error) {
      console.error('Error migrating registrations:', error);
      return res.status(500).json({
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Update formData from attendees (admin endpoint)
   * POST /api/admin/update-formdata
   */
  async updateFormData(req: any, res: any) {
    try {
      const result = await this.migrationUtils.updateFormDataFromAttendees();
      
      return res.json({
        success: true,
        result
      });
      
    } catch (error) {
      console.error('Error updating formData:', error);
      return res.status(500).json({
        error: 'Update failed'
      });
    }
  }
  
  /**
   * Validate all carts (admin endpoint)
   * GET /api/admin/validate-all-carts
   */
  async validateAllCarts(req: any, res: any) {
    try {
      const result = await this.migrationUtils.validateAllCarts();
      
      return res.json({
        success: true,
        result
      });
      
    } catch (error) {
      console.error('Error validating carts:', error);
      return res.status(500).json({
        error: 'Validation failed'
      });
    }
  }
}

// Example usage with Express.js
export function setupCartRoutes(app: any, db: Db) {
  const cartAPI = new CartAPI(db);
  
  // Registration to cart
  app.post('/api/carts/from-registration', (req: any, res: any) => 
    cartAPI.createCartFromRegistration(req, res)
  );
  
  // Cart CRUD
  app.get('/api/carts/:cartId', (req: any, res: any) => 
    cartAPI.getCart(req, res)
  );
  
  app.put('/api/carts/:cartId', (req: any, res: any) => 
    cartAPI.updateCart(req, res)
  );
  
  // Cart operations
  app.post('/api/carts/:cartId/convert-to-order', (req: any, res: any) => 
    cartAPI.convertToOrder(req, res)
  );
  
  app.post('/api/carts/:cartId/validate', (req: any, res: any) => 
    cartAPI.validateCart(req, res)
  );
  
  // Admin endpoints
  app.post('/api/admin/migrate-registrations', (req: any, res: any) => 
    cartAPI.migrateRegistrations(req, res)
  );
  
  app.post('/api/admin/update-formdata', (req: any, res: any) => 
    cartAPI.updateFormData(req, res)
  );
  
  app.get('/api/admin/validate-all-carts', (req: any, res: any) => 
    cartAPI.validateAllCarts(req, res)
  );
}

// Example standalone usage
async function exampleUsage() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  const cartService = new CartService(db);
  const validationService = new CartValidationService();
  
  // Example: Create cart from registration
  const registrationData: RegistrationData = {
    registrationId: 'REG-123',
    registrationType: 'individual',
    registrationDate: new Date(),
    confirmationNumber: 'CONF-123',
    bookingContact: {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '0400000000'
    },
    attendees: [
      {
        attendeeId: 'ATT-1',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        rank: 'MM',
        lodgeName: 'Example Lodge',
        lodgeNumber: '123'
      },
      {
        attendeeId: 'ATT-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      }
    ],
    tickets: []
  };
  
  // Create cart
  const cart = await cartService.registrationToCart(registrationData);
  
  // Validate
  const validation = validationService.validateCart(cart);
  console.log('Cart valid:', validation.valid);
  
  if (validation.valid) {
    // Save cart
    await cartService.saveCart(cart);
    console.log('Cart saved:', cart.cartId);
  }
  
  await client.close();
}