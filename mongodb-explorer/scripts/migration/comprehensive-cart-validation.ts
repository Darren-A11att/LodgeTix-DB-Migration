import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface BundleProduct {
  _id: string;
  name: string;
  bundledProducts?: Array<{
    productId: string;
    quantity: number;
    isOptional: boolean;
  }>;
}

interface CartItem {
  _id: string;
  productId: string;
  quantity: number;
  parentItemId?: string;
  formData?: any;
}

interface Individual {
  _id: string;
  name: string;
  cart: CartItem[];
}

interface ValidationResult {
  bundleValidation: {
    totalBundles: number;
    validBundles: number;
    invalidBundles: Array<{
      productId: string;
      name: string;
      issues: string[];
    }>;
  };
  cartValidation: {
    totalIndividuals: number;
    validCarts: number;
    cartIssues: Array<{
      individualId: string;
      individualName: string;
      issues: string[];
    }>;
  };
  structureValidation: {
    parentChildIntegrity: number;
    formDataCompleteness: number;
    overallHealth: number;
  };
  sampleCart?: Individual;
  recommendations: string[];
}

async function validateBundleProducts(db: any): Promise<ValidationResult['bundleValidation']> {
  console.log('🔍 Validating Bundle Products...');
  
  const products = await db.collection('products').find({ 
    bundledProducts: { $exists: true } 
  }).toArray();
  
  const validBundles: BundleProduct[] = [];
  const invalidBundles: ValidationResult['bundleValidation']['invalidBundles'] = [];
  
  for (const product of products) {
    const issues: string[] = [];
    
    // Check if bundledProducts is an array
    if (!Array.isArray(product.bundledProducts)) {
      issues.push('bundledProducts is not an array');
    } else {
      // Check if bundledProducts has items
      if (product.bundledProducts.length === 0) {
        issues.push('bundledProducts array is empty');
      }
      
      // Validate each bundled product
      for (let i = 0; i < product.bundledProducts.length; i++) {
        const bundledProduct = product.bundledProducts[i];
        
        if (!bundledProduct.productId) {
          issues.push(`bundledProducts[${i}] missing productId`);
        }
        
        if (typeof bundledProduct.quantity !== 'number' || bundledProduct.quantity <= 0) {
          issues.push(`bundledProducts[${i}] invalid quantity`);
        }
        
        if (typeof bundledProduct.isOptional !== 'boolean') {
          issues.push(`bundledProducts[${i}] missing or invalid isOptional flag`);
        }
      }
    }
    
    if (issues.length === 0) {
      validBundles.push(product);
    } else {
      invalidBundles.push({
        productId: product._id.toString(),
        name: product.name || 'Unknown',
        issues
      });
    }
  }
  
  console.log(`   ✓ Found ${validBundles.length} valid bundle products`);
  console.log(`   ⚠ Found ${invalidBundles.length} invalid bundle products`);
  
  return {
    totalBundles: products.length,
    validBundles: validBundles.length,
    invalidBundles
  };
}

async function validateLegacyRegistrations(db: any, bundleProducts: string[]): Promise<ValidationResult['cartValidation']> {
  console.log('🔍 Analyzing Legacy Registration Data...');
  
  const registrations = await db.collection('registrations').find({}).toArray();
  const attendees = await db.collection('attendees').find({}).toArray();
  const tickets = await db.collection('tickets').find({}).toArray();
  
  // Analyze legacy structure for migration readiness
  console.log(`   📊 Found ${registrations.length} registrations`);
  console.log(`   📊 Found ${attendees.length} attendees`);
  console.log(`   📊 Found ${tickets.length} tickets`);
  
  // Check data quality for migration
  const migrationIssues: ValidationResult['cartValidation']['cartIssues'] = [];
  let readyForMigration = 0;
  
  // Analyze registration completeness
  for (const registration of registrations) {
    const issues: string[] = [];
    
    // Check essential fields
    if (!registration.primaryAttendeeId) {
      issues.push('Missing primary attendee ID');
    }
    if (!registration.eventId) {
      issues.push('Missing event ID');
    }
    if (!registration.totalAmountPaid && registration.totalAmountPaid !== 0) {
      issues.push('Missing payment amount');
    }
    if (!registration.paymentStatus) {
      issues.push('Missing payment status');
    }
    
    // Check for attendee data
    const relatedAttendees = attendees.filter(a => 
      a.registrations && a.registrations.includes(registration.registrationId)
    );
    
    if (relatedAttendees.length === 0) {
      issues.push('No attendees linked to registration');
    }
    
    // Check for ticket data
    const relatedTickets = tickets.filter(t => 
      t.ticketOwner === registration.registrationId
    );
    
    if (relatedTickets.length === 0) {
      issues.push('No tickets linked to registration');
    }
    
    if (issues.length === 0) {
      readyForMigration++;
    } else {
      migrationIssues.push({
        individualId: registration._id.toString(),
        individualName: `Registration ${registration.registrationId || 'Unknown'}`,
        issues
      });
    }
  }
  
  console.log(`   ✅ ${readyForMigration} registrations ready for migration`);
  console.log(`   ⚠ ${migrationIssues.length} registrations need attention`);
  
  return {
    totalIndividuals: registrations.length,
    validCarts: readyForMigration,
    cartIssues: migrationIssues
  };
}

async function calculateMigrationReadiness(db: any): Promise<ValidationResult['structureValidation']> {
  console.log('🔍 Calculating Migration Readiness...');
  
  const registrations = await db.collection('registrations').find({}).toArray();
  const attendees = await db.collection('attendees').find({}).toArray();
  const tickets = await db.collection('tickets').find({}).toArray();
  
  // Calculate data completeness metrics
  let totalDataPoints = 0;
  let completeDataPoints = 0;
  
  // Registration data completeness
  for (const reg of registrations) {
    const requiredFields = ['registrationId', 'eventId', 'primaryAttendeeId', 'paymentStatus', 'totalAmountPaid'];
    totalDataPoints += requiredFields.length;
    
    requiredFields.forEach(field => {
      if (reg[field] !== undefined && reg[field] !== null && reg[field] !== '') {
        completeDataPoints++;
      }
    });
  }
  
  // Attendee data completeness
  for (const attendee of attendees) {
    const requiredFields = ['firstName', 'lastName', 'email'];
    totalDataPoints += requiredFields.length;
    
    requiredFields.forEach(field => {
      if (attendee[field] && attendee[field].toString().trim()) {
        completeDataPoints++;
      }
    });
  }
  
  // Calculate relationship integrity
  let totalRelationships = 0;
  let validRelationships = 0;
  
  // Check registration-attendee relationships
  for (const reg of registrations) {
    if (reg.primaryAttendeeId) {
      totalRelationships++;
      const attendeeExists = attendees.some(a => a.attendeeId === reg.primaryAttendeeId);
      if (attendeeExists) validRelationships++;
    }
  }
  
  // Check ticket-registration relationships  
  for (const ticket of tickets) {
    if (ticket.ticketOwner) {
      totalRelationships++;
      const regExists = registrations.some(r => r.registrationId === ticket.ticketOwner);
      if (regExists) validRelationships++;
    }
  }
  
  const dataCompleteness = totalDataPoints > 0 ? (completeDataPoints / totalDataPoints) * 100 : 0;
  const relationshipIntegrity = totalRelationships > 0 ? (validRelationships / totalRelationships) * 100 : 100;
  const migrationReadiness = (dataCompleteness + relationshipIntegrity) / 2;
  
  console.log(`   ✓ Data Completeness: ${dataCompleteness.toFixed(1)}%`);
  console.log(`   ✓ Relationship Integrity: ${relationshipIntegrity.toFixed(1)}%`);
  console.log(`   ✓ Migration Readiness Score: ${migrationReadiness.toFixed(1)}%`);
  
  return {
    parentChildIntegrity: Math.round(relationshipIntegrity * 100) / 100,
    formDataCompleteness: Math.round(dataCompleteness * 100) / 100,
    overallHealth: Math.round(migrationReadiness * 100) / 100
  };
}

async function findSampleRegistration(db: any): Promise<Individual | undefined> {
  console.log('🔍 Finding Sample Complete Registration...');
  
  const registrations = await db.collection('registrations').find({}).toArray();
  const attendees = await db.collection('attendees').find({}).toArray();
  const tickets = await db.collection('tickets').find({}).toArray();
  
  // Find a complete registration with all related data
  for (const registration of registrations) {
    // Must have essential fields
    if (!registration.registrationId || !registration.primaryAttendeeId || !registration.eventId) {
      continue;
    }
    
    // Must have related attendee
    const primaryAttendee = attendees.find(a => a.attendeeId === registration.primaryAttendeeId);
    if (!primaryAttendee) continue;
    
    // Must have related tickets
    const relatedTickets = tickets.filter(t => t.ticketOwner === registration.registrationId);
    if (relatedTickets.length === 0) continue;
    
    // Convert to sample structure for display
    const sampleStructure = {
      _id: registration._id,
      name: `${primaryAttendee.firstName} ${primaryAttendee.lastName}`,
      cart: [
        {
          // Simulated bundle structure
          _id: 'bundle-item',
          productId: 'bundle-product',
          quantity: 1,
          formData: {
            firstName: primaryAttendee.firstName,
            lastName: primaryAttendee.lastName,
            email: primaryAttendee.email,
            phone: primaryAttendee.phone
          }
        },
        ...relatedTickets.map((ticket, index) => ({
          _id: `child-item-${index}`,
          productId: ticket.eventTicketId || 'ticket-product',
          parentItemId: 'bundle-item',
          quantity: ticket.quantity || 1
        }))
      ]
    };
    
    console.log(`   ✓ Found complete sample registration: ${sampleStructure.name}`);
    return sampleStructure as Individual;
  }
  
  console.log('   ⚠ No complete sample registration found');
  return undefined;
}

function generateRecommendations(result: ValidationResult): string[] {
  const recommendations: string[] = [];
  
  // Bundle product recommendations
  if (result.bundleValidation.invalidBundles.length > 0) {
    recommendations.push('🔧 Fix invalid bundle products by ensuring all bundledProducts have valid productId, quantity, and isOptional fields');
  } else {
    recommendations.push('✅ Bundle products are properly configured and ready for migration');
  }
  
  // Registration data recommendations
  if (result.cartValidation.cartIssues.length > 0) {
    recommendations.push(`🔧 Address ${result.cartValidation.cartIssues.length} registrations with data issues before migration`);
  }
  
  // Data relationship recommendations
  if (result.structureValidation.parentChildIntegrity < 95) {
    recommendations.push('🔧 Fix data relationship integrity issues (registration-attendee-ticket links)');
  }
  
  // Data completeness recommendations
  if (result.structureValidation.formDataCompleteness < 80) {
    recommendations.push('🔧 Improve data completeness by filling in missing required fields');
  }
  
  // Migration readiness recommendations
  if (result.structureValidation.overallHealth < 60) {
    recommendations.push('⚠️ Migration readiness is below 60% - significant data cleanup needed before migration');
  } else if (result.structureValidation.overallHealth < 80) {
    recommendations.push('⚠️ Migration readiness is fair - some data cleanup recommended before migration');
  } else if (result.structureValidation.overallHealth >= 90) {
    recommendations.push('✅ Data is in excellent condition and ready for migration to new cart structure');
  } else {
    recommendations.push('✅ Data is in good condition and ready for migration with minor cleanup');
  }
  
  // Migration strategy recommendations
  const migrationReadyPercent = (result.cartValidation.validCarts / result.cartValidation.totalIndividuals) * 100;
  if (migrationReadyPercent >= 90) {
    recommendations.push('🚀 Proceed with migration - 90%+ of registrations are migration-ready');
  } else if (migrationReadyPercent >= 70) {
    recommendations.push('🚀 Migration feasible - address remaining data issues in parallel');
  } else {
    recommendations.push('⚠️ Consider phased migration approach due to data quality issues');
  }
  
  return recommendations;
}

function printDetailedReport(result: ValidationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE CART VALIDATION REPORT');
  console.log('='.repeat(80));
  
  // Bundle Products Section
  console.log('\n🎁 BUNDLE PRODUCT VALIDATION:');
  console.log(`   Total Bundle Products: ${result.bundleValidation.totalBundles}`);
  console.log(`   Valid Bundle Products: ${result.bundleValidation.validBundles} ✅`);
  console.log(`   Invalid Bundle Products: ${result.bundleValidation.invalidBundles.length} ❌`);
  
  if (result.bundleValidation.invalidBundles.length > 0) {
    console.log('\n   Invalid Bundle Details:');
    result.bundleValidation.invalidBundles.forEach((bundle, index) => {
      console.log(`   ${index + 1}. ${bundle.name} (${bundle.productId})`);
      bundle.issues.forEach(issue => console.log(`      • ${issue}`));
    });
  }
  
  // Individual Carts Section
  console.log('\n👤 LEGACY REGISTRATION ANALYSIS:');
  console.log(`   Total Registrations: ${result.cartValidation.totalIndividuals}`);
  console.log(`   Migration-Ready: ${result.cartValidation.validCarts} ✅`);
  console.log(`   Need Attention: ${result.cartValidation.cartIssues.length} ❌`);
  
  if (result.cartValidation.cartIssues.length > 0 && result.cartValidation.cartIssues.length <= 10) {
    console.log('\n   Registration Issues (showing first 10):');
    result.cartValidation.cartIssues.slice(0, 10).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.individualName} (${item.individualId})`);
      item.issues.forEach(issue => console.log(`      • ${issue}`));
    });
  }
  
  // Migration Readiness Section
  console.log('\n🏗️ MIGRATION READINESS METRICS:');
  console.log(`   Data Relationship Integrity: ${result.structureValidation.parentChildIntegrity}%`);
  console.log(`   Data Completeness: ${result.structureValidation.formDataCompleteness}%`);
  console.log(`   Migration Readiness Score: ${result.structureValidation.overallHealth}%`);
  
  // Sample Registration Section
  if (result.sampleCart) {
    console.log('\n📋 SAMPLE COMPLETE REGISTRATION STRUCTURE:');
    console.log(`   Registration: ${result.sampleCart.name} (${result.sampleCart._id})`);
    console.log(`   Simulated Cart Items: ${result.sampleCart.cart.length}`);
    
    const bundleItems = result.sampleCart.cart.filter(item => !item.parentItemId);
    const childItems = result.sampleCart.cart.filter(item => item.parentItemId);
    
    console.log(`   Bundle Items: ${bundleItems.length}`);
    console.log(`   Child Items: ${childItems.length}`);
    
    if (bundleItems.length > 0) {
      const bundleItem = bundleItems[0];
      console.log(`   Available Data Keys: ${Object.keys(bundleItem.formData || {}).join(', ')}`);
    }
  }
  
  // Recommendations Section
  console.log('\n💡 RECOMMENDATIONS:');
  result.recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  
  // Final Assessment
  console.log('\n🎯 MIGRATION ASSESSMENT:');
  const migrationReadyPercent = result.cartValidation.totalIndividuals > 0 ? 
    (result.cartValidation.validCarts / result.cartValidation.totalIndividuals) * 100 : 0;
  
  if (result.structureValidation.overallHealth >= 90 && migrationReadyPercent >= 90) {
    console.log('   ✅ EXCELLENT - Legacy data is in excellent condition, proceed with migration');
  } else if (result.structureValidation.overallHealth >= 80 && migrationReadyPercent >= 70) {
    console.log('   ✅ GOOD - Legacy data is ready for migration with minor cleanup');
  } else if (result.structureValidation.overallHealth >= 60) {
    console.log('   ⚠️ FAIR - Significant data cleanup needed before migration');
  } else {
    console.log('   ❌ POOR - Major data issues must be resolved before migration');
  }
  
  console.log(`   📊 Migration-Ready Registrations: ${migrationReadyPercent.toFixed(1)}% (${result.cartValidation.validCarts}/${result.cartValidation.totalIndividuals})`);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 END OF REPORT');
  console.log('='.repeat(80));
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    const db = client.db();
    
    // Step 1: Validate Bundle Products
    const bundleValidation = await validateBundleProducts(db);
    
    // Get list of valid bundle product IDs for cart validation
    const allBundleProducts = await db.collection('products').find({ 
      bundledProducts: { $exists: true } 
    }).toArray();
    const bundleProductIds = allBundleProducts.map((p: any) => p._id.toString());
    
    // Step 2: Analyze Legacy Registration Data
    const cartValidation = await validateLegacyRegistrations(db, bundleProductIds);
    
    // Step 3: Calculate Migration Readiness
    const structureValidation = await calculateMigrationReadiness(db);
    
    // Step 4: Find Sample Complete Registration
    const sampleCart = await findSampleRegistration(db);
    
    // Step 5: Generate Comprehensive Result
    const result: ValidationResult = {
      bundleValidation,
      cartValidation,
      structureValidation,
      sampleCart,
      recommendations: []
    };
    
    // Step 6: Generate Recommendations
    result.recommendations = generateRecommendations(result);
    
    // Step 7: Print Detailed Report
    printDetailedReport(result);
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute automatically
main().catch(console.error);

export default main;