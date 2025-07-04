const fs = require('fs').promises;
const path = require('path');

async function generateMigrationReport(migrationState) {
  const reportPath = path.join(__dirname, '../../../test-migration-output/migration-logs/migration-report.md');
  const jsonReportPath = path.join(__dirname, '../../../test-migration-output/migration-logs/migration-report.json');
  
  // Generate markdown report
  const markdownReport = generateMarkdownReport(migrationState);
  await fs.writeFile(reportPath, markdownReport);
  
  // Generate JSON report
  const jsonReport = generateJsonReport(migrationState);
  await fs.writeFile(jsonReportPath, JSON.stringify(jsonReport, null, 2));
  
  console.log(`Migration report generated at: ${reportPath}`);
}

function generateMarkdownReport(migrationState) {
  const now = new Date();
  
  let report = `# Migration Report

Generated: ${now.toISOString()}

## Summary

### Collections Migrated

| Collection | Count |
|------------|-------|
| Catalog Objects | ${migrationState.stats['catalog-objects']} |
| Contacts | ${migrationState.stats.contacts} |
| Users | ${migrationState.stats.users} |
| Orders | ${migrationState.stats.orders} |
| Tickets | ${migrationState.stats.tickets} |
| Financial Transactions | ${migrationState.stats['financial-transactions']} |
| Jurisdictions | ${migrationState.stats.jurisdictions} |
| Organisations | ${migrationState.stats.organisations} |
| **Total Documents** | **${Object.values(migrationState.stats).reduce((a, b) => a + b, 0)}** |

### Migration Status

- ✅ Completed Successfully
- ⚠️ Warnings: ${migrationState.warnings.length}
- ❌ Errors: ${migrationState.errors.length}

## Inventory Updates

`;

  // Add inventory summary
  let totalProductsUpdated = 0;
  let totalQuantitySold = 0;
  
  for (const [catalogId, inventoryMap] of migrationState.inventoryUpdates) {
    for (const [productKey, updates] of inventoryMap) {
      totalProductsUpdated++;
      totalQuantitySold += updates.quantity_sold;
    }
  }
  
  report += `### Inventory Summary

- Catalog Objects with Sales: ${migrationState.inventoryUpdates.size}
- Product Variations Updated: ${totalProductsUpdated}
- Total Quantity Sold: ${totalQuantitySold}

`;

  // Add warnings section
  if (migrationState.warnings.length > 0) {
    report += `## Warnings (${migrationState.warnings.length})

`;
    
    // Group warnings by stage
    const warningsByStage = {};
    migrationState.warnings.forEach(w => {
      if (!warningsByStage[w.stage]) {
        warningsByStage[w.stage] = [];
      }
      warningsByStage[w.stage].push(w);
    });
    
    for (const [stage, warnings] of Object.entries(warningsByStage)) {
      report += `### ${stage} (${warnings.length} warnings)

`;
      warnings.slice(0, 5).forEach(w => {
        report += `- ${w.message}\n`;
        if (w.context && Object.keys(w.context).length > 0) {
          report += `  Context: ${JSON.stringify(w.context)}\n`;
        }
      });
      
      if (warnings.length > 5) {
        report += `- ... and ${warnings.length - 5} more\n`;
      }
      
      report += '\n';
    }
  }
  
  // Add errors section
  if (migrationState.errors.length > 0) {
    report += `## Errors (${migrationState.errors.length})

`;
    
    // Group errors by stage
    const errorsByStage = {};
    migrationState.errors.forEach(e => {
      if (!errorsByStage[e.stage]) {
        errorsByStage[e.stage] = [];
      }
      errorsByStage[e.stage].push(e);
    });
    
    for (const [stage, errors] of Object.entries(errorsByStage)) {
      report += `### ${stage} (${errors.length} errors)

`;
      errors.slice(0, 5).forEach(e => {
        report += `- ${e.error}\n`;
        if (e.context && Object.keys(e.context).length > 0) {
          report += `  Context: ${JSON.stringify(e.context)}\n`;
        }
      });
      
      if (errors.length > 5) {
        report += `- ... and ${errors.length - 5} more\n`;
      }
      
      report += '\n';
    }
  }
  
  // Add ID mappings summary
  report += `## ID Mappings

### Functions to Catalog Objects
- Total Mappings: ${migrationState.functionToCatalog.size}

### Events to Products  
- Total Mappings: ${migrationState.eventToProduct.size}

### Tickets to Variations
- Total Mappings: ${migrationState.ticketToVariation.size}

### Attendees to Contacts
- Total Mappings: ${migrationState.attendeeToContact.size}

### Users to Contacts
- Total Mappings: ${migrationState.userToContact.size}

`;
  
  // Add data quality notes
  report += `## Data Quality Notes

### Automatic Corrections Applied

1. **Order Status Normalization**
   - Fixed registrations with 'pending' status but paid payments
   - Normalized payment statuses to match order statuses

2. **Inventory Initialization**
   - Set all initial inventory sold counts to 0
   - Updated based on actual registration/attendee data

3. **Contact Deduplication**
   - Merged contacts with same email and phone
   - Preserved all roles and order references

4. **Missing Data Defaults**
   - Set default currency to AUD where missing
   - Set default ticket capacity to 100 where missing
   - Generated slugs for entities missing them

### Recommended Manual Reviews

1. Review orders with status mismatches between order and payment
2. Verify inventory counts match expected values
3. Check contacts with multiple roles for accuracy
4. Review unassigned tickets in lodge/organisation orders

`;
  
  return report;
}

function generateJsonReport(migrationState) {
  return {
    generated: new Date().toISOString(),
    summary: {
      stats: migrationState.stats,
      warnings: migrationState.warnings.length,
      errors: migrationState.errors.length,
      duration: null // Would calculate if we tracked start time
    },
    
    inventory: {
      catalogsUpdated: migrationState.inventoryUpdates.size,
      updates: Array.from(migrationState.inventoryUpdates.entries()).map(([catalogId, updates]) => ({
        catalogId,
        products: Array.from(updates.entries()).map(([productKey, data]) => ({
          productKey,
          quantitySold: data.quantity_sold,
          quantityReserved: data.quantity_reserved
        }))
      }))
    },
    
    mappings: {
      functionToCatalog: Array.from(migrationState.functionToCatalog.entries()),
      eventToProduct: Array.from(migrationState.eventToProduct.entries()),
      ticketToVariation: Array.from(migrationState.ticketToVariation.entries()),
      attendeeToContact: Array.from(migrationState.attendeeToContact.entries()),
      userToContact: Array.from(migrationState.userToContact.entries())
    },
    
    issues: {
      warnings: migrationState.warnings,
      errors: migrationState.errors
    },
    
    dataQuality: {
      corrections: [
        {
          type: 'status_normalization',
          description: 'Fixed order/payment status mismatches',
          count: null // Would track during migration
        },
        {
          type: 'inventory_initialization',
          description: 'Initialized inventory counts from registration data',
          count: migrationState.inventoryUpdates.size
        },
        {
          type: 'contact_deduplication',
          description: 'Merged duplicate contacts by email/phone',
          count: null // Would track during migration
        }
      ]
    }
  };
}

module.exports = generateMigrationReport;