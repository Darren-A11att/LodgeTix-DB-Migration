const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeFullyFlattenedSimilarity() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FULLY FLATTENED PAYMENTS SIMILARITY ANALYSIS ===\n');
    
    // Get all flattened payments
    const payments = await db.collection('payments_fully_flattened').find().toArray();
    const stripePayments = payments.filter(p => p.source === 'stripe');
    const squarePayments = payments.filter(p => p.source === 'square');
    
    console.log(`Analyzing ${stripePayments.length} Stripe and ${squarePayments.length} Square payments\n`);
    
    // Collect field statistics
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
            samples: [],
            uniqueValues: new Set()
          });
        }
        
        const fieldInfo = stripeFields.get(field);
        fieldInfo.count++;
        
        if (value !== null && value !== undefined && value !== '') {
          fieldInfo.populated++;
          fieldInfo.types.add(typeof value);
          
          // Track unique values for similarity detection
          if (typeof value !== 'object' && fieldInfo.uniqueValues.size < 100) {
            fieldInfo.uniqueValues.add(value);
          }
          
          if (fieldInfo.samples.length < 5 && typeof value !== 'object') {
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
            samples: [],
            uniqueValues: new Set()
          });
        }
        
        const fieldInfo = squareFields.get(field);
        fieldInfo.count++;
        
        if (value !== null && value !== undefined && value !== '') {
          fieldInfo.populated++;
          fieldInfo.types.add(typeof value);
          
          // Track unique values for similarity detection
          if (typeof value !== 'object' && fieldInfo.uniqueValues.size < 100) {
            fieldInfo.uniqueValues.add(value);
          }
          
          if (fieldInfo.samples.length < 5 && typeof value !== 'object') {
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
    
    // 1. EXACT MATCHES
    console.log('📊 EXACT FIELD MATCHES:');
    console.log('─'.repeat(80));
    const exactMatches = [];
    
    stripeFields.forEach((stripeInfo, field) => {
      if (squareFields.has(field)) {
        const squareInfo = squareFields.get(field);
        exactMatches.push({
          field,
          stripePopulation: stripeInfo.populationRate,
          squarePopulation: squareInfo.populationRate,
          avgPopulation: ((parseFloat(stripeInfo.populationRate) + parseFloat(squareInfo.populationRate)) / 2).toFixed(1),
          stripeTypes: [...stripeInfo.types],
          squareTypes: [...squareInfo.types]
        });
      }
    });
    
    // Sort by average population
    exactMatches.sort((a, b) => parseFloat(b.avgPopulation) - parseFloat(a.avgPopulation));
    
    console.log('Field'.padEnd(25) + 'Stripe %'.padEnd(10) + 'Square %'.padEnd(10) + 'Avg %'.padEnd(8) + 'Types');
    console.log('─'.repeat(80));
    exactMatches.slice(0, 30).forEach(match => {
      const typesMatch = match.stripeTypes.join(',') === match.squareTypes.join(',') ? '✓' : '✗';
      console.log(
        match.field.padEnd(25) +
        match.stripePopulation.padStart(8) + '%' +
        match.squarePopulation.padStart(9) + '%' +
        match.avgPopulation.padStart(7) + '%' +
        '  ' + typesMatch
      );
    });
    
    // 2. SIMILAR FIELDS BY NAME
    console.log('\n\n🔄 SIMILAR FIELD NAMES:');
    console.log('─'.repeat(80));
    const nameSimularities = [];
    
    stripeFields.forEach((stripeInfo, stripeField) => {
      squareFields.forEach((squareInfo, squareField) => {
        if (stripeField !== squareField) {
          const similarity = calculateNameSimilarity(stripeField, squareField);
          if (similarity > 0.6) {
            nameSimularities.push({
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
    
    nameSimularities.sort((a, b) => b.similarity - a.similarity);
    console.log('Stripe Field'.padEnd(25) + 'Square Field'.padEnd(25) + 'Similarity');
    console.log('─'.repeat(80));
    nameSimularities.slice(0, 15).forEach(sim => {
      console.log(
        sim.stripeField.padEnd(25) +
        sim.squareField.padEnd(25) +
        (sim.similarity * 100).toFixed(0) + '%'
      );
    });
    
    // 3. SIMILAR FIELDS BY VALUE OVERLAP
    console.log('\n\n🔍 SIMILAR FIELDS BY VALUE CONTENT:');
    console.log('─'.repeat(80));
    const valueSimularities = [];
    
    stripeFields.forEach((stripeInfo, stripeField) => {
      if (stripeInfo.uniqueValues.size > 0) {
        squareFields.forEach((squareInfo, squareField) => {
          if (squareField !== stripeField && squareInfo.uniqueValues.size > 0) {
            // Check if values overlap
            const overlap = [...stripeInfo.uniqueValues].filter(v => 
              squareInfo.uniqueValues.has(v)
            ).length;
            
            if (overlap > 0) {
              const overlapRate = overlap / Math.min(stripeInfo.uniqueValues.size, squareInfo.uniqueValues.size);
              if (overlapRate > 0.3) {
                valueSimularities.push({
                  stripeField,
                  squareField,
                  overlapRate,
                  overlappingValues: overlap,
                  examples: [...stripeInfo.uniqueValues].filter(v => squareInfo.uniqueValues.has(v)).slice(0, 3)
                });
              }
            }
          }
        });
      }
    });
    
    valueSimularities.sort((a, b) => b.overlapRate - a.overlapRate);
    console.log('Stripe Field'.padEnd(25) + 'Square Field'.padEnd(25) + 'Value Overlap');
    console.log('─'.repeat(80));
    valueSimularities.slice(0, 15).forEach(sim => {
      console.log(
        sim.stripeField.padEnd(25) +
        sim.squareField.padEnd(25) +
        (sim.overlapRate * 100).toFixed(0) + '%' +
        ' (' + sim.overlappingValues + ' values)'
      );
      if (sim.examples.length > 0) {
        console.log('  Examples: ' + sim.examples.join(', '));
      }
    });
    
    // 4. RECOMMENDED MAPPINGS
    console.log('\n\n✅ RECOMMENDED FIELD MAPPINGS:');
    console.log('─'.repeat(80));
    
    // Combine exact matches and high-confidence similarities
    const recommendedMappings = new Map();
    
    // Add exact matches with high population
    exactMatches.filter(m => parseFloat(m.avgPopulation) > 50).forEach(m => {
      recommendedMappings.set(m.field, {
        stripeField: m.field,
        squareField: m.field,
        confidence: 'exact',
        avgPopulation: m.avgPopulation
      });
    });
    
    // Add high-confidence name similarities
    nameSimularities.filter(s => s.similarity > 0.8).forEach(s => {
      const key = s.stripeField + '→' + s.squareField;
      if (!recommendedMappings.has(key)) {
        recommendedMappings.set(key, {
          stripeField: s.stripeField,
          squareField: s.squareField,
          confidence: 'name',
          similarity: s.similarity
        });
      }
    });
    
    // Add high-confidence value similarities
    valueSimularities.filter(s => s.overlapRate > 0.8).forEach(s => {
      const key = s.stripeField + '→' + s.squareField;
      if (!recommendedMappings.has(key)) {
        recommendedMappings.set(key, {
          stripeField: s.stripeField,
          squareField: s.squareField,
          confidence: 'value',
          overlapRate: s.overlapRate
        });
      }
    });
    
    console.log('Mapping Type'.padEnd(15) + 'Stripe Field'.padEnd(25) + 'Square Field'.padEnd(25) + 'Confidence');
    console.log('─'.repeat(80));
    [...recommendedMappings.values()].forEach(mapping => {
      const confidence = mapping.confidence === 'exact' ? '100%' :
                        mapping.confidence === 'name' ? (mapping.similarity * 100).toFixed(0) + '%' :
                        (mapping.overlapRate * 100).toFixed(0) + '%';
      console.log(
        mapping.confidence.padEnd(15) +
        mapping.stripeField.padEnd(25) +
        mapping.squareField.padEnd(25) +
        confidence
      );
    });
    
    // 5. UNIFIED SCHEMA RECOMMENDATION
    console.log('\n\n📋 RECOMMENDED UNIFIED SCHEMA:');
    console.log('─'.repeat(80));
    
    // Core fields (high population in both)
    const coreFields = exactMatches.filter(m => 
      parseFloat(m.stripePopulation) > 90 && parseFloat(m.squarePopulation) > 90
    );
    
    console.log('\nCORE FIELDS (>90% in both):');
    coreFields.forEach(f => console.log(`  ${f.field} (${f.avgPopulation}%)`));
    
    // Important fields (high in at least one)
    const importantFields = exactMatches.filter(m => 
      parseFloat(m.avgPopulation) > 50 && !coreFields.includes(m)
    );
    
    console.log('\nIMPORTANT FIELDS (>50% average):');
    importantFields.forEach(f => console.log(`  ${f.field} (Stripe: ${f.stripePopulation}%, Square: ${f.squarePopulation}%)`));
    
    // Source-specific critical fields
    console.log('\nCRITICAL SOURCE-SPECIFIC FIELDS:');
    console.log('Stripe (>90% populated):');
    [...stripeFields.entries()]
      .filter(([field, info]) => !squareFields.has(field) && parseFloat(info.populationRate) > 90)
      .sort((a, b) => parseFloat(b[1].populationRate) - parseFloat(a[1].populationRate))
      .slice(0, 10)
      .forEach(([field, info]) => console.log(`  ${field} (${info.populationRate}%)`));
      
    console.log('\nSquare (>90% populated):');
    [...squareFields.entries()]
      .filter(([field, info]) => !stripeFields.has(field) && parseFloat(info.populationRate) > 90)
      .sort((a, b) => parseFloat(b[1].populationRate) - parseFloat(a[1].populationRate))
      .slice(0, 10)
      .forEach(([field, info]) => console.log(`  ${field} (${info.populationRate}%)`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

function calculateNameSimilarity(str1, str2) {
  // Normalize strings
  const s1 = str1.toLowerCase().replace(/[_-]/g, '');
  const s2 = str2.toLowerCase().replace(/[_-]/g, '');
  
  // Check for exact match after normalization
  if (s1 === s2) return 1.0;
  
  // Check for substring
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLength);
}

// Run if called directly
if (require.main === module) {
  analyzeFullyFlattenedSimilarity()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeFullyFlattenedSimilarity };