const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeFlattenedSimilarity() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FLATTENED PAYMENTS SIMILARITY ANALYSIS ===\n');
    
    // Get all flattened payments
    const payments = await db.collection('unified_payments_flattened').find().toArray();
    const stripePayments = payments.filter(p => p.source === 'stripe');
    const squarePayments = payments.filter(p => p.source === 'square');
    
    console.log(`Analyzing ${stripePayments.length} Stripe and ${squarePayments.length} Square payments\n`);
    
    // Collect all fields by source
    const stripeFields = new Map();
    const squareFields = new Map();
    
    // Analyze Stripe fields
    stripePayments.forEach(payment => {
      Object.entries(payment).forEach(([field, value]) => {
        if (!stripeFields.has(field)) {
          stripeFields.set(field, {
            count: 0,
            populated: 0,
            types: new Set(),
            samples: []
          });
        }
        
        const fieldInfo = stripeFields.get(field);
        fieldInfo.count++;
        
        if (value !== null && value !== undefined && value !== '') {
          fieldInfo.populated++;
          fieldInfo.types.add(typeof value);
          if (fieldInfo.samples.length < 3 && typeof value !== 'object') {
            fieldInfo.samples.push(value);
          }
        }
      });
    });
    
    // Analyze Square fields
    squarePayments.forEach(payment => {
      Object.entries(payment).forEach(([field, value]) => {
        if (!squareFields.has(field)) {
          squareFields.set(field, {
            count: 0,
            populated: 0,
            types: new Set(),
            samples: []
          });
        }
        
        const fieldInfo = squareFields.get(field);
        fieldInfo.count++;
        
        if (value !== null && value !== undefined && value !== '') {
          fieldInfo.populated++;
          fieldInfo.types.add(typeof value);
          if (fieldInfo.samples.length < 3 && typeof value !== 'object') {
            fieldInfo.samples.push(value);
          }
        }
      });
    });
    
    // Calculate population rates
    stripeFields.forEach((info, field) => {
      info.populationRate = (info.populated / info.count * 100).toFixed(1);
    });
    
    squareFields.forEach((info, field) => {
      info.populationRate = (info.populated / info.count * 100).toFixed(1);
    });
    
    // Find exact matches
    console.log('📊 EXACT FIELD MATCHES (present in both sources):');
    console.log('─'.repeat(80));
    const exactMatches = [];
    
    stripeFields.forEach((stripeInfo, field) => {
      if (squareFields.has(field)) {
        const squareInfo = squareFields.get(field);
        exactMatches.push({
          field,
          stripePopulation: stripeInfo.populationRate,
          squarePopulation: squareInfo.populationRate,
          avgPopulation: ((parseFloat(stripeInfo.populationRate) + parseFloat(squareInfo.populationRate)) / 2).toFixed(1)
        });
      }
    });
    
    // Sort by average population rate
    exactMatches.sort((a, b) => parseFloat(b.avgPopulation) - parseFloat(a.avgPopulation));
    
    console.log('Field'.padEnd(40) + 'Stripe %'.padEnd(10) + 'Square %'.padEnd(10) + 'Avg %');
    console.log('─'.repeat(70));
    exactMatches.forEach(match => {
      console.log(
        match.field.padEnd(40) +
        match.stripePopulation.padStart(8) + '%' +
        match.squarePopulation.padStart(9) + '%' +
        match.avgPopulation.padStart(8) + '%'
      );
    });
    
    // Find source-specific fields
    console.log('\n\n📌 STRIPE-ONLY FIELDS (high population):');
    console.log('─'.repeat(60));
    const stripeOnly = [];
    stripeFields.forEach((info, field) => {
      if (!squareFields.has(field) && parseFloat(info.populationRate) > 50) {
        stripeOnly.push({ field, populationRate: info.populationRate });
      }
    });
    stripeOnly.sort((a, b) => parseFloat(b.populationRate) - parseFloat(a.populationRate));
    stripeOnly.slice(0, 20).forEach(f => {
      console.log(`${f.field.padEnd(50)} ${f.populationRate}%`);
    });
    
    console.log('\n\n📌 SQUARE-ONLY FIELDS (high population):');
    console.log('─'.repeat(60));
    const squareOnly = [];
    squareFields.forEach((info, field) => {
      if (!stripeFields.has(field) && parseFloat(info.populationRate) > 50) {
        squareOnly.push({ field, populationRate: info.populationRate });
      }
    });
    squareOnly.sort((a, b) => parseFloat(b.populationRate) - parseFloat(a.populationRate));
    squareOnly.slice(0, 20).forEach(f => {
      console.log(`${f.field.padEnd(50)} ${f.populationRate}%`);
    });
    
    // Similar field analysis
    console.log('\n\n🔄 SIMILAR FIELDS ANALYSIS:');
    console.log('─'.repeat(80));
    const similarities = [];
    
    stripeFields.forEach((stripeInfo, stripeField) => {
      squareFields.forEach((squareInfo, squareField) => {
        if (stripeField !== squareField) {
          const similarity = calculateFieldSimilarity(stripeField, squareField);
          if (similarity > 0.7) {
            similarities.push({
              stripeField,
              squareField,
              similarity,
              stripePopulation: stripeInfo.populationRate,
              squarePopulation: squareInfo.populationRate
            });
          }
        }
      });
    });
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    console.log('Stripe Field'.padEnd(35) + 'Square Field'.padEnd(35) + 'Similarity');
    console.log('─'.repeat(80));
    similarities.slice(0, 20).forEach(sim => {
      console.log(
        sim.stripeField.padEnd(35) +
        sim.squareField.padEnd(35) +
        (sim.similarity * 100).toFixed(0) + '%'
      );
    });
    
    // Recommend common schema
    console.log('\n\n✅ RECOMMENDED COMMON SCHEMA (based on flattened analysis):');
    console.log('─'.repeat(80));
    
    // Core fields (100% populated in both)
    const coreFields = exactMatches.filter(m => 
      parseFloat(m.stripePopulation) === 100 && parseFloat(m.squarePopulation) === 100
    );
    
    console.log('\nCORE FIELDS (100% populated in both):');
    coreFields.forEach(f => console.log(`  - ${f.field}`));
    
    // High value fields (>80% average)
    const highValueFields = exactMatches.filter(m => 
      parseFloat(m.avgPopulation) > 80 && !coreFields.includes(m)
    );
    
    console.log('\nHIGH VALUE FIELDS (>80% average population):');
    highValueFields.forEach(f => console.log(`  - ${f.field} (${f.avgPopulation}%)`));
    
    // Important but partial fields (>50% average)
    const partialFields = exactMatches.filter(m => 
      parseFloat(m.avgPopulation) > 50 && parseFloat(m.avgPopulation) <= 80
    );
    
    console.log('\nIMPORTANT PARTIAL FIELDS (50-80% population):');
    partialFields.forEach(f => console.log(`  - ${f.field} (${f.avgPopulation}%)`));
    
    // Source-specific important fields
    console.log('\nSOURCE-SPECIFIC IMPORTANT FIELDS:');
    console.log('Stripe-specific:');
    stripeOnly.slice(0, 5).forEach(f => console.log(`  - ${f.field} (${f.populationRate}%)`));
    console.log('Square-specific:');
    squareOnly.slice(0, 5).forEach(f => console.log(`  - ${f.field} (${f.populationRate}%)`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

function calculateFieldSimilarity(field1, field2) {
  // Normalize for comparison
  const f1 = field1.toLowerCase().replace(/[._-]/g, '');
  const f2 = field2.toLowerCase().replace(/[._-]/g, '');
  
  // Check for substring matches
  if (f1.includes(f2) || f2.includes(f1)) {
    return 0.8;
  }
  
  // Check for common parts
  const parts1 = field1.split(/[._-]/);
  const parts2 = field2.split(/[._-]/);
  
  let commonParts = 0;
  parts1.forEach(p1 => {
    parts2.forEach(p2 => {
      if (p1.toLowerCase() === p2.toLowerCase() && p1.length > 2) {
        commonParts++;
      }
    });
  });
  
  if (commonParts > 0) {
    return 0.7 + (commonParts * 0.1);
  }
  
  // Basic character matching
  let matches = 0;
  const minLen = Math.min(f1.length, f2.length);
  for (let i = 0; i < minLen; i++) {
    if (f1[i] === f2[i]) matches++;
  }
  
  return matches / Math.max(f1.length, f2.length);
}

// Run if called directly
if (require.main === module) {
  analyzeFlattenedSimilarity()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeFlattenedSimilarity };