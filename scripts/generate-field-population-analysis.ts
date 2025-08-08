// @ts-nocheck
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function generateFieldPopulationAnalysis() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('Generating field population analysis...\n');
    
    // Get all flattened payments
    const payments = await db.collection('payments_fully_flattened').find().toArray();
    const stripePayments = payments.filter(p => p.source === 'stripe');
    const squarePayments = payments.filter(p => p.source === 'square');
    
    // Analyze fields
    const allFields = new Map();
    const stripeFields = new Map();
    const squareFields = new Map();
    
    // Process all payments
    payments.forEach(payment => {
      Object.entries(payment).forEach(([field, value]) => {
        if (!allFields.has(field)) {
          allFields.set(field, { total: 0, populated: 0, samples: [] });
        }
        allFields.get(field).total++;
        if (value !== null && value !== undefined && value !== '') {
          allFields.get(field).populated++;
          if (allFields.get(field).samples.length < 3 && typeof value !== 'object') {
            allFields.get(field).samples.push(value);
          }
        }
      });
    });
    
    // Process Stripe payments
    stripePayments.forEach(payment => {
      Object.entries(payment).forEach(([field, value]) => {
        if (!stripeFields.has(field)) {
          stripeFields.set(field, { total: 0, populated: 0, samples: [] });
        }
        stripeFields.get(field).total++;
        if (value !== null && value !== undefined && value !== '') {
          stripeFields.get(field).populated++;
          if (stripeFields.get(field).samples.length < 3 && typeof value !== 'object') {
            stripeFields.get(field).samples.push(value);
          }
        }
      });
    });
    
    // Process Square payments
    squarePayments.forEach(payment => {
      Object.entries(payment).forEach(([field, value]) => {
        if (!squareFields.has(field)) {
          squareFields.set(field, { total: 0, populated: 0, samples: [] });
        }
        squareFields.get(field).total++;
        if (value !== null && value !== undefined && value !== '') {
          squareFields.get(field).populated++;
          if (squareFields.get(field).samples.length < 3 && typeof value !== 'object') {
            squareFields.get(field).samples.push(value);
          }
        }
      });
    });
    
    // Generate markdown content
    let markdown = '# Payment Field Population Analysis\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `## Overview\n\n`;
    markdown += `- Total Payments: ${payments.length}\n`;
    markdown += `- Stripe Payments: ${stripePayments.length}\n`;
    markdown += `- Square Payments: ${squarePayments.length}\n\n`;
    
    // Combined fields
    markdown += '## All Fields (Combined Stripe + Square)\n\n';
    markdown += '| Field Name | Population % | Populated Count | Total Count | Sample Values |\n';
    markdown += '|------------|--------------|-----------------|-------------|---------------|\n';
    
    const sortedAllFields = [...allFields.entries()]
      .map(([field, stats]) => ({
        field,
        populationRate: (stats.populated / stats.total * 100).toFixed(1),
        populated: stats.populated,
        total: stats.total,
        samples: stats.samples
      }))
      .sort((a, b) => parseFloat(b.populationRate) - parseFloat(a.populationRate));
    
    sortedAllFields.forEach(({ field, populationRate, populated, total, samples }) => {
      const sampleStr = samples.length > 0 ? samples.slice(0, 2).map(s => `\`${s}\``).join(', ') : '';
      markdown += `| ${field} | ${populationRate}% | ${populated} | ${total} | ${sampleStr} |\n`;
    });
    
    // Stripe-only fields
    markdown += '\n## Stripe Fields Only\n\n';
    markdown += '| Field Name | Population % | Populated Count | Total Count | Sample Values |\n';
    markdown += '|------------|--------------|-----------------|-------------|---------------|\n';
    
    const sortedStripeFields = [...stripeFields.entries()]
      .map(([field, stats]) => ({
        field,
        populationRate: (stats.populated / stats.total * 100).toFixed(1),
        populated: stats.populated,
        total: stats.total,
        samples: stats.samples,
        existsInSquare: squareFields.has(field)
      }))
      .sort((a, b) => parseFloat(b.populationRate) - parseFloat(a.populationRate));
    
    sortedStripeFields.forEach(({ field, populationRate, populated, total, samples, existsInSquare }) => {
      const sampleStr = samples.length > 0 ? samples.slice(0, 2).map(s => `\`${s}\``).join(', ') : '';
      const marker = existsInSquare ? '' : '⭐';
      markdown += `| ${field}${marker} | ${populationRate}% | ${populated} | ${total} | ${sampleStr} |\n`;
    });
    
    markdown += '\n_⭐ = Stripe-only field_\n';
    
    // Square-only fields
    markdown += '\n## Square Fields Only\n\n';
    markdown += '| Field Name | Population % | Populated Count | Total Count | Sample Values |\n';
    markdown += '|------------|--------------|-----------------|-------------|---------------|\n';
    
    const sortedSquareFields = [...squareFields.entries()]
      .map(([field, stats]) => ({
        field,
        populationRate: (stats.populated / stats.total * 100).toFixed(1),
        populated: stats.populated,
        total: stats.total,
        samples: stats.samples,
        existsInStripe: stripeFields.has(field)
      }))
      .sort((a, b) => parseFloat(b.populationRate) - parseFloat(a.populationRate));
    
    sortedSquareFields.forEach(({ field, populationRate, populated, total, samples, existsInStripe }) => {
      const sampleStr = samples.length > 0 ? samples.slice(0, 2).map(s => `\`${s}\``).join(', ') : '';
      const marker = existsInStripe ? '' : '⭐';
      markdown += `| ${field}${marker} | ${populationRate}% | ${populated} | ${total} | ${sampleStr} |\n`;
    });
    
    markdown += '\n_⭐ = Square-only field_\n';
    
    // Common fields comparison
    markdown += '\n## Common Fields Comparison\n\n';
    markdown += 'Fields that exist in both Stripe and Square with their respective population rates:\n\n';
    markdown += '| Field Name | Stripe % | Square % | Difference | Overall % |\n';
    markdown += '|------------|----------|----------|------------|----------|\n';
    
    const commonFields = sortedAllFields.filter(f => 
      stripeFields.has(f.field) && squareFields.has(f.field)
    );
    
    commonFields.forEach(({ field }) => {
      const stripeStats = stripeFields.get(field);
      const squareStats = squareFields.get(field);
      const stripeRate = (stripeStats.populated / stripeStats.total * 100).toFixed(1);
      const squareRate = (squareStats.populated / squareStats.total * 100).toFixed(1);
      const diff = Math.abs(parseFloat(stripeRate) - parseFloat(squareRate)).toFixed(1);
      const overall = ((stripeStats.populated + squareStats.populated) / (stripeStats.total + squareStats.total) * 100).toFixed(1);
      
      markdown += `| ${field} | ${stripeRate}% | ${squareRate}% | ${diff}% | ${overall}% |\n`;
    });
    
    // Key insights
    markdown += '\n## Key Insights\n\n';
    
    // Fields with 100% population in both
    const perfectFields = commonFields.filter(f => {
      const stripeStats = stripeFields.get(f.field);
      const squareStats = squareFields.get(f.field);
      return stripeStats.populated === stripeStats.total && 
             squareStats.populated === squareStats.total;
    });
    
    markdown += `### Fields with 100% population in both sources (${perfectFields.length}):\n`;
    perfectFields.forEach(f => markdown += `- ${f.field}\n`);
    
    // High value fields
    const highValueFields = commonFields.filter(f => {
      const overall = parseFloat(f.populationRate);
      return overall > 80 && overall < 100;
    });
    
    markdown += `\n### High-value common fields (>80% overall, ${highValueFields.length}):\n`;
    highValueFields.forEach(f => markdown += `- ${f.field} (${f.populationRate}%)\n`);
    
    // Fields with significant differences
    markdown += '\n### Fields with significant population differences (>50% difference):\n';
    commonFields.forEach(({ field }) => {
      const stripeStats = stripeFields.get(field);
      const squareStats = squareFields.get(field);
      const stripeRate = (stripeStats.populated / stripeStats.total * 100);
      const squareRate = (squareStats.populated / squareStats.total * 100);
      const diff = Math.abs(stripeRate - squareRate);
      
      if (diff > 50) {
        markdown += `- ${field}: Stripe ${stripeRate.toFixed(1)}% vs Square ${squareRate.toFixed(1)}%\n`;
      }
    });
    
    // Save markdown file
    const outputPath = path.join(__dirname, '..', 'FIELD-POPULATION-ANALYSIS.md');
    await fs.writeFile(outputPath, markdown);
    
    console.log(`✅ Field population analysis saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  generateFieldPopulationAnalysis()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { generateFieldPopulationAnalysis };
