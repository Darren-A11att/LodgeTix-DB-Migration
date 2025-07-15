import * as fs from 'fs';
import * as path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

interface FalseMatchReport {
  generatedAt: string;
  summary: {
    totalChecked: number;
    validMatches: number;
    falseMatches: number;
    missingRegistrations: number;
    byMatchMethod: Record<string, number>;
  };
  falseMatches: Array<{
    paymentId: string;
    paymentIdValue: string;
    registrationId: string;
    matchMethod: string;
    matchConfidence: number;
    issue: string;
    paymentDetails: {
      source: string;
      amount: number;
      timestamp: string;
      customerName?: string;
      transactionId?: string;
    };
    registrationDetails: {
      stripePaymentIntentId?: string;
      squarePaymentId?: string;
      confirmationNumber?: string;
      registrationType?: string;
      totalAmount?: number;
      createdAt?: string;
    };
  }>;
}

async function reviewFalseMatches(reportFile?: string) {
  // Find the latest report if not specified
  const reportsDir = path.join(process.cwd(), 'payment-match-reports');
  
  if (!reportFile) {
    if (!fs.existsSync(reportsDir)) {
      console.error('❌ No reports directory found. Please run identify-false-matches.ts first.');
      return;
    }
    
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('false-matches-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.error('❌ No false match reports found. Please run identify-false-matches.ts first.');
      return;
    }
    
    reportFile = path.join(reportsDir, files[0]);
    console.log(`📄 Using latest report: ${files[0]}\n`);
  }
  
  // Load the report
  const reportContent = fs.readFileSync(reportFile, 'utf-8');
  const report: FalseMatchReport = JSON.parse(reportContent);
  
  console.log('=' + '='.repeat(80));
  console.log('FALSE MATCHES REVIEW');
  console.log('=' + '='.repeat(80));
  console.log(`Report generated: ${report.generatedAt}`);
  console.log(`Total payments checked: ${report.summary.totalChecked}`);
  console.log(`Valid matches: ${report.summary.validMatches}`);
  console.log(`False matches found: ${report.summary.falseMatches}`);
  console.log(`Missing registrations: ${report.summary.missingRegistrations}`);
  
  console.log('\nBy Match Method:');
  Object.entries(report.summary.byMatchMethod).forEach(([method, count]) => {
    console.log(`  ${method}: ${count}`);
  });
  
  if (report.falseMatches.length === 0) {
    console.log('\n✅ No false matches found!');
    return;
  }
  
  // Connect to database for additional verification
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED FALSE MATCH ANALYSIS');
    console.log('=' + '='.repeat(80));
    
    // Group by payment source
    const bySource: Record<string, typeof report.falseMatches> = {};
    report.falseMatches.forEach(fm => {
      const source = fm.paymentDetails.source;
      if (!bySource[source]) bySource[source] = [];
      bySource[source].push(fm);
    });
    
    for (const [source, matches] of Object.entries(bySource)) {
      console.log(`\n${source.toUpperCase()} PAYMENTS (${matches.length} false matches):`);
      console.log('-'.repeat(50));
      
      // Show first 5 examples
      matches.slice(0, 5).forEach((match, index) => {
        console.log(`\n${index + 1}. Payment ${match.paymentId}:`);
        console.log(`   Payment ID: ${match.paymentIdValue}`);
        console.log(`   Amount: $${match.paymentDetails.amount}`);
        console.log(`   Date: ${new Date(match.paymentDetails.timestamp).toLocaleDateString()}`);
        console.log(`   Customer: ${match.paymentDetails.customerName || 'N/A'}`);
        console.log(`   Match Method: ${match.matchMethod} (${match.matchConfidence}%)`);
        console.log(`   Issue: ${match.issue}`);
        
        if (match.issue !== 'Registration not found') {
          console.log(`   Registration ${match.registrationId}:`);
          console.log(`     - Type: ${match.registrationDetails.registrationType || 'N/A'}`);
          console.log(`     - Stripe ID: ${match.registrationDetails.stripePaymentIntentId || 'null'}`);
          console.log(`     - Square ID: ${match.registrationDetails.squarePaymentId || 'null'}`);
          console.log(`     - Amount: $${match.registrationDetails.totalAmount || 'N/A'}`);
          console.log(`     - Confirmation: ${match.registrationDetails.confirmationNumber || 'N/A'}`);
        }
      });
      
      if (matches.length > 5) {
        console.log(`\n   ... and ${matches.length - 5} more ${source} false matches`);
      }
    }
    
    // Verify a sample of false matches
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION SAMPLE (checking 3 random false matches)');
    console.log('=' + '='.repeat(80));
    
    const sample = report.falseMatches
      .filter(fm => fm.issue !== 'Registration not found')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    for (const match of sample) {
      console.log(`\nVerifying Payment ${match.paymentId}...`);
      
      const payment = await db.collection('payments').findOne({ 
        _id: new ObjectId(match.paymentId) 
      });
      
      const registration = await db.collection('registrations').findOne({ 
        _id: new ObjectId(match.registrationId) 
      });
      
      if (!payment || !registration) {
        console.log('   ❌ Could not verify - document not found');
        continue;
      }
      
      // Deep search for payment ID
      const paymentIdFound = deepSearchValue(registration, match.paymentIdValue);
      
      console.log(`   Payment ID: ${match.paymentIdValue}`);
      console.log(`   Found in registration: ${paymentIdFound ? '❌ YES (should not be false match!)' : '✅ NO (confirmed false match)'}`);
      
      if (paymentIdFound) {
        console.log('   ⚠️  WARNING: This might not be a false match!');
      }
    }
    
    // Save verification results
    const verificationPath = reportFile.replace('.json', '-verified.json');
    const verifiedReport = {
      ...report,
      verifiedAt: new Date().toISOString(),
      verificationNote: 'Review completed. Ready for fix application.'
    };
    
    fs.writeFileSync(verificationPath, JSON.stringify(verifiedReport, null, 2));
    console.log(`\n✅ Verification complete. Results saved to: ${path.basename(verificationPath)}`);
    
  } finally {
    await client.close();
  }
}

function deepSearchValue(obj: any, searchValue: string, visited = new Set()): boolean {
  if (visited.has(obj)) return false;
  if (typeof obj === 'object' && obj !== null) visited.add(obj);
  
  if (obj === searchValue) return true;
  
  if (typeof obj !== 'object' || obj === null) return false;
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (ObjectId.isValid(obj[key]) && typeof obj[key] === 'object') continue;
      if (deepSearchValue(obj[key], searchValue, visited)) return true;
    }
  }
  
  return false;
}

// Run with optional specific report file
const reportFile = process.argv[2];
reviewFalseMatches(reportFile).catch(console.error);