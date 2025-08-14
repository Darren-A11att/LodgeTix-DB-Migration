#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function verifyImportCollections() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    // Check import collections
    console.log('📦 Import Collections Status:');
    console.log('═══════════════════════════════');
    
    const importCollections = [
      'import_payments',
      'import_registrations', 
      'import_attendees',
      'import_tickets',
      'import_contacts'
    ];
    
    for (const coll of importCollections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`\n${coll}: ${count} documents`);
      
      // Get a sample document to check field transformation
      const sample = await db.collection(coll).findOne({});
      if (sample) {
        console.log('  Sample fields (checking camelCase transformation):');
        const fields = Object.keys(sample).slice(0, 10);
        fields.forEach(field => {
          const hasUnderscore = field.includes('_');
          const icon = hasUnderscore && !field.startsWith('_') ? '⚠️' : '✓';
          console.log(`    ${icon} ${field}`);
        });
        
        // Check for productionMeta
        if (sample._productionMeta) {
          console.log('  ✓ Has _productionMeta tracking');
          console.log(`    - lastImportedAt: ${sample._productionMeta.lastImportedAt}`);
          console.log(`    - source: ${sample._productionMeta.source}`);
          if (sample._productionMeta.productionObjectId) {
            console.log(`    - productionObjectId: ${sample._productionMeta.productionObjectId}`);
          }
        } else {
          console.log('  ⚠️  Missing _productionMeta tracking');
        }
      }
    }
    
    // Check production collections for comparison
    console.log('\n\n📊 Production Collections Status:');
    console.log('═══════════════════════════════════');
    
    const prodCollections = ['payments', 'registrations', 'attendees', 'tickets', 'contacts'];
    
    for (const coll of prodCollections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`${coll}: ${count} documents`);
    }
    
    // Check for selective sync evidence
    console.log('\n\n🔄 Selective Sync Analysis:');
    console.log('════════════════════════════');
    
    // Compare import vs production counts
    for (const baseName of ['payments', 'registrations', 'attendees', 'tickets', 'contacts']) {
      const importCount = await db.collection(`import_${baseName}`).countDocuments();
      const prodCount = await db.collection(baseName).countDocuments();
      
      if (importCount > 0) {
        const status = prodCount >= importCount ? '✓' : '⚠️';
        console.log(`${status} ${baseName}: import=${importCount}, production=${prodCount}`);
      }
    }
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

verifyImportCollections().catch(console.error);