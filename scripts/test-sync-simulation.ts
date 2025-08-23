#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env.explorer');
dotenv.config({ path: envPath });

/**
 * Simulate the sync process with field-level updates
 */
function simulateSyncProcess() {
  console.log('=== SIMULATING INCREMENTAL SYNC WITH FIELD-LEVEL UPDATES ===\n');
  
  // Simulate a payment that already exists
  const existingPayment = {
    id: 'sq_payment_123',
    amount: 500,
    status: 'COMPLETED',
    updatedAt: '2024-01-15T10:00:00Z'
  };
  
  // Simulate fetching the same payment from Square (unchanged)
  const squarePayment = {
    id: 'sq_payment_123',
    amount: 500,
    status: 'COMPLETED',
    updatedAt: '2024-01-15T10:00:00Z'
  };
  
  // Simulate the registration in MongoDB
  const mongoRegistration = {
    id: 'reg_123',
    paymentId: 'sq_payment_123',
    confirmationNumber: 'CONF-2024-001',
    attendeeCount: 2,
    totalAmount: 500,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    notes: 'VIP guest',
    specialRequests: 'Vegetarian meal',
    updatedAt: '2024-01-15T10:00:00Z'
  };
  
  // Simulate the registration from Supabase (with some updates)
  const supabaseRegistration = {
    id: 'reg_123',
    paymentId: 'sq_payment_123',
    confirmationNumber: 'CONF-2024-001',  // Same
    attendeeCount: 3,  // Changed from 2 to 3
    totalAmount: 500,  // Same
    customerName: 'John Doe',  // Same
    customerEmail: 'john.doe@example.com',  // Changed email
    notes: 'VIP guest - Updated',  // Changed notes
    specialRequests: 'Vegetarian meal',  // Same
    tableAssignment: 'Table 5',  // New field
    updatedAt: '2024-01-20T14:30:00Z'  // Newer timestamp
  };
  
  console.log('📦 SCENARIO: Payment exists and unchanged, but registration updated\n');
  console.log('Step 1: Check payment');
  console.log(`  Payment ${existingPayment.id} already exists in production`);
  console.log(`  Square updated: ${squarePayment.updatedAt}`);
  console.log(`  MongoDB updated: ${existingPayment.updatedAt}`);
  console.log('  ✓ Payment unchanged - skipping payment update\n');
  
  console.log('Step 2: Check registration for updates');
  console.log(`  Registration ${mongoRegistration.id} found`);
  console.log(`  Supabase updated: ${supabaseRegistration.updatedAt}`);
  console.log(`  MongoDB updated: ${mongoRegistration.updatedAt}`);
  console.log('  🔄 Registration is newer in Supabase\n');
  
  console.log('Step 3: Compare fields');
  const changedFields = compareFields(supabaseRegistration, mongoRegistration);
  console.log('  Changed fields detected:');
  for (const [field, value] of Object.entries(changedFields)) {
    const oldValue = (mongoRegistration as any)[field];
    console.log(`    • ${field}: "${oldValue}" → "${value}"`);
  }
  console.log();
  
  console.log('Step 4: Update only changed fields');
  console.log('  MongoDB update query:');
  console.log('  db.collection("import_registrations").updateOne(');
  console.log('    { id: "reg_123" },');
  console.log('    { $set: {');
  for (const [field, value] of Object.entries(changedFields)) {
    console.log(`      ${field}: "${value}",`);
  }
  console.log('      updatedAt: new Date()');
  console.log('    }}');
  console.log('  )\n');
  
  console.log('Step 5: Process related records');
  console.log('  ✓ Check attendees for updates (field-level)');
  console.log('  ✓ Check tickets for updates (field-level)');
  console.log('  ✓ Check contacts for updates (field-level)\n');
  
  console.log('✅ RESULT: Only 4 fields updated, preserving all other MongoDB data\n');
  
  // Show what would happen without field-level updates
  console.log('⚠️  WITHOUT FIELD-LEVEL UPDATES (old approach):');
  console.log('  • Entire registration would be replaced');
  console.log('  • Manual MongoDB changes would be lost');
  console.log('  • All 9+ fields would be rewritten');
  console.log('  • Unnecessary database writes\n');
  
  console.log('✅ WITH FIELD-LEVEL UPDATES (new approach):');
  console.log('  • Only 4 changed fields updated');
  console.log('  • Manual MongoDB changes preserved');
  console.log('  • Efficient database operations');
  console.log('  • Clear audit trail of changes');
}

function compareFields(source: any, existing: any): any {
  const changes: any = {};
  const metadataFields = ['_id', 'createdAt', 'updatedAt'];
  
  for (const key in source) {
    if (metadataFields.includes(key)) continue;
    
    const sourceValue = source[key];
    const existingValue = existing[key];
    
    if (sourceValue !== existingValue && !(sourceValue == null && existingValue == null)) {
      changes[key] = sourceValue;
    }
  }
  
  return changes;
}

/**
 * Simulate attendee field updates
 */
function simulateAttendeeUpdates() {
  console.log('=== SIMULATING ATTENDEE FIELD-LEVEL UPDATES ===\n');
  
  const mongoAttendee = {
    id: 'att_001',
    registrationId: 'reg_123',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    dietaryRestrictions: 'None',
    tableNumber: 5,
    checkedIn: false,
    manualNote: 'Assigned to head table by admin',  // Manual MongoDB addition
    updatedAt: '2024-01-18T10:00:00Z'
  };
  
  const supabaseAttendee = {
    id: 'att_001',
    registrationId: 'reg_123',
    firstName: 'Jane',
    lastName: 'Smith-Johnson',  // Changed
    email: 'jane@example.com',
    dietaryRestrictions: 'Vegetarian',  // Changed
    tableNumber: 5,
    checkedIn: true,  // Changed
    // Note: manualNote field doesn't exist in Supabase
    updatedAt: '2024-01-20T14:30:00Z'
  };
  
  console.log('📋 Attendee Update Scenario:\n');
  console.log('MongoDB record has manual field: "manualNote"');
  console.log('Supabase has updates to: lastName, dietaryRestrictions, checkedIn\n');
  
  const changes = compareFields(supabaseAttendee, mongoAttendee);
  
  console.log('Field-level update will:');
  console.log('  ✅ Update changed fields:');
  for (const [field, value] of Object.entries(changes)) {
    const oldValue = (mongoAttendee as any)[field];
    console.log(`    • ${field}: "${oldValue}" → "${value}"`);
  }
  console.log('  ✅ Preserve manual MongoDB field:');
  console.log('    • manualNote: "Assigned to head table by admin" (unchanged)');
  console.log('\n✨ Result: Manual notes preserved while syncing Supabase changes');
}

/**
 * Show the complete flow
 */
function showCompleteFlow() {
  console.log('\n=== COMPLETE INCREMENTAL SYNC FLOW ===\n');
  
  const steps = [
    {
      step: 1,
      action: 'Fetch payments from Square/Stripe',
      detail: 'Using begin_time/created[gte] filters for incremental'
    },
    {
      step: 2,
      action: 'Process each payment',
      detail: 'Check if exists in MongoDB'
    },
    {
      step: 3,
      action: 'If payment exists and unchanged',
      detail: 'Still check registration for updates'
    },
    {
      step: 4,
      action: 'Compare registration timestamps',
      detail: 'Supabase updated_at vs MongoDB updatedAt'
    },
    {
      step: 5,
      action: 'If registration newer',
      detail: 'Compare all fields to find changes'
    },
    {
      step: 6,
      action: 'Update only changed fields',
      detail: 'Preserve manual MongoDB modifications'
    },
    {
      step: 7,
      action: 'Cascade to related records',
      detail: 'Update attendees, tickets, contacts (field-level)'
    },
    {
      step: 8,
      action: 'Sync to production',
      detail: 'Update only changed fields in production too'
    }
  ];
  
  for (const item of steps) {
    console.log(`Step ${item.step}: ${item.action}`);
    console.log(`  └─ ${item.detail}\n`);
  }
  
  console.log('🎯 KEY BENEFITS:');
  console.log('  • Incremental sync reduces API calls');
  console.log('  • Field-level updates preserve manual changes');
  console.log('  • Efficient database operations');
  console.log('  • Complete audit trail');
  console.log('  • Data integrity maintained');
}

// Run simulation
console.log('Starting sync simulation...\n');
simulateSyncProcess();
console.log('\n' + '='.repeat(70) + '\n');
simulateAttendeeUpdates();
console.log('\n' + '='.repeat(70));
showCompleteFlow();
console.log('\n✅ Simulation completed!');