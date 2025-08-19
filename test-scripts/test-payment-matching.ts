import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { PaymentRegistrationMatcher } from '../services/payment-registration-matcher';
import { InvoicePreviewGenerator } from '../services/invoice-preview-generator';
import fs from 'fs/promises';
import path from 'path';

async function testPaymentMatching() {
  try {
    console.log('Testing payment-registration matching...\n');
    
    const { db } = await connectMongoDB();
    
    // Initialize services
    const matcher = new PaymentRegistrationMatcher(db);
    const previewGenerator = new InvoicePreviewGenerator(db);
    
    // Get match statistics first
    console.log('Calculating match statistics...');
    const stats = await matcher.getMatchStatistics();
    
    console.log('\n=== MATCH STATISTICS ===');
    console.log(`Total Payments: ${stats.total}`);
    console.log(`Matched: ${stats.matched} (${((stats.matched / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Unmatched: ${stats.unmatched} (${((stats.unmatched / stats.total) * 100).toFixed(1)}%)`);
    
    console.log('\nBy Confidence Level:');
    Object.entries(stats.byConfidence).forEach(([range, count]) => {
      console.log(`  ${range}%: ${count} payments`);
    });
    
    console.log('\nBy Match Method:');
    Object.entries(stats.byMethod).forEach(([method, count]) => {
      console.log(`  ${method}: ${count} payments`);
    });
    
    // Get sample matches for review
    console.log('\n=== SAMPLE MATCHES ===');
    const matchResults = await matcher.matchAllPayments();
    
    // Show examples of each confidence level
    const examples = {
      high: matchResults.find(r => r.matchConfidence >= 90),
      medium: matchResults.find(r => r.matchConfidence >= 50 && r.matchConfidence < 90),
      low: matchResults.find(r => r.matchConfidence > 0 && r.matchConfidence < 50),
      none: matchResults.find(r => r.matchConfidence === 0)
    };
    
    for (const [level, example] of Object.entries(examples)) {
      if (example) {
        console.log(`\n${level.toUpperCase()} CONFIDENCE EXAMPLE:`);
        console.log(`Payment ID: ${example.payment.transactionId}`);
        console.log(`Amount: $${example.payment.amount}`);
        console.log(`Date: ${example.payment.timestamp}`);
        console.log(`Source: ${example.payment.source}`);
        
        if (example.registration) {
          console.log(`Matched Registration: ${example.registration.confirmationNumber}`);
          console.log(`Match Method: ${example.matchMethod}`);
          console.log(`Confidence: ${example.matchConfidence}%`);
          if (example.issues.length > 0) {
            console.log(`Issues: ${example.issues.join(', ')}`);
          }
        } else {
          console.log('No match found');
        }
      }
    }
    
    // Generate sample previews
    console.log('\n=== GENERATING SAMPLE INVOICE PREVIEWS ===');
    const highConfidenceMatches = matchResults
      .filter(r => r.matchConfidence >= 80 && r.registration)
      .slice(0, 5);
    
    for (const match of highConfidenceMatches) {
      const preview = await previewGenerator.generatePreview(match);
      if (preview) {
        console.log(`\nInvoice Preview: ${preview.invoiceNumber}`);
        console.log(`Customer: ${preview.billTo.name}`);
        console.log(`Function: ${preview.registrationDetails.functionName}`);
        console.log(`Total: $${preview.total.toFixed(2)}`);
        console.log(`Line Items: ${preview.items.length}`);
      }
    }
    
    // Save detailed report
    const reportData = {
      timestamp: new Date().toISOString(),
      statistics: stats,
      sampleMatches: matchResults.slice(0, 20).map(r => ({
        payment: {
          id: r.payment.transactionId,
          amount: r.payment.amount,
          date: r.payment.timestamp,
          source: r.payment.source
        },
        registration: r.registration ? {
          confirmationNumber: r.registration.confirmationNumber,
          amount: r.registration.totalAmount,
          date: r.registration.createdAt
        } : null,
        matchConfidence: r.matchConfidence,
        matchMethod: r.matchMethod,
        issues: r.issues
      })),
      unmatchedPayments: matchResults
        .filter(r => !r.registration)
        .slice(0, 10)
        .map(r => ({
          id: r.payment.transactionId,
          amount: r.payment.amount,
          date: r.payment.timestamp,
          source: r.payment.source,
          customerEmail: r.payment.customerEmail
        }))
    };
    
    // Save report to file
    const reportsDir = path.join(process.cwd(), 'reports', 'payment-matching');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `match-report-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
    
    console.log(`\n✓ Detailed report saved to: ${reportFile}`);
    
  } catch (error) {
    console.error('❌ Error testing payment matching:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testPaymentMatching()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });