/**
 * Generate test invoices with various registration payloads
 */

import { InvoiceService } from '../invoice-service';
import { PaymentData, RegistrationData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Create output directory
const outputDir = path.join(__dirname, 'invoice-outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Helper to generate invoice numbers
let invoiceCounter = 1;
function getInvoiceNumbers() {
  const num = invoiceCounter++;
  return {
    customerInvoiceNumber: `LTIV-2412-TEST${num.toString().padStart(3, '0')}`,
    supplierInvoiceNumber: `LTSP-2412-TEST${num.toString().padStart(3, '0')}`
  };
}

// Test Case 1: Single attendee with one ticket
const individual1: RegistrationData = {
  _id: 'reg001',
  confirmationNumber: 'IND-2024-001',
  registrationType: 'individuals',
  functionName: 'Annual Gala Dinner 2025',
  registrationData: {
    attendees: [{
      attendeeId: 'att001',
      firstName: 'Michael',
      lastName: 'Johnson',
      lodgeNameNumber: 'Sunrise Lodge 789'
    }],
    selectedTickets: [{
      attendeeId: 'att001',
      name: 'Gala Dinner Ticket',
      price: 150,
      quantity: 1
    }],
    bookingContact: {
      firstName: 'Michael',
      lastName: 'Johnson',
      email: 'michael.johnson@email.com',
      addressLine1: '45 King Street',
      city: 'Melbourne',
      postalCode: '3000',
      stateProvince: 'VIC',
      country: 'Australia'
    }
  }
};

// Test Case 2: Multiple attendees with different tickets
const individual2: RegistrationData = {
  _id: 'reg002',
  confirmationNumber: 'IND-2024-002',
  registrationType: 'individuals',
  functionName: 'Grand Installation Ceremony',
  registrationData: {
    attendees: [
      {
        attendeeId: 'att002a',
        title: 'W Bro',
        firstName: 'David',
        lastName: 'Smith',
        lodgeNameNumber: 'Heritage Lodge 456',
        isPrimary: true
      },
      {
        attendeeId: 'att002b',
        title: 'Bro',
        firstName: 'Peter',
        lastName: 'Williams',
        lodgeNameNumber: 'Heritage Lodge 456'
      },
      {
        attendeeId: 'att002c',
        firstName: 'Sarah',
        lastName: 'Smith',
        lodgeNameNumber: 'N/A'
      }
    ],
    selectedTickets: [
      {
        attendeeId: 'att002a',
        name: 'Installation Ceremony',
        price: 75,
        quantity: 1
      },
      {
        attendeeId: 'att002a',
        name: 'Festive Board',
        price: 85,
        quantity: 1
      },
      {
        attendeeId: 'att002b',
        name: 'Installation Ceremony',
        price: 75,
        quantity: 1
      },
      {
        attendeeId: 'att002c',
        name: 'Festive Board',
        price: 85,
        quantity: 1
      }
    ],
    bookingContact: {
      firstName: 'David',
      lastName: 'Smith',
      email: 'david.smith@lodge456.org',
      businessName: 'Heritage Lodge 456',
      businessNumber: 'ABN 98 765 432 109',
      addressLine1: '123 Lodge Street',
      city: 'Sydney',
      postalCode: '2000',
      stateProvince: 'NSW',
      country: 'Australia'
    }
  }
};

// Test Case 3: Missing booking contact (should use attendee info)
const individual3: RegistrationData = {
  _id: 'reg003',
  confirmationNumber: 'IND-2024-003',
  registrationType: 'individuals',
  functionName: 'Charity Ball 2025',
  customerEmail: 'fallback@email.com',
  registrationData: {
    attendees: [
      {
        attendeeId: 'att003',
        firstName: 'Emily',
        lastName: 'Brown',
        email: 'emily.brown@email.com',
        address: '789 Park Avenue'
      }
    ],
    selectedTickets: [
      {
        attendeeId: 'att003',
        name: 'Charity Ball Entry',
        price: 200,
        quantity: 1
      },
      {
        attendeeId: 'att003',
        name: 'Raffle Tickets',
        price: 20,
        quantity: 5
      }
    ]
  }
};

// Test Case 4: Registration-owned tickets (no attendeeId)
const individual4: RegistrationData = {
  _id: 'reg004',
  confirmationNumber: 'IND-2024-004',
  registrationType: 'individuals',
  functionName: 'Ladies Night 2025',
  registrationData: {
    attendees: [
      {
        attendeeId: 'att004a',
        firstName: 'Margaret',
        lastName: 'Wilson',
        lodgeNameNumber: 'Harmony Lodge 123'
      },
      {
        attendeeId: 'att004b',
        firstName: 'Elizabeth',
        lastName: 'Taylor',
        lodgeNameNumber: 'Unity Lodge 999'
      }
    ],
    selectedTickets: [
      {
        ownerType: 'registration',
        name: 'Table of 10',
        price: 750,
        quantity: 1
      },
      {
        attendeeId: 'att004a',
        name: 'Wine Package',
        price: 45,
        quantity: 1
      }
    ],
    bookingContact: {
      name: 'Margaret Wilson',
      email: 'margaret@harmonylodge.org',
      company: 'Ladies Committee',
      address: '55 Queen Street, Brisbane QLD 4000'
    }
  }
};

// Test Case 5: Complex with missing data and fallbacks
const individual5: RegistrationData = {
  _id: 'reg005',
  registrationType: 'individuals',
  functionName: 'Quarterly Communication',
  customerName: 'Robert Anderson',
  registrationData: {
    attendees: [
      {
        firstName: 'Robert',
        lastName: 'Anderson'
      },
      {
        name: 'Guest of Robert Anderson'
      }
    ],
    selectedTickets: [
      {
        name: 'Member Ticket',
        price: 0,
        quantity: 1
      },
      {
        name: 'Guest Ticket',
        price: 25,
        quantity: 1
      }
    ]
  }
};

// Lodge Registration Test Cases

// Lodge 1: Standard lodge registration
const lodge1: RegistrationData = {
  _id: 'reg101',
  confirmationNumber: 'LDG-2024-001',
  registrationType: 'lodge',
  functionName: 'District Meeting 2025',
  lodgeName: 'Exemplar Lodge 111',
  metadata: {
    billingDetails: {
      businessName: 'Exemplar Lodge 111',
      businessNumber: 'ABN 11 222 333 444',
      firstName: 'John',
      lastName: 'Secretary',
      email: 'secretary@exemplarlodge.org',
      addressLine1: 'Exemplar Lodge 111',
      addressLine2: '100 Masonic Way',
      city: 'Perth',
      postalCode: '6000',
      stateProvince: 'WA',
      country: 'Australia'
    }
  },
  registrationData: {
    attendees: [
      { firstName: 'Master', lastName: 'One' },
      { firstName: 'Warden', lastName: 'Two' },
      { firstName: 'Member', lastName: 'Three' },
      { firstName: 'Member', lastName: 'Four' },
      { firstName: 'Member', lastName: 'Five' }
    ],
    selectedTickets: [
      { name: 'Lodge Registration', price: 500, quantity: 1 }
    ]
  }
};

// Lodge 2: Multiple ticket types
const lodge2: RegistrationData = {
  _id: 'reg102',
  confirmationNumber: 'LDG-2024-002',
  registrationType: 'lodge',
  functionName: 'Grand Lodge Communication',
  organisation: {
    name: 'Prosperity Lodge 222',
    abn: '22 333 444 555'
  },
  metadata: {
    billingDetails: {
      businessName: 'Prosperity Lodge 222',
      businessNumber: '22 333 444 555',
      email: 'treasurer@prosperitylodge.org',
      city: 'Adelaide',
      stateProvince: 'SA'
    }
  },
  registrationData: {
    attendees: Array(8).fill(null).map((_, i) => ({
      attendeeId: `lodge2_${i}`,
      firstName: `Member`,
      lastName: `${i + 1}`
    })),
    selectedTickets: [
      { name: 'Early Bird Registration', price: 80, quantity: 5 },
      { name: 'Standard Registration', price: 100, quantity: 3 },
      { name: 'Lunch Package', price: 45, quantity: 8 }
    ]
  }
};

// Lodge 3: Minimal data
const lodge3: RegistrationData = {
  _id: 'reg103',
  confirmationNumber: 'LDG-2024-003',
  registrationType: 'lodge',
  lodgeName: 'Ancient Lodge 333',
  businessName: 'Ancient Lodge 333',
  customerEmail: 'lodge333@email.com',
  registrationData: {
    selectedTickets: [
      { name: 'Lodge Subscription', price: 1200, quantity: 1 }
    ]
  }
};

// Lodge 4: Large delegation
const lodge4: RegistrationData = {
  _id: 'reg104',
  confirmationNumber: 'LDG-2024-004',
  registrationType: 'lodge',
  functionName: 'Interstate Visitation',
  registrationData: {
    lodge: {
      name: 'Travelling Lodge 444',
      number: '444'
    },
    attendees: Array(15).fill(null).map((_, i) => ({
      attendeeId: `trav${i}`,
      firstName: i === 0 ? 'WM' : `Brother`,
      lastName: i === 0 ? 'Leader' : `Member${i}`,
      type: i === 0 ? 'master' : 'member'
    })),
    selectedTickets: Array(15).fill(null).map((_, i) => ({
      attendeeId: `trav${i}`,
      name: 'Visitation Package',
      price: 120,
      quantity: 1
    })),
    bookingContact: {
      businessName: 'Travelling Lodge 444',
      firstName: 'Lodge',
      lastName: 'Secretary',
      email: 'secretary@lodge444.org',
      addressLine1: '444 Lodge Road',
      city: 'Newcastle',
      postalCode: '2300',
      stateProvince: 'NSW'
    }
  }
};

// Lodge 5: Complex with metadata
const lodge5: RegistrationData = {
  _id: 'reg105',
  confirmationNumber: 'LDG-2024-005',
  registrationType: 'lodge',
  type: 'lodge',
  functionName: 'Centenary Celebration',
  lodgeNameNumber: 'Centenary Lodge 555',
  metadata: {
    billingDetails: {
      businessName: 'The Centenary Lodge No. 555',
      businessNumber: 'ABN 55 555 555 555',
      firstName: 'James',
      lastName: 'Treasurer',
      email: 'treasurer@centenarylodge.org',
      addressLine1: 'Masonic Centre',
      addressLine2: '555 Grand Avenue',
      city: 'Hobart',
      postalCode: '7000',
      stateProvince: 'TAS',
      country: 'Australia'
    },
    membershipType: 'Gold',
    notes: 'Celebrating 100 years'
  },
  registrationData: {
    attendees: [
      { firstName: 'Grand', lastName: 'Master' },
      { firstName: 'Deputy', lastName: 'GM' },
      { firstName: 'Senior', lastName: 'Warden' },
      { firstName: 'Junior', lastName: 'Warden' }
    ],
    selectedTickets: [
      { name: 'Centenary Gala Dinner', price: 250, quantity: 4 },
      { name: 'Commemorative Package', price: 100, quantity: 4 }
    ]
  }
};

// Payment data generators
function createStripePayment(amount: number, id: string): PaymentData {
  return {
    _id: `pay_${id}`,
    paymentId: `pi_stripe_${id}`,
    transactionId: `pi_stripe_${id}`,
    amount: amount - (amount * 0.025 + 0.30),
    grossAmount: amount,
    fees: amount * 0.025 + 0.30,
    currency: 'AUD',
    paymentMethod: 'credit_card',
    paymentDate: new Date(),
    customerEmail: 'customer@email.com',
    cardLast4: '4242',
    cardBrand: 'visa',
    status: 'paid',
    source: 'stripe',
    sourceFile: 'Stripe - LodgeTix Darren Export.csv'
  };
}

function createSquarePayment(amount: number, id: string): PaymentData {
  return {
    _id: `pay_${id}`,
    paymentId: `sq_${id}`,
    transactionId: `SQUARE${id.toUpperCase()}`,
    amount: amount - (amount * 0.025 + 0.30),
    grossAmount: amount,
    fees: amount * 0.025 + 0.30,
    currency: 'AUD',
    paymentMethod: 'card',
    paymentDate: new Date(),
    cardBrand: 'mastercard',
    status: 'completed',
    source: 'square',
    sourceFile: 'Square - Winding Stair Export.csv'
  };
}

// Generate invoices
async function generateTestInvoices() {
  console.log('Generating test invoices...\n');

  const testCases = [
    { registration: individual1, payment: createStripePayment(150, '001'), name: 'individual-01-single-attendee' },
    { registration: individual2, payment: createStripePayment(320, '002'), name: 'individual-02-multiple-attendees' },
    { registration: individual3, payment: createSquarePayment(220, '003'), name: 'individual-03-no-booking-contact' },
    { registration: individual4, payment: createStripePayment(795, '004'), name: 'individual-04-registration-tickets' },
    { registration: individual5, payment: createSquarePayment(25, '005'), name: 'individual-05-minimal-data' },
    { registration: lodge1, payment: createStripePayment(500, '101'), name: 'lodge-01-standard' },
    { registration: lodge2, payment: createSquarePayment(1060, '102'), name: 'lodge-02-multiple-tickets' },
    { registration: lodge3, payment: createStripePayment(1200, '103'), name: 'lodge-03-minimal' },
    { registration: lodge4, payment: createSquarePayment(1800, '104'), name: 'lodge-04-large-delegation' },
    { registration: lodge5, payment: createStripePayment(1400, '105'), name: 'lodge-05-complex-metadata' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Generating ${testCase.name}...`);
      
      const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
        payment: testCase.payment,
        registration: testCase.registration,
        invoiceNumbers: getInvoiceNumbers()
      });

      // Save to files
      const output = {
        testCase: testCase.name,
        payment: testCase.payment,
        registration: testCase.registration,
        customerInvoice,
        supplierInvoice,
        summary: {
          registrationType: testCase.registration.registrationType,
          paymentSource: testCase.payment.source,
          customerTotal: customerInvoice.total,
          supplierTotal: supplierInvoice.total,
          processingFees: customerInvoice.processingFees,
          softwareUtilizationFee: supplierInvoice.items.find(i => i.description.includes('Software'))?.price || 0
        }
      };

      fs.writeFileSync(
        path.join(outputDir, `${testCase.name}.json`),
        JSON.stringify(output, null, 2)
      );

      console.log(`  ✓ Saved to invoice-outputs/${testCase.name}.json`);
    } catch (error) {
      console.error(`  ✗ Error generating ${testCase.name}:`, error);
    }
  }

  console.log('\n✅ Invoice generation complete!');
  console.log(`📁 Output files saved to: ${outputDir}`);
}

// Run the generator
generateTestInvoices();