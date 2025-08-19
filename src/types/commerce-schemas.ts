export const CommerceSchemas = {
  products: {
    status: {
      type: 'enum',
      values: ['draft', 'proposed', 'published', 'rejected'],
      required: true,
      default: 'draft'
    },
    type: {
      type: 'enum', 
      values: ['simple', 'variant', 'bundle', 'multipart', 'digital', 'service', 'subscription'],
      required: true
    },
    handle: {
      type: 'string',
      pattern: /^[a-z0-9-]+$/,
      required: true,
      unique: true
    },
    title: {
      type: 'string',
      required: true
    },
    collection_id: {
      type: 'string',
      required: false
    },
    vendor_id: {
      type: 'string',
      required: false
    },
    price: {
      type: 'number',
      min: 0,
      required: false
    }
  },

  product_collections: {
    handle: {
      type: 'string',
      pattern: /^[a-z0-9-]+$/,
      required: true,
      unique: true
    },
    title: {
      type: 'string',
      required: true
    }
  },

  product_variants: {
    title: {
      type: 'string',
      required: true
    },
    sku: {
      type: 'string',
      pattern: /^[A-Z0-9-]+$/,
      required: false,
      unique: true
    },
    inventory_quantity: {
      type: 'number',
      min: 0,
      default: 0
    },
    manage_inventory: {
      type: 'boolean',
      default: true
    },
    allow_backorder: {
      type: 'boolean',
      default: false
    },
    price: {
      type: 'number',
      min: 0,
      required: true
    }
  },

  vendors: {
    status: {
      type: 'enum',
      values: ['active', 'inactive', 'pending', 'suspended'],
      required: true,
      default: 'pending'
    },
    name: {
      type: 'string',
      required: true
    },
    handle: {
      type: 'string',
      pattern: /^[a-z0-9-]+$/,
      required: true,
      unique: true
    },
    email: {
      type: 'email',
      required: false
    },
    commission_rate: {
      type: 'number',
      min: 0,
      max: 100,
      suffix: '%',
      required: false,
      default: 15
    },
    payout_schedule: {
      type: 'enum',
      values: ['daily', 'weekly', 'monthly'],
      default: 'monthly'
    }
  },

  payment_gateways: {
    name: {
      type: 'string',
      required: true
    },
    code: {
      type: 'string',
      pattern: /^[a-z0-9-]+$/,
      required: true,
      unique: true
    },
    provider: {
      type: 'enum',
      values: ['stripe', 'square', 'paypal', 'manual'],
      required: true
    },
    account_type: {
      type: 'enum',
      values: ['platform', 'connect', 'merchant'],
      required: true
    },
    is_active: {
      type: 'boolean',
      default: true
    },
    is_default: {
      type: 'boolean',
      default: false
    },
    vendor_id: {
      type: 'string',
      required: false
    }
  },

  orders: {
    status: {
      type: 'enum',
      values: ['pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'],
      required: true,
      default: 'pending'
    },
    payment_status: {
      type: 'enum',
      values: ['unpaid', 'partial', 'paid', 'refunded', 'failed'],
      required: true,
      default: 'unpaid'
    },
    fulfillment_status: {
      type: 'enum',
      values: ['unfulfilled', 'partial', 'fulfilled', 'returned'],
      required: true,
      default: 'unfulfilled'
    },
    total: {
      type: 'number',
      min: 0,
      required: true
    },
    currency: {
      type: 'enum',
      values: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ZAR'],
      default: 'ZAR',
      required: true
    }
  },

  carts: {
    status: {
      type: 'enum',
      values: ['active', 'abandoned', 'converted', 'expired'],
      required: true,
      default: 'active'
    },
    currency: {
      type: 'enum',
      values: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ZAR'],
      default: 'ZAR',
      required: true
    }
  },

  payments: {
    status: {
      type: 'enum',
      values: ['not_paid', 'awaiting', 'captured', 'partially_refunded', 'refunded', 'canceled', 'requires_action'],
      required: true,
      default: 'not_paid'
    },
    payment_method: {
      type: 'enum',
      values: ['card', 'eft', 'cash', 'check', 'other'],
      required: true
    },
    amount: {
      type: 'number',
      min: 0,
      required: true
    },
    currency_code: {
      type: 'enum',
      values: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ZAR'],
      default: 'ZAR',
      required: true
    }
  },

  inventory_items: {
    sku: {
      type: 'string',
      pattern: /^[A-Z0-9-]+$/,
      required: false
    },
    requires_shipping: {
      type: 'boolean',
      default: true
    }
  },

  inventory_levels: {
    inventory_item_id: {
      type: 'string',
      required: true
    },
    location_id: {
      type: 'string',
      required: true
    },
    stocked_quantity: {
      type: 'number',
      min: 0,
      default: 0
    },
    reserved_quantity: {
      type: 'number',
      min: 0,
      default: 0
    },
    incoming_quantity: {
      type: 'number',
      min: 0,
      default: 0
    }
  },

  stock_locations: {
    name: {
      type: 'string',
      required: true
    }
  },

  fulfillments: {
    status: {
      type: 'enum',
      values: ['pending', 'processing', 'shipped', 'delivered', 'failed', 'cancelled', 'returned'],
      required: true,
      default: 'pending'
    },
    carrier: {
      type: 'enum',
      values: ['usps', 'ups', 'fedex', 'dhl', 'local', 'pickup', 'digital', 'other'],
      required: false
    },
    tracking_number: {
      type: 'string',
      pattern: /^[A-Z0-9-]+$/,
      required: false
    },
    shipping_cost: {
      type: 'number',
      min: 0,
      required: false
    }
  },

  customers: {
    status: {
      type: 'enum',
      values: ['active', 'inactive', 'blocked'],
      required: true,
      default: 'active'
    },
    type: {
      type: 'enum',
      values: ['individual', 'business', 'wholesale'],
      default: 'individual'
    },
    email: {
      type: 'email',
      required: true,
      unique: true
    },
    phone: {
      type: 'tel',
      pattern: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/,
      required: false
    },
    tax_exempt: {
      type: 'boolean',
      default: false
    },
    credit_limit: {
      type: 'number',
      min: 0,
      required: false
    }
  }
};

// Helper function to get field configuration
export function getFieldConfig(collection: string, field: string) {
  return CommerceSchemas[collection]?.[field];
}

// Helper function to validate field value
export function validateField(collection: string, field: string, value: any): boolean {
  const config = getFieldConfig(collection, field);
  if (!config) return true;

  switch (config.type) {
    case 'enum':
      return config.values.includes(value);
    case 'number':
      const num = Number(value);
      if (isNaN(num)) return false;
      if (config.min !== undefined && num < config.min) return false;
      if (config.max !== undefined && num > config.max) return false;
      return true;
    case 'boolean':
      return typeof value === 'boolean';
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'tel':
      return config.pattern ? config.pattern.test(value) : true;
    case 'string':
      if (config.pattern && !config.pattern.test(value)) return false;
      return true;
    default:
      return true;
  }
}

// Helper to get form input type
export function getInputType(config: any): string {
  switch (config.type) {
    case 'enum':
      return 'select';
    case 'number':
      return 'number';
    case 'boolean':
      return 'checkbox';
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    default:
      return 'text';
  }
}