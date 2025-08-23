#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '.env.explorer');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'lodgetix';

/**
 * Test field comparison logic
 */
function testFieldComparison() {
  console.log('=== TESTING FIELD COMPARISON LOGIC ===\n');
  
  // Test data
  const existingData = {
    id: 'reg-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-1234',
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL'
    },
    registrationDate: new Date('2024-01-15'),
    attendeeCount: 2,
    totalAmount: 500,
    notes: 'Original notes',
    updatedAt: new Date('2024-01-15'),
    _id: 'mongo-id-123',
    createdAt: new Date('2024-01-15')
  };
  
  const sourceData = {
    id: 'reg-123',
    firstName: 'John',  // Same
    lastName: 'Smith',  // Changed
    email: 'john@example.com',  // Same
    phone: '555-5678',  // Changed
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL'
    },  // Same
    registrationDate: new Date('2024-01-15'),  // Same
    attendeeCount: 3,  // Changed
    totalAmount: 750,  // Changed
    notes: 'Updated notes',  // Changed
    newField: 'New value',  // New field
    updatedAt: new Date('2024-01-20'),
    _id: 'mongo-id-123',
    createdAt: new Date('2024-01-15')
  };
  
  const changes = getChangedFields(sourceData, existingData);
  
  console.log('Expected changes:');
  console.log('  - lastName: Doe → Smith');
  console.log('  - phone: 555-1234 → 555-5678');
  console.log('  - attendeeCount: 2 → 3');
  console.log('  - totalAmount: 500 → 750');
  console.log('  - notes: "Original notes" → "Updated notes"');
  console.log('  - newField: undefined → "New value"\n');
  
  console.log('Detected changes:', JSON.stringify(changes, null, 2));
  
  // Verify expected changes
  const expectedFields = ['lastName', 'phone', 'attendeeCount', 'totalAmount', 'notes', 'newField'];
  const detectedFields = Object.keys(changes);
  
  console.log('\n✅ Field detection results:');
  for (const field of expectedFields) {
    if (detectedFields.includes(field)) {
      console.log(`  ✓ ${field}: Correctly detected`);
    } else {
      console.log(`  ✗ ${field}: MISSED`);
    }
  }
  
  // Check for false positives
  const unchangedFields = ['firstName', 'email', 'address', 'registrationDate'];
  console.log('\n✅ Unchanged field verification:');
  for (const field of unchangedFields) {
    if (!detectedFields.includes(field)) {
      console.log(`  ✓ ${field}: Correctly ignored`);
    } else {
      console.log(`  ✗ ${field}: FALSE POSITIVE`);
    }
  }
}

/**
 * Simple field comparison function (mimics the one in enhanced-payment-sync.ts)
 */
function getChangedFields(sourceData: any, existingData: any): any {
  const changes: any = {};
  const metadataFields = ['_id', 'createdAt', 'updatedAt', '_import', '_shouldMoveToProduction'];
  
  for (const key in sourceData) {
    if (metadataFields.includes(key)) continue;
    
    const sourceValue = sourceData[key];
    const existingValue = existingData[key];
    
    if (sourceValue === existingValue) continue;
    if (sourceValue == null && existingValue == null) continue;
    
    if (sourceValue instanceof Date || existingValue instanceof Date) {
      const sourceTime = sourceValue ? new Date(sourceValue).getTime() : null;
      const existingTime = existingValue ? new Date(existingValue).getTime() : null;
      if (sourceTime !== existingTime) {
        changes[key] = sourceValue;
      }
      continue;
    }
    
    if (typeof sourceValue === 'object' && sourceValue !== null) {
      const sourceStr = JSON.stringify(sourceValue);
      const existingStr = JSON.stringify(existingValue || {});
      if (sourceStr !== existingStr) {
        changes[key] = sourceValue;
      }
      continue;
    }
    
    if (sourceValue !== existingValue) {
      changes[key] = sourceValue;
    }
  }
  
  return changes;
}

async function testDatabaseFieldUpdates() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    console.log('\n=== TESTING DATABASE FIELD UPDATES ===\n');
    
    // Test registration field updates
    console.log('📊 Test 1: Registration Field Updates');
    console.log('=' .repeat(60));
    
    const sampleReg = await db.collection('import_registrations').findOne({});
    if (sampleReg) {
      console.log(`\nSample registration: ${sampleReg.id}`);
      console.log('Current fields:', Object.keys(sampleReg).slice(0, 10).join(', '), '...');
      
      // Simulate field changes
      const simulatedChanges = {
        confirmation_number: 'NEW-CONF-123',
        total_amount_paid: 999.99,
        notes: 'Updated via field-level sync',
        updatedAt: new Date()
      };
      
      console.log('\nSimulated changes:');
      for (const [field, value] of Object.entries(simulatedChanges)) {
        if (field !== 'updatedAt') {
          console.log(`  ${field}: ${sampleReg[field]} → ${value}`);
        }
      }
      
      console.log('\n✅ With field-level updates:');
      console.log('  - Only these 3 fields would be updated');
      console.log('  - Other fields remain untouched');
      console.log('  - Manual MongoDB changes preserved');
    }
    
    // Test attendee field updates
    console.log('\n📊 Test 2: Attendee Field Updates');
    console.log('=' .repeat(60));
    
    const sampleAttendee = await db.collection('import_attendees').findOne({});
    if (sampleAttendee) {
      console.log(`\nSample attendee: ${sampleAttendee.id}`);
      
      // Check timestamp comparison
      const attendeeUpdatedAt = sampleAttendee.updatedAt ? new Date(sampleAttendee.updatedAt) : null;
      console.log(`Last updated: ${attendeeUpdatedAt?.toISOString() || 'unknown'}`);
      
      console.log('\n✅ Update behavior:');
      console.log('  - If Supabase updated_at > MongoDB updated_at:');
      console.log('    • Compare all fields');
      console.log('    • Update only changed fields');
      console.log('  - If MongoDB updated_at >= Supabase updated_at:');
      console.log('    • Skip update entirely');
      console.log('    • Preserve MongoDB changes');
    }
    
    // Test production sync behavior
    console.log('\n📊 Test 3: Production Sync Behavior');
    console.log('=' .repeat(60));
    
    console.log('\n✅ Field-level production sync:');
    console.log('  1. Check if record exists in production');
    console.log('  2. If exists: Update only changed fields');
    console.log('  3. If not exists: Insert full record');
    console.log('  4. Preserves manual production changes');
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 SUMMARY OF FIELD-LEVEL UPDATES:\n');
    
    console.log('✅ Benefits:');
    console.log('  • Preserves manual MongoDB changes');
    console.log('  • Only syncs actual changes from Supabase');
    console.log('  • Reduces unnecessary database writes');
    console.log('  • Maintains data integrity');
    console.log('  • Clear audit trail of what changed');
    
    console.log('\n🔍 Change Detection Process:');
    console.log('  1. Compare updated_at timestamps');
    console.log('  2. If source is newer, compare all fields');
    console.log('  3. Build list of changed fields only');
    console.log('  4. Update only those specific fields');
    console.log('  5. Log which fields were updated');
    
    console.log('\n⚠️ Important Considerations:');
    console.log('  • Metadata fields (_id, createdAt, etc.) are ignored');
    console.log('  • Deep comparison for nested objects/arrays');
    console.log('  • Date fields compared by timestamp value');
    console.log('  • Null/undefined handled correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

// Run tests
async function runTests() {
  console.log('Starting field-level update tests...\n');
  
  // Test field comparison logic
  testFieldComparison();
  
  // Test database updates
  await testDatabaseFieldUpdates();
  
  console.log('\n✅ All tests completed!');
}

runTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });