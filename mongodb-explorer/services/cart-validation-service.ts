/**
 * Cart Validation Service
 * Validates cart structure and data integrity
 */

import { Cart, CartItem, Customer } from './cart-service';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export class CartValidationService {
  
  /**
   * Validate complete cart structure
   */
  validateCart(cart: Cart): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate cart basics
    this.validateCartBasics(cart, errors, warnings);
    
    // Validate customer
    this.validateCustomer(cart.customer, errors, warnings);
    
    // Validate cart items
    this.validateCartItems(cart.cartItems, errors, warnings);
    
    // Validate pricing
    this.validatePricing(cart, errors, warnings);
    
    // Validate registration-specific rules
    this.validateRegistrationRules(cart, errors, warnings);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate basic cart fields
   */
  private validateCartBasics(cart: Cart, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!cart.cartId) {
      errors.push({
        field: 'cartId',
        message: 'Cart ID is required',
        severity: 'critical'
      });
    }
    
    if (!cart.status) {
      errors.push({
        field: 'status',
        message: 'Cart status is required',
        severity: 'error'
      });
    }
    
    if (!cart.currency) {
      warnings.push({
        field: 'currency',
        message: 'Currency not specified, defaulting to AUD'
      });
    }
    
    if (!cart.createdAt) {
      errors.push({
        field: 'createdAt',
        message: 'Cart creation date is required',
        severity: 'error'
      });
    }
  }
  
  /**
   * Validate customer object
   */
  private validateCustomer(customer: Customer | undefined, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!customer) {
      errors.push({
        field: 'customer',
        message: 'Customer object is required',
        severity: 'critical'
      });
      return;
    }
    
    if (!customer.customerId) {
      errors.push({
        field: 'customer.customerId',
        message: 'Customer ID is required',
        severity: 'critical'
      });
    }
    
    if (!customer.email) {
      errors.push({
        field: 'customer.email',
        message: 'Customer email is required',
        severity: 'error'
      });
    } else if (!this.isValidEmail(customer.email)) {
      errors.push({
        field: 'customer.email',
        message: 'Customer email is invalid',
        severity: 'error'
      });
    }
    
    if (!customer.name) {
      errors.push({
        field: 'customer.name',
        message: 'Customer name is required',
        severity: 'error'
      });
    }
    
    if (!customer.type) {
      errors.push({
        field: 'customer.type',
        message: 'Customer type is required',
        severity: 'error'
      });
    } else if (!['person', 'organisation'].includes(customer.type)) {
      errors.push({
        field: 'customer.type',
        message: 'Customer type must be "person" or "organisation"',
        severity: 'error'
      });
    }
    
    // Validate organisation-specific fields
    if (customer.type === 'organisation' && !customer.businessName) {
      warnings.push({
        field: 'customer.businessName',
        message: 'Organisation customer should have businessName'
      });
    }
    
    if (customer.type === 'person' && customer.businessName) {
      warnings.push({
        field: 'customer.type',
        message: 'Customer has businessName but type is "person", should be "organisation"'
      });
    }
  }
  
  /**
   * Validate cart items
   */
  private validateCartItems(cartItems: CartItem[], errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!cartItems || cartItems.length === 0) {
      errors.push({
        field: 'cartItems',
        message: 'Cart must have at least one item',
        severity: 'error'
      });
      return;
    }
    
    const bundleItems = cartItems.filter(item => !item.parentItemId);
    const childItems = cartItems.filter(item => item.parentItemId);
    
    // Validate each bundle item
    bundleItems.forEach((item, index) => {
      this.validateCartItem(item, index, errors, warnings);
      
      // Check for orphaned parent references
      const children = childItems.filter(child => child.parentItemId === item.cartItemId);
      if (children.length === 0 && bundleItems.length === 1) {
        warnings.push({
          field: `cartItems[${index}]`,
          message: 'Bundle item has no child items (events)'
        });
      }
    });
    
    // Check for orphaned child items
    childItems.forEach((item, index) => {
      const parent = bundleItems.find(bundle => bundle.cartItemId === item.parentItemId);
      if (!parent) {
        errors.push({
          field: `cartItems[${index}].parentItemId`,
          message: `Child item references non-existent parent: ${item.parentItemId}`,
          severity: 'error'
        });
      }
    });
  }
  
  /**
   * Validate individual cart item
   */
  private validateCartItem(item: CartItem, index: number, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!item.cartItemId) {
      errors.push({
        field: `cartItems[${index}].cartItemId`,
        message: 'Cart item ID is required',
        severity: 'critical'
      });
    }
    
    if (!item.productId) {
      errors.push({
        field: `cartItems[${index}].productId`,
        message: 'Product ID is required',
        severity: 'error'
      });
    }
    
    if (!item.variantId) {
      errors.push({
        field: `cartItems[${index}].variantId`,
        message: 'Variant ID is required',
        severity: 'error'
      });
    }
    
    if (item.quantity <= 0) {
      errors.push({
        field: `cartItems[${index}].quantity`,
        message: 'Quantity must be greater than 0',
        severity: 'error'
      });
    }
    
    if (item.price < 0) {
      errors.push({
        field: `cartItems[${index}].price`,
        message: 'Price cannot be negative',
        severity: 'error'
      });
    }
    
    if (Math.abs(item.subtotal - (item.price * item.quantity)) > 0.01) {
      errors.push({
        field: `cartItems[${index}].subtotal`,
        message: `Subtotal mismatch: expected ${item.price * item.quantity}, got ${item.subtotal}`,
        severity: 'error'
      });
    }
  }
  
  /**
   * Validate pricing calculations
   */
  private validatePricing(cart: Cart, errors: ValidationError[], warnings: ValidationWarning[]) {
    const calculatedSubtotal = cart.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    
    if (Math.abs(calculatedSubtotal - cart.subtotal) > 0.01) {
      errors.push({
        field: 'subtotal',
        message: `Subtotal mismatch: calculated ${calculatedSubtotal}, stored ${cart.subtotal}`,
        severity: 'error'
      });
    }
    
    if (cart.tax < 0) {
      errors.push({
        field: 'tax',
        message: 'Tax cannot be negative',
        severity: 'error'
      });
    }
    
    if (cart.discount < 0) {
      errors.push({
        field: 'discount',
        message: 'Discount cannot be negative',
        severity: 'error'
      });
    }
    
    const calculatedTotal = cart.subtotal + cart.tax - cart.discount;
    if (Math.abs(calculatedTotal - cart.total) > 0.01) {
      errors.push({
        field: 'total',
        message: `Total mismatch: calculated ${calculatedTotal}, stored ${cart.total}`,
        severity: 'error'
      });
    }
  }
  
  /**
   * Validate registration-specific business rules
   */
  private validateRegistrationRules(cart: Cart, errors: ValidationError[], warnings: ValidationWarning[]) {
    const bundleItems = cart.cartItems.filter(item => !item.parentItemId);
    
    // Check registration type from metadata
    const registrationType = bundleItems[0]?.metadata?.registrationType;
    
    if (!registrationType) {
      warnings.push({
        field: 'metadata.registrationType',
        message: 'Registration type not found in metadata'
      });
      return;
    }
    
    if (registrationType === 'individual') {
      // Individual registration rules
      this.validateIndividualRegistration(cart, bundleItems, errors, warnings);
    } else if (['lodge', 'grandLodge', 'masonicOrder'].includes(registrationType)) {
      // Organization registration rules
      this.validateOrganizationRegistration(cart, bundleItems, registrationType, errors, warnings);
    }
  }
  
  /**
   * Validate individual registration structure
   */
  private validateIndividualRegistration(
    cart: Cart, 
    bundleItems: CartItem[], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) {
    // Should have one bundle per attendee
    bundleItems.forEach((item, index) => {
      if (!item.formData) {
        errors.push({
          field: `bundleItems[${index}].formData`,
          message: 'Individual registration bundle must have formData',
          severity: 'error'
        });
        return;
      }
      
      // Check required attendee fields
      if (!item.formData.attendeeId) {
        errors.push({
          field: `bundleItems[${index}].formData.attendeeId`,
          message: 'Attendee ID is required in formData',
          severity: 'error'
        });
      }
      
      if (!item.formData.firstName || !item.formData.lastName) {
        errors.push({
          field: `bundleItems[${index}].formData`,
          message: 'Attendee name is required in formData',
          severity: 'error'
        });
      }
      
      // Warn about missing optional but important fields
      if (!item.formData.email) {
        warnings.push({
          field: `bundleItems[${index}].formData.email`,
          message: 'Attendee email is missing'
        });
      }
      
      if (item.formData.rank && !item.formData.lodgeName) {
        warnings.push({
          field: `bundleItems[${index}].formData.lodgeName`,
          message: 'Mason attendee should have lodge information'
        });
      }
    });
  }
  
  /**
   * Validate organization registration structure
   */
  private validateOrganizationRegistration(
    cart: Cart, 
    bundleItems: CartItem[], 
    registrationType: string,
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) {
    // Should have exactly one bundle item
    if (bundleItems.length !== 1) {
      errors.push({
        field: 'bundleItems',
        message: `Organization registration should have exactly 1 bundle item, found ${bundleItems.length}`,
        severity: 'error'
      });
    }
    
    const bundleItem = bundleItems[0];
    
    if (!bundleItem?.formData) {
      errors.push({
        field: 'bundleItem.formData',
        message: 'Organization registration must have formData',
        severity: 'error'
      });
      return;
    }
    
    // Check for organization details based on type
    if (registrationType === 'lodge') {
      if (!bundleItem.formData.lodgeDetails && !bundleItem.formData.lodgeName) {
        warnings.push({
          field: 'bundleItem.formData',
          message: 'Lodge registration should have lodge details'
        });
      }
    } else if (registrationType === 'grandLodge') {
      if (!bundleItem.formData.grandLodgeDetails && !bundleItem.formData.grandLodgeName) {
        warnings.push({
          field: 'bundleItem.formData',
          message: 'Grand Lodge registration should have grand lodge details'
        });
      }
    } else if (registrationType === 'masonicOrder') {
      if (!bundleItem.formData.masonicOrderDetails && !bundleItem.formData.orderName) {
        warnings.push({
          field: 'bundleItem.formData',
          message: 'Masonic Order registration should have order details'
        });
      }
    }
    
    // Check for attendee list
    if (bundleItem.formData.attendees) {
      if (!Array.isArray(bundleItem.formData.attendees)) {
        errors.push({
          field: 'bundleItem.formData.attendees',
          message: 'Attendees must be an array',
          severity: 'error'
        });
      } else if (bundleItem.quantity !== bundleItem.formData.attendees.length) {
        warnings.push({
          field: 'bundleItem.quantity',
          message: `Quantity (${bundleItem.quantity}) doesn't match attendee count (${bundleItem.formData.attendees.length})`
        });
      }
    }
  }
  
  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Validate cart for order conversion
   */
  validateForOrderConversion(cart: Cart): ValidationResult {
    const result = this.validateCart(cart);
    
    // Additional checks for order conversion
    if (cart.status !== 'active') {
      result.errors.push({
        field: 'status',
        message: 'Only active carts can be converted to orders',
        severity: 'error'
      });
    }
    
    if (cart.total <= 0) {
      result.warnings.push({
        field: 'total',
        message: 'Cart total is 0 or negative'
      });
    }
    
    if (!cart.customer?.email) {
      result.errors.push({
        field: 'customer.email',
        message: 'Customer email is required for order conversion',
        severity: 'critical'
      });
    }
    
    result.valid = result.errors.length === 0;
    return result;
  }
}