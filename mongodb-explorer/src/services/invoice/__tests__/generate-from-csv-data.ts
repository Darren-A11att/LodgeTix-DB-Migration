/**
 * Generate invoices from actual CSV data
 */

import { InvoiceService } from '../invoice-service';
import { PaymentData, RegistrationData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Output directory
const outputDir = path.join(__dirname, 'real-invoice-outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Test data extracted from CSVs
const testData = [
  // INDIVIDUALS
  {
    name: 'individual-01-luis-reyes',
    confirmationNumber: 'IND-029388TI',
    payment: {
      _id: '5PrnY0XUftoHpNQlwZ290aFWuNIZY',
      paymentId: '5PrnY0XUftoHpNQlwZ290aFWuNIZY',
      transactionId: 'br55qEb1O6PBBQXnOT5vMolYIgBZY',
      amount: 271.00,
      grossAmount: 277.10,
      fees: 6.10,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-22T17:22:17Z'),
      customerName: 'LUIS A REYES',
      cardBrand: 'Visa',
      cardLast4: '9894',
      status: 'paid',
      source: 'square',
      description: 'Individual Registration - Grand Proclamation 2025'
    },
    registration: {
      _id: 'e8d27b17-9e6d-4682-86b4-ebdc5b44c7f7',
      confirmationNumber: 'IND-029388TI',
      registrationType: 'individuals',
      functionName: 'Grand Proclamation 2025',
      registrationData: {
        metadata: { source: 'individuals-registration-api' },
        subtotal: 270,
        attendees: [
          {
            attendeeId: '01977fd8-c47c-718b-8fb1-c6af594f99d9',
            firstName: 'Luis',
            lastName: 'Reyes',
            title: 'RW Bro',
            suffix: 'PSGW',
            rank: 'GL',
            lodgeNameNumber: 'Lodge Sir Joseph Banks No. 300',
            isPrimary: true,
            attendeeType: 'mason',
            grandOfficerStatus: 'Past'
          },
          {
            attendeeId: '01978b0b-bd85-758b-8c60-c8d836e5eb82',
            firstName: 'Marilyn',
            lastName: 'Reyes',
            title: 'Mrs',
            isPrimary: false,
            isPartner: '01977fd8-c47c-718b-8fb1-c6af594f99d9',
            attendeeType: 'guest',
            relationship: 'Wife'
          }
        ],
        selectedTickets: [
          { attendeeId: '01977fd8-c47c-718b-8fb1-c6af594f99d9', price: 0, event_ticket_id: '7196514b-d4b8-4fe0-93ac-deb4c205dd09' },
          { attendeeId: '01977fd8-c47c-718b-8fb1-c6af594f99d9', price: 0, event_ticket_id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' },
          { attendeeId: '01978b0b-bd85-758b-8c60-c8d836e5eb82', price: 0, event_ticket_id: '7196514b-d4b8-4fe0-93ac-deb4c205dd09' },
          { attendeeId: '01978b0b-bd85-758b-8c60-c8d836e5eb82', price: 0, event_ticket_id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' }
        ],
        bookingContact: {
          firstName: 'LUIS',
          lastName: 'A REYES',
          email: 'luis.reyes9357@outlook.com',
          phone: '0416 244 555',
          addressLine1: '118 Hillcrest Avenue',
          city: 'Hurstville Grove',
          postalCode: '2220',
          stateProvince: '',
          country: ''
        }
      }
    } as RegistrationData
  },
  {
    name: 'individual-02-stoyan-dimitrov',
    confirmationNumber: 'IND-702724KT',
    payment: {
      _id: 'BrhCj6Bg8tBQE7msfhF9H0x2WKCZY',
      paymentId: 'BrhCj6Bg8tBQE7msfhF9H0x2WKCZY',
      transactionId: 'Xvuk93AinYSUM5dx0dQgIf2TksFZY',
      amount: 21.00,
      grossAmount: 21.47,
      fees: 0.47,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-22T20:02:21Z'),
      customerName: 'Stoyan Dimitrov',
      cardBrand: 'American Express',
      cardLast4: '1004',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: 'fe6e329c-3571-4935-b2c9-90fb9ee969cb',
      confirmationNumber: 'IND-702724KT',
      registrationType: 'individuals',
      functionName: 'Grand Proclamation 2025',
      registrationData: {
        metadata: { source: 'individuals-registration-api' },
        subtotal: 20,
        attendees: [
          {
            attendeeId: '01979708-df54-763c-82cb-5d379c9c4ba1',
            firstName: 'Stoyan',
            lastName: 'Dimitrov',
            title: 'W Bro',
            rank: 'IM',
            lodgeNameNumber: 'Lodge Ku-Ring-Gai No. 1033',
            isPrimary: true,
            attendeeType: 'mason',
            primaryEmail: 'stoyandimitrov80@yahoo.com',
            primaryPhone: '0452 664 871'
          }
        ],
        selectedTickets: [
          { attendeeId: '01979708-df54-763c-82cb-5d379c9c4ba1', price: 0, event_ticket_id: '7196514b-d4b8-4fe0-93ac-deb4c205dd09' }
        ],
        bookingContact: {
          firstName: 'Stoyan',
          lastName: 'Dimitrov',
          email: 'stoyandimitrov80@yahoo.com',
          phone: '0452 664 871',
          addressLine1: '80 Hume Lane',
          city: 'Unit 8',
          postalCode: '2065',
          stateProvince: 'New South Wales',
          country: 'AU'
        }
      }
    } as RegistrationData
  },
  {
    name: 'individual-03-robert-moore',
    confirmationNumber: 'IND-648819EP',
    payment: {
      _id: 'pbpNmIVzBxUGo8UFdlH9DTCTMCbZY',
      paymentId: 'pbpNmIVzBxUGo8UFdlH9DTCTMCbZY',
      transactionId: 'R40EXOAyB9pW9wgL982AtQwCRo9YY',
      amount: 21.00,
      grossAmount: 21.47,
      fees: 0.47,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-23T10:25:29Z'),
      customerName: 'Robert Moore',
      cardBrand: 'Visa',
      cardLast4: '7786',
      status: 'paid',
      source: 'square'
    },
    registration: {
      // Mock registration as we don't have this one in the CSV extract
      _id: 'mock-reg-003',
      confirmationNumber: 'IND-648819EP',
      registrationType: 'individuals',
      functionName: 'Grand Proclamation 2025',
      registrationData: {
        attendees: [{ firstName: 'Robert', lastName: 'Moore', isPrimary: true }],
        selectedTickets: [{ price: 20, quantity: 1, name: 'Event Ticket' }],
        bookingContact: { firstName: 'Robert', lastName: 'Moore', email: 'robert.moore@email.com' }
      }
    } as RegistrationData
  },
  {
    name: 'individual-04-ken-sheppard',
    confirmationNumber: 'IND-522951GX',
    payment: {
      _id: 'pv33sbCpxAUmcV6lVO0u2itrGMXZY',
      paymentId: 'pv33sbCpxAUmcV6lVO0u2itrGMXZY',
      transactionId: 'DrnJc2FI9QPE3KEktWcZewKKzzJZY',
      amount: 280.00,
      grossAmount: 287.32,
      fees: 7.32,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-23T00:48:50Z'),
      customerName: 'Ken SHEPPARD',
      cardBrand: 'card',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: '3fa1b373-cba2-4080-ab20-ecdcf008b382',
      confirmationNumber: 'IND-522951GX',
      registrationType: 'individuals',
      functionName: 'Grand Proclamation 2025',
      registrationData: {
        metadata: { source: 'individuals-registration-api' },
        subtotal: 280,
        attendees: [
          {
            attendeeId: '01979784-967c-733c-a66c-e9cff5154d00',
            firstName: 'Kenneth',
            lastName: 'SHEPPARD',
            title: 'RW Bro',
            suffix: 'PJGW, Grand Chaplain',
            rank: 'GL',
            lodgeNameNumber: 'Lodge Milton No. 63',
            isPrimary: true,
            attendeeType: 'mason',
            grandOfficerStatus: 'Present',
            primaryEmail: 'kensheppard@bigpond.com',
            primaryPhone: '0428 638 611'
          }
        ],
        selectedTickets: [
          { attendeeId: '01979784-967c-733c-a66c-e9cff5154d00', price: 0, event_ticket_id: 'd586ecc1-e410-4ef3-a59c-4a53a866bc33' },
          { attendeeId: '01979784-967c-733c-a66c-e9cff5154d00', price: 0, event_ticket_id: '7196514b-d4b8-4fe0-93ac-deb4c205dd09' },
          { attendeeId: '01979784-967c-733c-a66c-e9cff5154d00', price: 0, event_ticket_id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' },
          { attendeeId: '01979784-967c-733c-a66c-e9cff5154d00', price: 0, event_ticket_id: 'bce41292-3662-44a7-85da-eeb1a1e89d8a' }
        ],
        bookingContact: {
          firstName: 'Ken',
          lastName: 'SHEPPARD',
          email: 'kensheppard@bigpond.com',
          phone: '0428 638 611',
          addressLine1: 'P.O. Box 947',
          city: 'Ulladulla',
          postalCode: '2539',
          stateProvince: 'New South Wales',
          country: 'AU'
        }
      }
    } as RegistrationData
  },
  {
    name: 'individual-05-vip-baker',
    confirmationNumber: 'IND-128022YC',
    payment: {
      _id: 'NJ7rsmtw4soG3otEfmHtn1nVlEdZY',
      paymentId: 'NJ7rsmtw4soG3otEfmHtn1nVlEdZY',
      amount: 1999.85,
      grossAmount: 1999.85,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-23T17:59:46Z'),
      customerName: 'David Baker',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: 'mock-reg-005',
      confirmationNumber: 'IND-128022YC',
      registrationType: 'individuals',
      functionName: 'Grand Proclamation 2025',
      registrationData: {
        attendees: [{ firstName: 'David', lastName: 'Baker', isPrimary: true }],
        selectedTickets: [{ price: 1999.85, quantity: 1, name: 'VIP Package' }],
        bookingContact: { firstName: 'David', lastName: 'Baker', email: 'david.baker@email.com' }
      }
    } as RegistrationData
  },

  // LODGES
  {
    name: 'lodge-01-sydney-st-george',
    confirmationNumber: 'LDG-867620PW',
    payment: {
      _id: 'rk9fpBTMTybyXza0YCvph5lW3NQZY',
      paymentId: 'rk9fpBTMTybyXza0YCvph5lW3NQZY',
      transactionId: 'zHddlOinPKTa2W6GFMNjqIkjW3EZY',
      amount: 4613.80,
      grossAmount: 4717.59,
      fees: 103.79,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-22T09:13:06Z'),
      customerName: 'Unknown',
      cardBrand: 'Visa',
      cardLast4: '4477',
      status: 'paid',
      source: 'square',
      description: 'Lodge Registration - Grand Proclamation 2025 (4 tables)'
    },
    registration: {
      _id: '8024de93-41f3-4e37-9b9f-41b0e80a8f2f',
      confirmationNumber: 'LDG-867620PW',
      registrationType: 'lodge',
      functionName: 'Grand Proclamation 2025',
      metadata: {
        billingDetails: {
          firstName: 'McJulian',
          lastName: 'Franco',
          phone: '0452 620 819',
          suburb: 'Sydney',
          postcode: '2000',
          country: { isoCode: 'AU' },
          addressLine1: 'Lodge Sydney St. George No. 269',
          businessName: 'Lodge Sydney St. George No. 269',
          emailAddress: 'mcjulianfranco@gmail.com',
          mobileNumber: '0452 620 819',
          stateTerritory: { name: 'NSW' }
        },
        squarePaymentId: 'zHddlOinPKTa2W6GFMNjqIkjW3EZY',
        roundedAmountCents: 472393,
        originalSubtotalCents: 460000,
        platformFeeAmountCents: 1380
      },
      registrationData: {}
    } as RegistrationData
  },
  {
    name: 'lodge-02-prince-charles',
    confirmationNumber: 'LDG-643031YX',
    payment: {
      _id: 'TYT8M8wPO4wy1LaBRbCyfIAXEDBZY',
      paymentId: 'TYT8M8wPO4wy1LaBRbCyfIAXEDBZY',
      transactionId: 'F0fRHM6SV5iy9ac26eznQ1nkDBgZY',
      amount: 1153.45,
      grossAmount: 1179.40,
      fees: 25.95,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-23T01:22:41Z'),
      customerName: 'Unknown',
      cardBrand: 'American Express',
      cardLast4: '2003',
      status: 'paid',
      source: 'square',
      description: 'Lodge Registration - Grand Proclamation 2025 (1 tables)'
    },
    registration: {
      _id: '1b538a7d-4370-49a3-a1af-b3110a4015a0',
      confirmationNumber: 'LDG-643031YX',
      registrationType: 'lodge',
      functionName: 'Grand Proclamation 2025',
      metadata: {
        billingDetails: {
          firstName: 'Joe',
          lastName: 'Corrigan',
          phone: '0416 042 338',
          suburb: 'Sydney',
          postcode: '2000',
          country: { isoCode: 'AU' },
          addressLine1: 'The Prince Charles Edward Stuart Lodge No. 1745',
          businessName: 'The Prince Charles Edward Stuart Lodge No. 1745',
          emailAddress: 'joecorrigan@mac.com',
          mobileNumber: '0416 042 338',
          stateTerritory: { name: 'NSW' }
        },
        squarePaymentId: 'F0fRHM6SV5iy9ac26eznQ1nkDBgZY',
        roundedAmountCents: 119632,
        originalSubtotalCents: 115000,
        platformFeeAmountCents: 345
      },
      registrationData: {}
    } as RegistrationData
  },
  {
    name: 'lodge-03-vip-baker-lodge',
    confirmationNumber: 'IND-930810GG',
    payment: {
      _id: 'b2ujce56CqbpooEoewgNAxa9OMBZY',
      paymentId: 'b2ujce56CqbpooEoewgNAxa9OMBZY',
      amount: 1999.85,
      grossAmount: 1999.85,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-23T18:21:14Z'),
      customerName: 'David Baker',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: 'mock-lodge-003',
      confirmationNumber: 'IND-930810GG',
      registrationType: 'lodge', // Treating as lodge due to high amount
      functionName: 'Grand Proclamation 2025',
      lodgeName: 'VIP Lodge Group',
      metadata: {
        billingDetails: {
          businessName: 'VIP Lodge Group',
          firstName: 'David',
          lastName: 'Baker',
          emailAddress: 'david.baker@email.com'
        }
      },
      registrationData: {}
    } as RegistrationData
  },
  {
    name: 'lodge-04-processed',
    confirmationNumber: 'LDG-210679FX',
    payment: {
      _id: 'vMYRIPaS9VU9lmsZZ7WPmH0WhkZZY',
      paymentId: 'vMYRIPaS9VU9lmsZZ7WPmH0WhkZZY',
      amount: 1196.32,
      grossAmount: 1196.32,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-06-24T12:37:53Z'),
      customerEmail: 'joe@buildtec.net.au',
      customerName: 'Unknown',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: 'mock-lodge-004',
      confirmationNumber: 'LDG-210679FX',
      registrationType: 'lodge',
      functionName: 'Grand Proclamation 2025',
      lodgeName: 'Lodge 210679',
      customerEmail: 'joe@buildtec.net.au',
      metadata: {
        billingDetails: {
          businessName: 'Lodge 210679',
          emailAddress: 'joe@buildtec.net.au'
        }
      },
      registrationData: {}
    } as RegistrationData
  },
  {
    name: 'lodge-05-minimal',
    confirmationNumber: 'LDG-TEST-005',
    payment: {
      _id: 'test-lodge-payment-005',
      paymentId: 'test-lodge-payment-005',
      amount: 500,
      grossAmount: 500,
      currency: 'AUD',
      paymentMethod: 'credit_card',
      paymentDate: new Date(),
      customerName: 'Test Lodge',
      status: 'paid',
      source: 'square'
    },
    registration: {
      _id: 'test-lodge-reg-005',
      confirmationNumber: 'LDG-TEST-005',
      registrationType: 'lodge',
      lodgeName: 'Test Lodge 005',
      registrationData: {}
    } as RegistrationData
  }
];

// Generate invoices
async function generateRealInvoices() {
  console.log('Generating invoices from actual data...\\n');

  let invoiceCounter = 1;
  
  for (const testCase of testData) {
    try {
      console.log(`Generating ${testCase.name}...`);
      
      const invoiceNumbers = {
        customerInvoiceNumber: `LTIV-2412-ACTUAL${invoiceCounter.toString().padStart(3, '0')}`,
        supplierInvoiceNumber: `LTSP-2412-ACTUAL${invoiceCounter.toString().padStart(3, '0')}`
      };
      invoiceCounter++;
      
      const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
        payment: testCase.payment as PaymentData,
        registration: testCase.registration,
        invoiceNumbers
      });
      
      // Save to file
      const output = {
        testCase: testCase.name,
        confirmationNumber: testCase.confirmationNumber,
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
          softwareUtilizationFee: supplierInvoice.items.find(i => i.description.includes('Software'))?.price || 0,
          paymentAmount: testCase.payment.grossAmount || testCase.payment.amount,
          customerName: testCase.payment.customerName
        }
      };
      
      fs.writeFileSync(
        path.join(outputDir, `${testCase.name}.json`),
        JSON.stringify(output, null, 2)
      );
      
      console.log(`  ✓ Saved to: ${testCase.name}.json`);
      console.log(`    Customer: ${testCase.payment.customerName} - $${customerInvoice.total.toFixed(2)}`);
      console.log(`    Supplier: $${supplierInvoice.total.toFixed(2)}`);
      
    } catch (error) {
      console.error(`  ✗ Error generating ${testCase.name}:`, error.message);
    }
  }
  
  console.log('\\n✅ Invoice generation complete!');
  console.log(`\\n📁 Output files saved to: ${outputDir}`);
}

// Run the generator
generateRealInvoices();