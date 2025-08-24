/**
 * Registration to Cart Comparison Viewer
 * Provides visual comparison between original registration and transformed cart
 */

import { MongoClient, Db } from 'mongodb';
import { Cart, CartItem } from './cart-service';
import { ValidationResult } from './cart-validation-service';
import * as fs from 'fs';
import * as path from 'path';

export interface ComparisonResult {
  registrationId: string;
  registrationType: string;
  original: {
    registration: any;
    attendees: any[];
    tickets: any[];
  };
  transformed: {
    cart: Cart;
    validation: ValidationResult;
  };
  mapping: {
    customer: CustomerMapping;
    items: ItemMapping[];
    pricing: PricingMapping;
  };
  differences: Difference[];
}

export interface CustomerMapping {
  source: string;
  fields: Array<{
    from: string;
    to: string;
    originalValue: any;
    transformedValue: any;
    status: 'matched' | 'transformed' | 'missing';
  }>;
}

export interface ItemMapping {
  type: 'bundle' | 'event';
  sourceId: string;
  cartItemId: string;
  quantity: { original: number; transformed: number };
  price: { original: number; transformed: number };
  formData: { added: string[]; missing: string[]; matched: string[] };
}

export interface PricingMapping {
  originalTotal: number;
  transformedTotal: number;
  difference: number;
  breakdown: {
    subtotal: { original: number; transformed: number };
    tax: { original: number; transformed: number };
    discount: { original: number; transformed: number };
  };
}

export interface Difference {
  field: string;
  type: 'added' | 'removed' | 'modified' | 'restructured';
  description: string;
  original?: any;
  transformed?: any;
}

export interface FieldValidationResult {
  field: string;
  category: string;
  status: 'transferred' | 'missing' | 'transformed' | 'added';
  originalValue: any;
  transformedValue: any;
  location: {
    original: string;
    transformed: string;
  };
  severity: 'low' | 'medium' | 'high';
}

export interface FieldValidationReport {
  summary: {
    totalFields: number;
    attendeeFields: number;
    ticketFields: number;
    transferredFields: number;
    missingFields: number;
    transformedFields: number;
    addedFields: number;
    transferRate: number;
  };
  details: {
    attendeeValidation: FieldValidationResult[];
    ticketValidation: FieldValidationResult[];
  };
  categories: {
    [categoryName: string]: {
      total: number;
      transferred: number;
      missing: number;
      transferRate: number;
    };
  };
  criticalMissing: FieldValidationResult[];
  recommendations: string[];
}

export class ComparisonViewer {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Compare a registration with its transformed cart
   */
  async compareRegistrationToCart(registrationId: string): Promise<ComparisonResult | null> {
    // Get original registration
    const registration = await this.db.collection('registrations').findOne({ registrationId });
    if (!registration) {
      console.error(`Registration ${registrationId} not found`);
      return null;
    }

    // Get transformed cart
    const cart = await this.db.collection('carts').findOne({
      'cartItems.metadata.registrationId': registrationId
    }) as unknown as Cart | null;
    
    if (!cart) {
      console.error(`Cart for registration ${registrationId} not found`);
      return null;
    }

    // Get attendees and tickets
    const attendees = await this.db.collection('attendees')
      .find({ registrationId })
      .toArray();
    
    const tickets = await this.db.collection('tickets')
      .find({ registrationId })
      .toArray();

    // Validate cart
    const { CartValidationService } = await import('./cart-validation-service');
    const validationService = new CartValidationService();
    const validation = validationService.validateCart(cart);

    // Create comparison
    const comparison: ComparisonResult = {
      registrationId,
      registrationType: registration.registrationType || 'unknown',
      original: {
        registration,
        attendees,
        tickets
      },
      transformed: {
        cart,
        validation
      },
      mapping: this.createMapping(registration, attendees, tickets, cart),
      differences: this.findDifferences(registration, attendees, tickets, cart)
    };

    return comparison;
  }

  /**
   * Create field mapping between registration and cart
   */
  private createMapping(
    registration: any, 
    attendees: any[], 
    tickets: any[], 
    cart: Cart
  ): ComparisonResult['mapping'] {
    // Customer mapping
    const customerMapping = this.mapCustomer(registration, cart);
    
    // Item mapping
    const itemMappings = this.mapItems(registration, attendees, tickets, cart);
    
    // Pricing mapping
    const pricingMapping = this.mapPricing(registration, tickets, cart);

    return {
      customer: customerMapping,
      items: itemMappings,
      pricing: pricingMapping
    };
  }

  /**
   * Map customer fields
   */
  private mapCustomer(registration: any, cart: Cart): CustomerMapping {
    const bookingContact = registration.bookingContact || {};
    const customer = cart.customer;
    
    const fields = [
      {
        from: 'bookingContact.email',
        to: 'customer.email',
        originalValue: bookingContact.email,
        transformedValue: customer?.email,
        status: (bookingContact.email === customer?.email ? 'matched' : 'transformed') as any
      },
      {
        from: 'bookingContact.firstName + lastName',
        to: 'customer.name',
        originalValue: `${bookingContact.firstName || ''} ${bookingContact.lastName || ''}`.trim(),
        transformedValue: customer?.name,
        status: 'transformed' as any
      },
      {
        from: 'bookingContact.businessName',
        to: 'customer.type',
        originalValue: bookingContact.businessName,
        transformedValue: customer?.type,
        status: (bookingContact.businessName ? 'transformed' : 'matched') as any
      }
    ];

    return {
      source: 'bookingContact',
      fields
    };
  }

  /**
   * Map cart items
   */
  private mapItems(
    registration: any, 
    attendees: any[], 
    tickets: any[], 
    cart: Cart
  ): ItemMapping[] {
    const mappings: ItemMapping[] = [];
    
    // Map bundle items
    const bundleItems = cart.cartItems.filter(item => !item.parentItemId);
    
    bundleItems.forEach(bundleItem => {
      const attendeeMatch = attendees.find(a => 
        a.attendeeId === bundleItem.formData?.attendeeId
      );
      
      const mapping: ItemMapping = {
        type: 'bundle',
        sourceId: attendeeMatch?.attendeeId || 'organization',
        cartItemId: bundleItem.cartItemId,
        quantity: {
          original: registration.registrationType === 'individual' ? 1 : attendees.length,
          transformed: bundleItem.quantity
        },
        price: {
          original: 0, // Original didn't have bundle pricing
          transformed: bundleItem.price
        },
        formData: this.compareFormData(attendeeMatch || registration, bundleItem.formData)
      };
      
      mappings.push(mapping);
    });
    
    // Map event items
    const eventItems = cart.cartItems.filter(item => item.parentItemId);
    
    eventItems.forEach(eventItem => {
      const ticketMatch = tickets.find(t => 
        t.ticketId === eventItem.metadata?.ticketId
      );
      
      if (ticketMatch) {
        const mapping: ItemMapping = {
          type: 'event',
          sourceId: ticketMatch.ticketId,
          cartItemId: eventItem.cartItemId,
          quantity: {
            original: 1,
            transformed: eventItem.quantity
          },
          price: {
            original: ticketMatch.price || 0,
            transformed: eventItem.price
          },
          formData: { added: [], missing: [], matched: [] }
        };
        
        mappings.push(mapping);
      }
    });
    
    return mappings;
  }

  /**
   * Compare formData fields
   */
  private compareFormData(original: any, formData: any): {
    added: string[];
    missing: string[];
    matched: string[];
  } {
    const originalKeys = new Set(Object.keys(original || {}));
    const formDataKeys = new Set(Object.keys(formData || {}));
    
    const added = Array.from(formDataKeys).filter(k => !originalKeys.has(k));
    const missing = Array.from(originalKeys).filter(k => !formDataKeys.has(k));
    const matched = Array.from(originalKeys).filter(k => formDataKeys.has(k));
    
    return { added, missing, matched };
  }

  /**
   * Map pricing information
   */
  private mapPricing(registration: any, tickets: any[], cart: Cart): PricingMapping {
    const originalTotal = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
    
    return {
      originalTotal,
      transformedTotal: cart.total,
      difference: cart.total - originalTotal,
      breakdown: {
        subtotal: {
          original: originalTotal,
          transformed: cart.subtotal
        },
        tax: {
          original: 0,
          transformed: cart.tax
        },
        discount: {
          original: 0,
          transformed: cart.discount
        }
      }
    };
  }

  /**
   * Find differences between registration and cart
   */
  private findDifferences(
    registration: any, 
    attendees: any[], 
    tickets: any[], 
    cart: Cart
  ): Difference[] {
    const differences: Difference[] = [];
    
    // Structure changes
    differences.push({
      field: 'structure',
      type: 'restructured',
      description: 'Registration transformed to e-commerce cart structure',
      original: 'registration + attendees + tickets',
      transformed: 'cart + customer + cartItems'
    });
    
    // Customer creation
    differences.push({
      field: 'customer',
      type: 'added',
      description: 'Customer object created from bookingContact',
      transformed: cart.customer
    });
    
    // Bundle items
    const bundleCount = cart.cartItems.filter(i => !i.parentItemId).length;
    differences.push({
      field: 'bundleItems',
      type: 'added',
      description: `${bundleCount} bundle item(s) created`,
      original: 0,
      transformed: bundleCount
    });
    
    // FormData
    if (registration.registrationType === 'individual') {
      differences.push({
        field: 'formData',
        type: 'restructured',
        description: 'Attendee data moved to bundle item formData',
        original: `${attendees.length} separate attendee records`,
        transformed: `${bundleCount} bundle items with formData`
      });
    } else {
      differences.push({
        field: 'formData',
        type: 'restructured',
        description: 'Organization details moved to single bundle formData',
        original: 'Separate organization fields',
        transformed: 'Consolidated in bundle formData'
      });
    }
    
    // Pricing
    if (cart.total !== tickets.reduce((sum, t) => sum + (t.price || 0), 0)) {
      differences.push({
        field: 'pricing',
        type: 'modified',
        description: 'Pricing structure changed',
        original: tickets.reduce((sum, t) => sum + (t.price || 0), 0),
        transformed: cart.total
      });
    }
    
    return differences;
  }

  /**
   * Generate console output for comparison
   */
  formatConsoleOutput(comparison: ComparisonResult): string {
    const lines: string[] = [];
    
    lines.push('\n' + '='.repeat(80));
    lines.push(`REGISTRATION TO CART COMPARISON`);
    lines.push('='.repeat(80));
    
    // Header
    lines.push(`\nRegistration ID: ${comparison.registrationId}`);
    lines.push(`Type: ${comparison.registrationType}`);
    lines.push(`Cart ID: ${comparison.transformed.cart.cartId}`);
    lines.push(`Validation: ${comparison.transformed.validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    
    // Customer Mapping
    lines.push('\n' + '-'.repeat(40));
    lines.push('CUSTOMER MAPPING');
    lines.push('-'.repeat(40));
    comparison.mapping.customer.fields.forEach(field => {
      const status = field.status === 'matched' ? '✓' : '→';
      lines.push(`${status} ${field.from} => ${field.to}`);
      if (field.originalValue !== field.transformedValue) {
        lines.push(`  Original: ${field.originalValue}`);
        lines.push(`  Transformed: ${field.transformedValue}`);
      }
    });
    
    // Item Mapping
    lines.push('\n' + '-'.repeat(40));
    lines.push('ITEM MAPPING');
    lines.push('-'.repeat(40));
    comparison.mapping.items.forEach(item => {
      lines.push(`\n${item.type.toUpperCase()} Item:`);
      lines.push(`  Source: ${item.sourceId}`);
      lines.push(`  Cart Item: ${item.cartItemId}`);
      lines.push(`  Quantity: ${item.quantity.original} → ${item.quantity.transformed}`);
      lines.push(`  Price: $${item.price.original} → $${item.price.transformed}`);
      if (item.formData.matched.length > 0) {
        lines.push(`  FormData: ${item.formData.matched.length} fields matched`);
      }
      if (item.formData.added.length > 0) {
        lines.push(`  Added: ${item.formData.added.join(', ')}`);
      }
      if (item.formData.missing.length > 0) {
        lines.push(`  Missing: ${item.formData.missing.join(', ')}`);
      }
    });
    
    // Pricing
    lines.push('\n' + '-'.repeat(40));
    lines.push('PRICING');
    lines.push('-'.repeat(40));
    lines.push(`Original Total: $${comparison.mapping.pricing.originalTotal}`);
    lines.push(`Transformed Total: $${comparison.mapping.pricing.transformedTotal}`);
    if (comparison.mapping.pricing.difference !== 0) {
      lines.push(`Difference: $${comparison.mapping.pricing.difference}`);
    }
    
    // Differences
    lines.push('\n' + '-'.repeat(40));
    lines.push('KEY DIFFERENCES');
    lines.push('-'.repeat(40));
    comparison.differences.forEach(diff => {
      lines.push(`\n${diff.type.toUpperCase()}: ${diff.field}`);
      lines.push(`  ${diff.description}`);
    });
    
    // Validation Issues
    if (!comparison.transformed.validation.valid) {
      lines.push('\n' + '-'.repeat(40));
      lines.push('VALIDATION ISSUES');
      lines.push('-'.repeat(40));
      comparison.transformed.validation.errors.forEach(error => {
        lines.push(`❌ ${error.field}: ${error.message}`);
      });
      comparison.transformed.validation.warnings.forEach(warning => {
        lines.push(`⚠️ ${warning.field}: ${warning.message}`);
      });
    }
    
    lines.push('\n' + '='.repeat(80));
    
    return lines.join('\n');
  }

  /**
   * Generate HTML report for comparison
   */
  generateHTMLReport(comparison: ComparisonResult): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Registration to Cart Comparison - ${comparison.registrationId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 30px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .header-info {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 3px;
      font-weight: bold;
    }
    .status.valid {
      background: #d4edda;
      color: #155724;
    }
    .status.invalid {
      background: #f8d7da;
      color: #721c24;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    .panel {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
    }
    .panel h3 {
      margin-top: 0;
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .original {
      background: #fff3cd;
    }
    .transformed {
      background: #d1ecf1;
    }
    .mapping-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .mapping-table th,
    .mapping-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .mapping-table th {
      background: #f8f9fa;
      font-weight: 600;
    }
    .field-match {
      color: #28a745;
    }
    .field-transform {
      color: #ffc107;
    }
    .field-missing {
      color: #dc3545;
    }
    .difference {
      margin: 10px 0;
      padding: 10px;
      border-left: 4px solid #17a2b8;
      background: #f8f9fa;
    }
    .difference.added {
      border-color: #28a745;
    }
    .difference.removed {
      border-color: #dc3545;
    }
    .difference.modified {
      border-color: #ffc107;
    }
    .difference.restructured {
      border-color: #17a2b8;
    }
    .json-view {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 400px;
      overflow-y: auto;
    }
    .validation-issues {
      margin: 15px 0;
    }
    .validation-error {
      color: #dc3545;
      margin: 5px 0;
    }
    .validation-warning {
      color: #ffc107;
      margin: 5px 0;
    }
    .price-comparison {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .price-box {
      text-align: center;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    .price-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .price-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Registration to Cart Comparison</h1>
    
    <div class="header-info">
      <div><strong>Registration ID:</strong> ${comparison.registrationId}</div>
      <div><strong>Type:</strong> ${comparison.registrationType}</div>
      <div><strong>Cart ID:</strong> ${comparison.transformed.cart.cartId}</div>
      <div><strong>Validation Status:</strong> 
        <span class="status ${comparison.transformed.validation.valid ? 'valid' : 'invalid'}">
          ${comparison.transformed.validation.valid ? '✓ Valid' : '✗ Invalid'}
        </span>
      </div>
    </div>

    <h2>Customer Mapping</h2>
    <table class="mapping-table">
      <thead>
        <tr>
          <th>Original Field</th>
          <th>Cart Field</th>
          <th>Original Value</th>
          <th>Transformed Value</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${comparison.mapping.customer.fields.map(field => `
          <tr>
            <td>${field.from}</td>
            <td>${field.to}</td>
            <td>${field.originalValue || '-'}</td>
            <td>${field.transformedValue || '-'}</td>
            <td class="field-${field.status}">${field.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Pricing Comparison</h2>
    <div class="price-comparison">
      <div class="price-box">
        <div class="price-label">Original Total</div>
        <div class="price-value">$${comparison.mapping.pricing.originalTotal.toFixed(2)}</div>
      </div>
      <div class="price-box">
        <div class="price-label">Transformed Total</div>
        <div class="price-value">$${comparison.mapping.pricing.transformedTotal.toFixed(2)}</div>
      </div>
      <div class="price-box">
        <div class="price-label">Difference</div>
        <div class="price-value">$${comparison.mapping.pricing.difference.toFixed(2)}</div>
      </div>
    </div>

    <h2>Structure Comparison</h2>
    <div class="comparison-grid">
      <div class="panel original">
        <h3>Original Registration</h3>
        <div class="json-view">
          <pre>${JSON.stringify({
            registrationId: comparison.original.registration.registrationId,
            type: comparison.original.registration.registrationType,
            attendees: comparison.original.attendees.length,
            tickets: comparison.original.tickets.length,
            bookingContact: comparison.original.registration.bookingContact
          }, null, 2)}</pre>
        </div>
      </div>
      <div class="panel transformed">
        <h3>Transformed Cart</h3>
        <div class="json-view">
          <pre>${JSON.stringify({
            cartId: comparison.transformed.cart.cartId,
            customer: comparison.transformed.cart.customer,
            bundleItems: comparison.transformed.cart.cartItems.filter(i => !i.parentItemId).length,
            eventItems: comparison.transformed.cart.cartItems.filter(i => i.parentItemId).length,
            total: comparison.transformed.cart.total
          }, null, 2)}</pre>
        </div>
      </div>
    </div>

    <h2>Key Differences</h2>
    ${comparison.differences.map(diff => `
      <div class="difference ${diff.type}">
        <strong>${diff.field}</strong> (${diff.type})
        <br>${diff.description}
        ${diff.original ? `<br>Original: ${JSON.stringify(diff.original)}` : ''}
        ${diff.transformed ? `<br>Transformed: ${JSON.stringify(diff.transformed)}` : ''}
      </div>
    `).join('')}

    ${!comparison.transformed.validation.valid ? `
      <h2>Validation Issues</h2>
      <div class="validation-issues">
        ${comparison.transformed.validation.errors.map(error => `
          <div class="validation-error">❌ ${error.field}: ${error.message}</div>
        `).join('')}
        ${comparison.transformed.validation.warnings.map(warning => `
          <div class="validation-warning">⚠️ ${warning.field}: ${warning.message}</div>
        `).join('')}
      </div>
    ` : ''}

    <h2>Item Mappings</h2>
    <table class="mapping-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Source ID</th>
          <th>Cart Item ID</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>FormData Status</th>
        </tr>
      </thead>
      <tbody>
        ${comparison.mapping.items.map(item => `
          <tr>
            <td>${item.type}</td>
            <td>${item.sourceId}</td>
            <td>${item.cartItemId}</td>
            <td>${item.quantity.original} → ${item.quantity.transformed}</td>
            <td>$${item.price.original} → $${item.price.transformed}</td>
            <td>
              ${item.formData.matched.length} matched
              ${item.formData.added.length > 0 ? `, ${item.formData.added.length} added` : ''}
              ${item.formData.missing.length > 0 ? `, ${item.formData.missing.length} missing` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `;
    
    return html;
  }

  /**
   * Save comparison report to file
   */
  async saveComparisonReport(
    comparison: ComparisonResult, 
    format: 'json' | 'html' | 'text' = 'html'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(process.cwd(), 'comparison-reports');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let filename: string;
    let content: string;
    
    switch (format) {
      case 'json':
        filename = `comparison-${comparison.registrationId}-${timestamp}.json`;
        content = JSON.stringify(comparison, null, 2);
        break;
      case 'text':
        filename = `comparison-${comparison.registrationId}-${timestamp}.txt`;
        content = this.formatConsoleOutput(comparison);
        break;
      case 'html':
      default:
        filename = `comparison-${comparison.registrationId}-${timestamp}.html`;
        content = this.generateHTMLReport(comparison);
        break;
    }
    
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    
    return filepath;
  }

  /**
   * Compare multiple registrations
   */
  async compareMultiple(
    registrationIds: string[], 
    saveReports = true
  ): Promise<ComparisonResult[]> {
    const comparisons: ComparisonResult[] = [];
    
    for (const id of registrationIds) {
      console.log(`\nComparing registration ${id}...`);
      const comparison = await this.compareRegistrationToCart(id);
      
      if (comparison) {
        comparisons.push(comparison);
        
        // Display in console
        console.log(this.formatConsoleOutput(comparison));
        
        // Save report
        if (saveReports) {
          const filepath = await this.saveComparisonReport(comparison);
          console.log(`Report saved: ${filepath}`);
        }
      }
    }
    
    return comparisons;
  }

  /**
   * Validate field-by-field transfer from attendees and tickets to cart
   */
  validateFieldTransfer(
    attendees: any[],
    tickets: any[],
    cart: Cart
  ): FieldValidationResult[] {
    const validations: FieldValidationResult[] = [];
    
    // Load field analysis data for comprehensive validation
    const fieldAnalysis = this.getFieldAnalysisData();
    
    // Validate attendee fields
    attendees.forEach((attendee, index) => {
      // Root level attendee fields
      const rootFields = fieldAnalysis.fieldMappings.attendeeOnlyFields.fields.rootLevel || [];
      rootFields.forEach(field => {
        const validation = this.validateSingleField(
          field,
          attendee[field],
          cart,
          `attendees[${index}].${field}`,
          'personalInformation'
        );
        if (validation) validations.push(validation);
      });
      
      // Nested attendeeData fields
      if (attendee.attendeeData) {
        const nestedFields = Object.keys(fieldAnalysis.fieldMappings.attendeeOnlyFields.fields.nested_attendeeData || {});
        nestedFields.forEach(field => {
          const validation = this.validateSingleField(
            `attendeeData.${field}`,
            attendee.attendeeData[field],
            cart,
            `attendees[${index}].attendeeData.${field}`,
            this.getFieldCategory(field, fieldAnalysis)
          );
          if (validation) validations.push(validation);
        });
        
        // Handle deeply nested ticket data
        if (attendee.attendeeData.ticket) {
          Object.keys(attendee.attendeeData.ticket).forEach(field => {
            const validation = this.validateSingleField(
              `attendeeData.ticket.${field}`,
              attendee.attendeeData.ticket[field],
              cart,
              `attendees[${index}].attendeeData.ticket.${field}`,
              'eventInformation'
            );
            if (validation) validations.push(validation);
          });
        }
      }
    });
    
    // Validate ticket fields
    tickets.forEach((ticket, index) => {
      const ticketFields = fieldAnalysis.fieldMappings.ticketOnlyFields.fields || [];
      ticketFields.forEach(field => {
        const validation = this.validateSingleField(
          field,
          ticket[field],
          cart,
          `tickets[${index}].${field}`,
          this.getFieldCategory(field, fieldAnalysis)
        );
        if (validation) validations.push(validation);
      });
    });
    
    return validations;
  }

  /**
   * Validate a single field transfer
   */
  private validateSingleField(
    fieldName: string,
    originalValue: any,
    cart: Cart,
    originalLocation: string,
    category: string
  ): FieldValidationResult | null {
    if (originalValue === undefined || originalValue === null || originalValue === '') {
      return null; // Skip empty values
    }
    
    // Search for the value in cart structure
    const transformedLocation = this.findFieldInCart(fieldName, originalValue, cart);
    
    let status: FieldValidationResult['status'];
    let transformedValue: any = null;
    let severity: FieldValidationResult['severity'] = 'low';
    
    if (transformedLocation.found) {
      if (transformedLocation.exactMatch) {
        status = 'transferred';
      } else {
        status = 'transformed';
        transformedValue = transformedLocation.value;
      }
    } else {
      status = 'missing';
      // Set severity based on field importance
      if (this.isCriticalField(fieldName)) {
        severity = 'high';
      } else if (this.isImportantField(fieldName)) {
        severity = 'medium';
      }
    }
    
    return {
      field: fieldName,
      category,
      status,
      originalValue,
      transformedValue: transformedValue || transformedLocation.value,
      location: {
        original: originalLocation,
        transformed: transformedLocation.path || 'not_found'
      },
      severity
    };
  }

  /**
   * Find a field value in the cart structure
   */
  private findFieldInCart(
    fieldName: string,
    originalValue: any,
    cart: Cart
  ): { found: boolean; exactMatch: boolean; value: any; path: string } {
    const searchPaths = [
      // Customer data
      `customer.name`,
      `customer.email`,
      `customer.type`,
      `customer.contactInfo`,
      
      // Cart items formData
      ...cart.cartItems.map((_, i) => `cartItems[${i}].formData`),
      
      // Cart metadata
      `metadata`,
      
      // Nested formData searches
      ...cart.cartItems.map((_, i) => `cartItems[${i}].formData.attendeeData`)
    ];
    
    // Search by field name mapping
    const mappedField = this.getFieldMapping(fieldName);
    
    // Direct value search in cart structure
    for (const path of searchPaths) {
      const foundValue = this.getNestedValue(cart, path);
      if (foundValue !== undefined) {
        // Check for exact match
        if (JSON.stringify(foundValue) === JSON.stringify(originalValue)) {
          return { found: true, exactMatch: true, value: foundValue, path };
        }
        
        // Check for partial or transformed match
        if (this.isPartialMatch(originalValue, foundValue, fieldName)) {
          return { found: true, exactMatch: false, value: foundValue, path };
        }
      }
    }
    
    // Search in formData recursively
    for (let i = 0; i < cart.cartItems.length; i++) {
      const formData = cart.cartItems[i].formData || {};
      const result = this.searchInFormData(fieldName, originalValue, formData, `cartItems[${i}].formData`);
      if (result.found) {
        return result;
      }
    }
    
    return { found: false, exactMatch: false, value: null, path: '' };
  }

  /**
   * Search recursively in formData object
   */
  private searchInFormData(
    fieldName: string,
    originalValue: any,
    formData: any,
    basePath: string
  ): { found: boolean; exactMatch: boolean; value: any; path: string } {
    if (!formData || typeof formData !== 'object') {
      return { found: false, exactMatch: false, value: null, path: '' };
    }
    
    for (const [key, value] of Object.entries(formData)) {
      const currentPath = `${basePath}.${key}`;
      
      // Direct field name match
      if (key === fieldName || key.endsWith(`.${fieldName}`)) {
        if (JSON.stringify(value) === JSON.stringify(originalValue)) {
          return { found: true, exactMatch: true, value, path: currentPath };
        }
        if (this.isPartialMatch(originalValue, value, fieldName)) {
          return { found: true, exactMatch: false, value, path: currentPath };
        }
      }
      
      // Value match
      if (JSON.stringify(value) === JSON.stringify(originalValue)) {
        return { found: true, exactMatch: true, value, path: currentPath };
      }
      
      // Recursive search in nested objects
      if (typeof value === 'object' && value !== null) {
        const nestedResult = this.searchInFormData(fieldName, originalValue, value, currentPath);
        if (nestedResult.found) {
          return nestedResult;
        }
      }
    }
    
    return { found: false, exactMatch: false, value: null, path: '' };
  }

  /**
   * Generate comprehensive field validation report
   */
  generateFieldValidationReport(
    attendees: any[],
    tickets: any[],
    cart: Cart
  ): FieldValidationReport {
    const validations = this.validateFieldTransfer(attendees, tickets, cart);
    const fieldAnalysis = this.getFieldAnalysisData();
    
    // Calculate summary statistics
    const attendeeValidations = validations.filter(v => v.location.original.startsWith('attendees'));
    const ticketValidations = validations.filter(v => v.location.original.startsWith('tickets'));
    
    const totalFields = validations.length;
    const transferredFields = validations.filter(v => v.status === 'transferred').length;
    const missingFields = validations.filter(v => v.status === 'missing').length;
    const transformedFields = validations.filter(v => v.status === 'transformed').length;
    const addedFields = validations.filter(v => v.status === 'added').length;
    
    const transferRate = totalFields > 0 ? (transferredFields + transformedFields) / totalFields * 100 : 0;
    
    // Category analysis
    const categories: { [key: string]: any } = {};
    const categoryNames = Object.keys(fieldAnalysis.fieldCategories || {});
    
    categoryNames.forEach(categoryName => {
      const categoryValidations = validations.filter(v => v.category === categoryName);
      categories[categoryName] = {
        total: categoryValidations.length,
        transferred: categoryValidations.filter(v => v.status === 'transferred').length,
        missing: categoryValidations.filter(v => v.status === 'missing').length,
        transferRate: categoryValidations.length > 0 ? 
          (categoryValidations.filter(v => v.status === 'transferred' || v.status === 'transformed').length / categoryValidations.length * 100) : 0
      };
    });
    
    // Critical missing fields
    const criticalMissing = validations.filter(v => v.status === 'missing' && v.severity === 'high');
    
    // Generate recommendations
    const recommendations = this.generateValidationRecommendations(validations, transferRate);
    
    return {
      summary: {
        totalFields,
        attendeeFields: attendeeValidations.length,
        ticketFields: ticketValidations.length,
        transferredFields,
        missingFields,
        transformedFields,
        addedFields,
        transferRate: Math.round(transferRate * 100) / 100
      },
      details: {
        attendeeValidation: attendeeValidations,
        ticketValidation: ticketValidations
      },
      categories,
      criticalMissing,
      recommendations
    };
  }

  /**
   * Get field analysis data (loaded from the JSON file)
   */
  private getFieldAnalysisData(): any {
    try {
      const analysisPath = path.join(process.cwd(), 'field-analysis-reports', 'field-transfer-analysis-2025-08-24.json');
      const data = fs.readFileSync(analysisPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Could not load field analysis data:', error);
      return {
        fieldMappings: {
          attendeeOnlyFields: { fields: { rootLevel: [], nested_attendeeData: {} } },
          ticketOnlyFields: { fields: [] }
        },
        fieldCategories: {}
      };
    }
  }

  /**
   * Get field category from analysis data
   */
  private getFieldCategory(fieldName: string, fieldAnalysis: any): string {
    const categories = fieldAnalysis.fieldCategories || {};
    
    for (const [categoryName, categoryData] of Object.entries(categories)) {
      const attendeeFields = (categoryData as any).attendees || [];
      const ticketFields = (categoryData as any).tickets || [];
      
      if (attendeeFields.includes(fieldName) || ticketFields.includes(fieldName)) {
        return categoryName;
      }
    }
    
    return 'uncategorized';
  }

  /**
   * Check if a field is critical for cart functionality
   */
  private isCriticalField(fieldName: string): boolean {
    const criticalFields = [
      'firstName', 'lastName', 'email', 'attendeeId', 'registrationId',
      'attendeeData.firstName', 'attendeeData.lastName', 'attendeeData.primaryEmail',
      'ticketPrice', 'originalPrice', 'eventId', 'ticketId'
    ];
    return criticalFields.includes(fieldName);
  }

  /**
   * Check if a field is important for business logic
   */
  private isImportantField(fieldName: string): boolean {
    const importantFields = [
      'phone', 'primaryPhone', 'dietaryRequirements', 'specialNeeds',
      'lodge', 'grandLodge', 'masonicStatus', 'paymentStatus',
      'attendeeData.lodge', 'attendeeData.grandLodge', 'attendeeData.rank'
    ];
    return importantFields.includes(fieldName);
  }

  /**
   * Check if values partially match (for transformed fields)
   */
  private isPartialMatch(originalValue: any, transformedValue: any, fieldName: string): boolean {
    if (typeof originalValue === 'string' && typeof transformedValue === 'string') {
      // Check if transformed value contains original (e.g., firstName + lastName -> fullName)
      if (transformedValue.toLowerCase().includes(originalValue.toLowerCase())) {
        return true;
      }
      
      // Check if original contains transformed (e.g., fullName -> firstName)
      if (originalValue.toLowerCase().includes(transformedValue.toLowerCase())) {
        return true;
      }
    }
    
    // Special handling for email fields
    if (fieldName.includes('email') || fieldName.includes('Email')) {
      return originalValue === transformedValue;
    }
    
    return false;
  }

  /**
   * Get nested value from object using path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (key.includes('[') && key.includes(']')) {
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
        return current?.[arrayKey]?.[index];
      }
      return current?.[key];
    }, obj);
  }

  /**
   * Get field mapping for transformation
   */
  private getFieldMapping(fieldName: string): string {
    const mappings: { [key: string]: string } = {
      'firstName': 'customer.name',
      'lastName': 'customer.name',
      'email': 'customer.email',
      'primaryEmail': 'customer.email',
      'attendeeData.firstName': 'formData.firstName',
      'attendeeData.lastName': 'formData.lastName',
      'attendeeData.primaryEmail': 'formData.email'
    };
    
    return mappings[fieldName] || fieldName;
  }

  /**
   * Generate validation recommendations based on results
   */
  private generateValidationRecommendations(validations: FieldValidationResult[], transferRate: number): string[] {
    const recommendations: string[] = [];
    
    if (transferRate < 70) {
      recommendations.push('Transfer rate is below 70%. Consider reviewing field mapping logic.');
    }
    
    const criticalMissing = validations.filter(v => v.status === 'missing' && v.severity === 'high');
    if (criticalMissing.length > 0) {
      recommendations.push(`${criticalMissing.length} critical fields are missing. Review: ${criticalMissing.map(v => v.field).join(', ')}`);
    }
    
    const personalInfoMissing = validations.filter(v => 
      v.category === 'personalInformation' && v.status === 'missing'
    ).length;
    if (personalInfoMissing > 3) {
      recommendations.push('Many personal information fields are missing. Verify customer data mapping.');
    }
    
    const masonicInfoMissing = validations.filter(v => 
      v.category === 'masonicInformation' && v.status === 'missing'
    ).length;
    if (masonicInfoMissing > 5) {
      recommendations.push('Masonic information may be incompletely transferred. Check formData structure.');
    }
    
    const pricingMissing = validations.filter(v => 
      v.category === 'pricingInformation' && v.status === 'missing'
    ).length;
    if (pricingMissing > 0) {
      recommendations.push('Pricing fields are missing. Verify cart item price calculations.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Field validation looks good. All critical data appears to be transferred.');
    }
    
    return recommendations;
  }

  /**
   * Generate summary statistics for multiple comparisons
   */
  generateSummaryStats(comparisons: ComparisonResult[]): void {
    const stats = {
      total: comparisons.length,
      valid: comparisons.filter(c => c.transformed.validation.valid).length,
      invalid: comparisons.filter(c => !c.transformed.validation.valid).length,
      byType: {} as Record<string, number>,
      pricingDifferences: [] as number[],
      commonErrors: {} as Record<string, number>
    };
    
    comparisons.forEach(comp => {
      // Count by type
      stats.byType[comp.registrationType] = (stats.byType[comp.registrationType] || 0) + 1;
      
      // Track pricing differences
      stats.pricingDifferences.push(comp.mapping.pricing.difference);
      
      // Track common errors
      comp.transformed.validation.errors.forEach(error => {
        stats.commonErrors[error.field] = (stats.commonErrors[error.field] || 0) + 1;
      });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON SUMMARY STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total Comparisons: ${stats.total}`);
    console.log(`Valid Carts: ${stats.valid} (${(stats.valid/stats.total*100).toFixed(1)}%)`);
    console.log(`Invalid Carts: ${stats.invalid} (${(stats.invalid/stats.total*100).toFixed(1)}%)`);
    
    console.log('\nBy Registration Type:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    if (stats.pricingDifferences.length > 0) {
      const avgDiff = stats.pricingDifferences.reduce((a, b) => a + b, 0) / stats.pricingDifferences.length;
      console.log(`\nAverage Pricing Difference: $${avgDiff.toFixed(2)}`);
    }
    
    if (Object.keys(stats.commonErrors).length > 0) {
      console.log('\nCommon Validation Errors:');
      Object.entries(stats.commonErrors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([field, count]) => {
          console.log(`  ${field}: ${count} occurrences`);
        });
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Generate detailed field validation report for a registration
   */
  async generateDetailedValidationReport(registrationId: string): Promise<void> {
    const comparison = await this.compareRegistrationToCart(registrationId);
    if (!comparison) {
      console.error(`Could not generate validation report for ${registrationId}`);
      return;
    }
    
    const validationReport = this.generateFieldValidationReport(
      comparison.original.attendees,
      comparison.original.tickets,
      comparison.transformed.cart
    );
    
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED FIELD VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`Registration ID: ${registrationId}`);
    console.log(`Transfer Rate: ${validationReport.summary.transferRate}%`);
    
    // Summary
    console.log('\n' + '-'.repeat(40));
    console.log('VALIDATION SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Fields Analyzed: ${validationReport.summary.totalFields}`);
    console.log(`  - Attendee Fields: ${validationReport.summary.attendeeFields}`);
    console.log(`  - Ticket Fields: ${validationReport.summary.ticketFields}`);
    console.log(`Successfully Transferred: ${validationReport.summary.transferredFields} (${Math.round((validationReport.summary.transferredFields / validationReport.summary.totalFields) * 100)}%)`);
    console.log(`Transformed Fields: ${validationReport.summary.transformedFields} (${Math.round((validationReport.summary.transformedFields / validationReport.summary.totalFields) * 100)}%)`);
    console.log(`Missing Fields: ${validationReport.summary.missingFields} (${Math.round((validationReport.summary.missingFields / validationReport.summary.totalFields) * 100)}%)`);
    
    // Categories
    console.log('\n' + '-'.repeat(40));
    console.log('BY CATEGORY');
    console.log('-'.repeat(40));
    Object.entries(validationReport.categories).forEach(([category, stats]) => {
      console.log(`${category}:`);
      console.log(`  Total: ${stats.total}, Transfer Rate: ${Math.round(stats.transferRate)}%`);
      console.log(`  Transferred: ${stats.transferred}, Missing: ${stats.missing}`);
    });
    
    // Critical Missing
    if (validationReport.criticalMissing.length > 0) {
      console.log('\n' + '-'.repeat(40));
      console.log('CRITICAL MISSING FIELDS');
      console.log('-'.repeat(40));
      validationReport.criticalMissing.forEach(field => {
        console.log(`❌ ${field.field} (${field.category})`);
        console.log(`   Original: ${field.originalValue}`);
        console.log(`   Location: ${field.location.original}`);
      });
    }
    
    // Recommendations
    console.log('\n' + '-'.repeat(40));
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(40));
    validationReport.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Save detailed report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'field-validation-reports');
    
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }
    
    const filename = `field-validation-${registrationId}-${timestamp}.json`;
    const filepath = path.join(reportPath, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(validationReport, null, 2), 'utf8');
    console.log(`\n📄 Detailed report saved: ${filepath}`);
    
    console.log('\n' + '='.repeat(80));
  }
}