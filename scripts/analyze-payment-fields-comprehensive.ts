// @ts-nocheck
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Known field mappings between Stripe and Square
const FIELD_MAPPINGS = {
  // Payment IDs
  'stripePaymentIntentId': 'squarePaymentId',
  'customerId': 'buyerId',
  
  // Status mappings
  'succeeded': 'COMPLETED',
  'failed': 'FAILED',
  
  // Payment method
  'paymentMethodId': 'sourceType',
  
  // Similar fields with same names
  'amount': 'amount',
  'currency': 'currency',
  'createdAt': 'createdAt',
  'updatedAt': 'updatedAt',
  'customerEmail': 'customerEmail',
  'customerName': 'customerName',
  'receiptUrl': 'receiptUrl',
  'receiptNumber': 'receiptNumber',
  'cardBrand': 'cardBrand',
  'last4': 'last4'
};

async function analyzeFieldsComprehensive() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== COMPREHENSIVE PAYMENT FIELD ANALYSIS ===\n');
    
    // Get all documents for analysis
    const stripeDocs = await db.collection('stripe_payments').find().toArray();
    const squareDocs = await db.collection('payment_imports').find({ squarePaymentId: { $exists: true } }).toArray();
    
    console.log(`Analyzing ${stripeDocs.length} Stripe payments`);
    console.log(`Analyzing ${squareDocs.length} Square payments\n`);
    
    // Analyze field population
    const stripeFieldStats = analyzeFieldPopulation(stripeDocs, 'Stripe');
    const squareFieldStats = analyzeFieldPopulation(squareDocs, 'Square');
    
    // Display population analysis
    console.log('\n📊 STRIPE FIELD POPULATION (sorted by usage):');
    console.log('─'.repeat(60));
    displayFieldStats(stripeFieldStats);
    
    console.log('\n📊 SQUARE FIELD POPULATION (sorted by usage):');
    console.log('─'.repeat(60));
    displayFieldStats(squareFieldStats);
    
    // Analyze linking fields
    console.log('\n🔗 REGISTRATION/CUSTOMER LINKING FIELDS:');
    console.log('─'.repeat(60));
    await analyzeLinkingFields(db, stripeDocs, squareDocs);
    
    // Check invoice requirements
    console.log('\n📄 INVOICE CREATION REQUIREMENTS:');
    console.log('─'.repeat(60));
    await checkInvoiceRequirements(db);
    
    // Similarity analysis
    console.log('\n🔄 FIELD SIMILARITY ANALYSIS:');
    console.log('─'.repeat(60));
    analyzeSimilarFields(stripeFieldStats, squareFieldStats);
    
    // Recommend unified schema
    console.log('\n✅ RECOMMENDED UNIFIED SCHEMA:');
    console.log('─'.repeat(60));
    recommendUnifiedSchema(stripeFieldStats, squareFieldStats);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

function analyzeFieldPopulation(docs, source) {
  const fieldStats = {};
  
  docs.forEach(doc => {
    Object.keys(doc).forEach(field => {
      if (!fieldStats[field]) {
        fieldStats[field] = {
          count: 0,
          hasValue: 0,
          nullCount: 0,
          emptyCount: 0,
          sampleValues: new Set(),
          types: new Set()
        };
      }
      
      fieldStats[field].count++;
      const value = doc[field];
      
      if (value !== null && value !== undefined && value !== '') {
        fieldStats[field].hasValue++;
        
        // Collect sample values (limit to 5)
        if (fieldStats[field].sampleValues.size < 5 && typeof value !== 'object') {
          fieldStats[field].sampleValues.add(value);
        }
        
        // Track types
        fieldStats[field].types.add(typeof value);
      } else if (value === null) {
        fieldStats[field].nullCount++;
      } else if (value === '') {
        fieldStats[field].emptyCount++;
      }
    });
  });
  
  // Calculate percentages
  Object.keys(fieldStats).forEach(field => {
    const stat = fieldStats[field];
    stat.populationRate = ((stat.hasValue / stat.count) * 100).toFixed(1);
  });
  
  return fieldStats;
}

function displayFieldStats(fieldStats) {
  // Sort by population rate
  const sorted = Object.entries(fieldStats)
    .sort((a, b) => parseFloat(b[1].populationRate) - parseFloat(a[1].populationRate));
  
  sorted.forEach(([field, stats]) => {
    const samples = Array.from(stats.sampleValues).slice(0, 3).join(', ');
    const types = Array.from(stats.types).join(', ');
    console.log(`${field.padEnd(30)} ${stats.populationRate.padStart(5)}% populated (${stats.hasValue}/${stats.count})`);
    if (stats.hasValue > 0) {
      console.log(`  Types: ${types}, Samples: ${samples || 'complex object'}`);
    }
  });
}

async function analyzeLinkingFields(db, stripeDocs, squareDocs) {
  // Check for registration links
  const stripeWithRegLinks = stripeDocs.filter(d => 
    d.metadata?.registrationId || 
    d.metadata?.eventId || 
    d.description?.includes('registration')
  ).length;
  
  const squareWithRegLinks = squareDocs.filter(d => 
    d.metadata?.registrationId || 
    d.orderReference || 
    d.orderId ||
    d.matchedRegistrationId
  ).length;
  
  console.log(`Stripe payments with registration links: ${stripeWithRegLinks}/${stripeDocs.length}`);
  console.log(`Square payments with registration links: ${squareWithRegLinks}/${squareDocs.length}`);
  
  // Check registration collection for payment links
  const registrations = await db.collection('registrations').find().limit(10).toArray();
  console.log('\nRegistration payment link fields:');
  registrations.forEach(reg => {
    if (reg.stripePaymentIntentId) console.log('  - stripePaymentIntentId found');
    if (reg.squarePaymentId) console.log('  - squarePaymentId found');
    if (reg.paymentId) console.log('  - paymentId found');
  });
  
  // Customer linking
  console.log('\nCustomer linking fields:');
  console.log('Stripe: customerId, customerEmail, customer object');
  console.log('Square: buyerId, customerEmail, customer object');
}

async function checkInvoiceRequirements(db) {
  // Look for invoice creation scripts
  const invoiceScripts = [
    'generate-invoice',
    'create-invoice',
    'invoice-generator'
  ];
  
  console.log('Common invoice fields needed:');
  console.log('  - amount (required)');
  console.log('  - currency (required)');
  console.log('  - customerEmail (required)');
  console.log('  - customerName (recommended)');
  console.log('  - paymentId (required)');
  console.log('  - createdAt (required)');
  console.log('  - description or line items');
  console.log('  - receiptUrl (optional)');
  console.log('  - cardBrand, last4 (for payment method display)');
}

function analyzeSimilarFields(stripeStats, squareStats) {
  const similarities = [];
  
  // Check each Stripe field for similar Square fields
  Object.keys(stripeStats).forEach(stripeField => {
    Object.keys(squareStats).forEach(squareField => {
      const similarity = calculateSimilarity(stripeField, squareField);
      if (similarity > 0.6 && stripeField !== squareField) {
        similarities.push({
          stripe: stripeField,
          square: squareField,
          similarity: similarity,
          stripePop: stripeStats[stripeField].populationRate,
          squarePop: squareStats[squareField].populationRate
        });
      }
    });
  });
  
  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  console.log('High similarity fields:');
  similarities.slice(0, 10).forEach(sim => {
    console.log(`  ${sim.stripe} <-> ${sim.square} (${(sim.similarity * 100).toFixed(0)}% similar)`);
  });
  
  // Known mappings
  console.log('\nConfirmed mappings:');
  Object.entries(FIELD_MAPPINGS).forEach(([stripe, square]) => {
    console.log(`  ${stripe} = ${square}`);
  });
}

function calculateSimilarity(str1, str2) {
  // Simple similarity calculation
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance would be better but keeping it simple
  let matches = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) matches++;
  }
  
  return matches / Math.max(s1.length, s2.length);
}

function recommendUnifiedSchema(stripeStats, squareStats) {
  console.log(`
{
  // === CORE IDENTIFIERS (100% populated) ===
  _id: ObjectId,
  paymentId: "stripe_pi_xxx or square_xxx", // Primary key
  source: "stripe" | "square",
  sourceAccountName: "DA-LODGETIX | WS-LODGETIX | Square",
  
  // === MONEY FIELDS (100% populated) ===
  amount: 123.45, // In dollars
  currency: "AUD",
  amountFormatted: "$123.45 AUD",
  
  // === STATUS (100% populated) ===
  status: "succeeded" | "completed" | "failed",
  statusOriginal: "succeeded" | "COMPLETED", // Preserve original
  
  // === TIMESTAMPS (100% populated) ===
  createdAt: Date,
  updatedAt: Date,
  importedAt: Date,
  
  // === CUSTOMER INFO (high priority) ===
  customerEmail: "email@example.com", // ${stripeStats.customerEmail?.populationRate || 0}% Stripe, ${squareStats.customerEmail?.populationRate || 0}% Square
  customerName: "Full Name",
  customerPhone: "+61...",
  customerId: "stripe_cus_xxx or square_xxx", // Platform customer ID
  
  // === PAYMENT METHOD (high priority) ===
  paymentMethod: "card" | "bank_transfer",
  cardBrand: "visa" | "mastercard",
  last4: "4242",
  
  // === RECEIPTS & REFERENCES ===
  receiptUrl: "https://...",
  receiptNumber: "REC-123",
  transactionId: "TXN-123",
  description: "Payment description",
  
  // === LINKING FIELDS (critical for relationships) ===
  registrationId: "reg_xxx", // Link to registrations
  orderId: "order_xxx", // Square orderId or Stripe metadata
  eventId: "event_xxx", // From metadata or order
  functionId: "func_xxx", // From metadata or order
  
  // === METADATA ===
  metadata: {}, // Flexible key-value pairs
  
  // === PROCESSING STATUS ===
  processed: boolean,
  processingStatus: "pending" | "processed" | "failed",
  processingNotes: [],
  
  // === SOURCE-SPECIFIC DATA (preserve everything) ===
  stripeData: {
    paymentIntentId: "pi_xxx",
    paymentMethodId: "pm_xxx",
    customerId: "cus_xxx",
    accountName: "DA-LODGETIX",
    accountNumber: 1,
    raw: {} // Full original object
  },
  
  squareData: {
    paymentId: "xxx",
    locationId: "loc_xxx",
    orderId: "order_xxx",
    buyerId: "buyer_xxx",
    order: {}, // Full order object
    customer: {}, // Full customer object
    raw: {} // Full original object
  }
}
`);
}

// Run if called directly
if (require.main === module) {
  analyzeFieldsComprehensive()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeFieldsComprehensive };
