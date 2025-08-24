/**
 * Script to compare original registrations with transformed carts
 * Shows side-by-side comparison and validation status
 */

import { MongoClient } from 'mongodb';
import { ComparisonViewer } from '../services/comparison-viewer';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const viewer = new ComparisonViewer(db);
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'single': {
        // Compare single registration
        const registrationId = args[1];
        if (!registrationId) {
          console.error('Usage: npm run compare single <registrationId>');
          process.exit(1);
        }
        
        console.log(`\nComparing registration ${registrationId}...`);
        const comparison = await viewer.compareRegistrationToCart(registrationId);
        
        if (comparison) {
          // Display in console
          console.log(viewer.formatConsoleOutput(comparison));
          
          // Save reports
          const htmlPath = await viewer.saveComparisonReport(comparison, 'html');
          const jsonPath = await viewer.saveComparisonReport(comparison, 'json');
          
          console.log(`\n✅ Reports saved:`);
          console.log(`   HTML: ${htmlPath}`);
          console.log(`   JSON: ${jsonPath}`);
        } else {
          console.error(`❌ Could not create comparison for ${registrationId}`);
        }
        break;
      }
      
      case 'sample': {
        // Compare sample of each type
        console.log('\nFinding sample registrations of each type...');
        
        const samples = await findSampleRegistrations(db);
        if (samples.length === 0) {
          console.error('No registrations found');
          break;
        }
        
        console.log(`Found ${samples.length} sample registrations`);
        const comparisons = await viewer.compareMultiple(samples, true);
        
        // Generate summary
        viewer.generateSummaryStats(comparisons);
        break;
      }
      
      case 'type': {
        // Compare all registrations of a specific type
        const type = args[1];
        if (!type) {
          console.error('Usage: npm run compare type <individual|lodge|grandLodge|masonicOrder>');
          process.exit(1);
        }
        
        console.log(`\nFinding all ${type} registrations...`);
        const ids = await findRegistrationsByType(db, type);
        
        if (ids.length === 0) {
          console.error(`No ${type} registrations found`);
          break;
        }
        
        console.log(`Found ${ids.length} ${type} registrations`);
        const limit = Math.min(ids.length, 10); // Limit to 10 for performance
        const comparisons = await viewer.compareMultiple(ids.slice(0, limit), true);
        
        // Generate summary
        viewer.generateSummaryStats(comparisons);
        
        if (ids.length > limit) {
          console.log(`\n(Showing first ${limit} of ${ids.length} registrations)`);
        }
        break;
      }
      
      case 'invalid': {
        // Find and compare invalid carts
        console.log('\nFinding carts with validation issues...');
        const invalidIds = await findInvalidCarts(db);
        
        if (invalidIds.length === 0) {
          console.log('✅ No invalid carts found!');
          break;
        }
        
        console.log(`Found ${invalidIds.length} potentially invalid carts`);
        const limit = Math.min(invalidIds.length, 5);
        const comparisons = await viewer.compareMultiple(invalidIds.slice(0, limit), true);
        
        // Generate summary
        viewer.generateSummaryStats(comparisons);
        break;
      }
      
      case 'report': {
        // Generate comprehensive report
        console.log('\nGenerating comprehensive comparison report...');
        
        // Get samples of each type
        const samples = await findSampleRegistrations(db, 2); // 2 of each type
        const comparisons = await viewer.compareMultiple(samples, true);
        
        // Create master HTML report
        const html = generateMasterReport(comparisons);
        const fs = require('fs');
        const path = require('path');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = path.join(
          process.cwd(), 
          'comparison-reports', 
          `master-report-${timestamp}.html`
        );
        
        fs.writeFileSync(filepath, html, 'utf8');
        console.log(`\n✅ Master report saved: ${filepath}`);
        
        // Generate summary
        viewer.generateSummaryStats(comparisons);
        break;
      }
      
      default:
        console.log(`
MongoDB Registration to Cart Comparison Tool

Usage:
  npm run compare single <registrationId>  - Compare a specific registration
  npm run compare sample                   - Compare sample registrations of each type
  npm run compare type <type>              - Compare all registrations of a type
  npm run compare invalid                  - Find and compare invalid carts
  npm run compare report                   - Generate comprehensive report

Types: individual, lodge, grandLodge, masonicOrder
        `);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Find sample registration IDs of each type
 */
async function findSampleRegistrations(db: any, limit = 1): Promise<string[]> {
  const types = ['individual', 'lodge', 'grandLodge', 'masonicOrder'];
  const samples: string[] = [];
  
  for (const type of types) {
    const registrations = await db.collection('registrations')
      .find({ registrationType: type })
      .limit(limit)
      .project({ registrationId: 1 })
      .toArray();
    
    samples.push(...registrations.map((r: any) => r.registrationId));
  }
  
  return samples;
}

/**
 * Find all registration IDs of a specific type
 */
async function findRegistrationsByType(db: any, type: string): Promise<string[]> {
  const registrations = await db.collection('registrations')
    .find({ registrationType: type })
    .project({ registrationId: 1 })
    .toArray();
  
  return registrations.map((r: any) => r.registrationId);
}

/**
 * Find carts that might have validation issues
 */
async function findInvalidCarts(db: any): Promise<string[]> {
  // Look for carts with potential issues
  const carts = await db.collection('carts')
    .find({
      $or: [
        { 'cartItems.formData': { $exists: false } },
        { 'cartItems.formData': null },
        { 'customer.email': { $exists: false } },
        { 'total': { $lte: 0 } }
      ]
    })
    .limit(10)
    .toArray();
  
  // Extract registration IDs
  const registrationIds: string[] = [];
  for (const cart of carts) {
    const regId = cart.cartItems?.[0]?.metadata?.registrationId;
    if (regId) {
      registrationIds.push(regId);
    }
  }
  
  return registrationIds;
}

/**
 * Generate master HTML report combining multiple comparisons
 */
function generateMasterReport(comparisons: any[]): string {
  const validCount = comparisons.filter(c => c.transformed.validation.valid).length;
  const invalidCount = comparisons.length - validCount;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Registration to Cart Migration Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #333;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #4CAF50;
    }
    .stat-label {
      color: #666;
      margin-top: 5px;
    }
    .comparison-list {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .comparison-item {
      padding: 20px;
      border-bottom: 1px solid #eee;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 20px;
      align-items: center;
    }
    .comparison-item:hover {
      background: #f8f9fa;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-badge.valid {
      background: #d4edda;
      color: #155724;
    }
    .status-badge.invalid {
      background: #f8d7da;
      color: #721c24;
    }
    .type-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      background: #e9ecef;
      color: #495057;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Registration to Cart Migration Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${comparisons.length}</div>
        <div class="stat-label">Total Comparisons</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #28a745">${validCount}</div>
        <div class="stat-label">Valid Carts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc3545">${invalidCount}</div>
        <div class="stat-label">Invalid Carts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${((validCount/comparisons.length)*100).toFixed(0)}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>
    
    <h2>Comparison Details</h2>
    <div class="comparison-list">
      ${comparisons.map(comp => `
        <div class="comparison-item">
          <div>
            <strong>${comp.registrationId}</strong>
            <br>
            <span class="type-badge">${comp.registrationType}</span>
          </div>
          <div>
            Cart: ${comp.transformed.cart.cartId.substring(0, 8)}...
          </div>
          <div>
            Items: ${comp.transformed.cart.cartItems.length}
          </div>
          <div>
            <span class="status-badge ${comp.transformed.validation.valid ? 'valid' : 'invalid'}">
              ${comp.transformed.validation.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
}

// Run the script
main().catch(console.error);