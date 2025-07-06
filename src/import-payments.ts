import path from 'path';
import { PaymentParser } from './services/payment-parser';

async function main() {
  const parser = new PaymentParser();
  
  try {
    // Initialize database connection and collection
    await parser.initialize();
    
    // Define the CSV files to import
    const csvFiles = [
      path.join(__dirname, '../Payments-Export/items-2025-01-01-2026-01-01.csv'),
      path.join(__dirname, '../Payments-Export/transactions-2025-01-01-2026-01-01.csv'),
      path.join(__dirname, '../Payments-Export/Stripe - Lodge Tickets Exports.csv'),
      path.join(__dirname, '../Payments-Export/Stripe - LodgeTix Darren Export.csv'),
      path.join(__dirname, '../Payments-Export/Stripe - LodgeTix Export.csv')
    ];
    
    // Import all payments
    await parser.importPayments(csvFiles);
    
    // Get and display summary
    console.log('\n📊 Payment Summary by Source:');
    const summary = await parser.getPaymentsSummary();
    
    summary.forEach((source: any) => {
      console.log(`\n${source._id.toUpperCase()}:`);
      console.log(`  Total Payments: ${source.totalCount}`);
      console.log(`  Total Gross: $${source.totalGross.toFixed(2)}`);
      console.log(`  Total Fees: $${source.totalFees.toFixed(2)}`);
      
      console.log('  By Status:');
      source.statuses.forEach((status: any) => {
        console.log(`    ${status.status}: ${status.count} payments ($${status.totalGross.toFixed(2)})`);
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing payments:', error);
    process.exit(1);
  }
}

main();