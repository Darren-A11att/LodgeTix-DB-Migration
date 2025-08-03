const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// MongoDB connection
const MONGODB_URL = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';

async function verifySquarePayments() {
    const client = new MongoClient(MONGODB_URL);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db(DATABASE_NAME);
        const paymentImportsCollection = db.collection('payment_imports');
        const paymentsCollection = db.collection('payments');
        
        // Read and parse CSV file
        const csvContent = fs.readFileSync('/Users/darrenallatt/Downloads/transactions-2025-01-01-2026-01-01 (2).csv', 'utf-8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        console.log(`Total records in CSV: ${records.length}`);
        
        const discrepancies = {
            missingFromPaymentImports: [],
            missingFromPayments: [],
            presentInBoth: [],
            zeroAmountPayments: [],
            summary: {
                totalCsvRecords: records.length,
                foundInPaymentImports: 0,
                missingFromPaymentImports: 0,
                foundInPayments: 0,
                missingFromPayments: 0,
                foundInBoth: 0,
                zeroAmountCount: 0
            }
        };
        
        // Process each record
        for (const record of records) {
            const paymentId = record['Payment ID'];
            const amount = parseFloat(record['Total Collected'].replace('$', '').replace(',', ''));
            const customerName = record['Customer Name'];
            const date = record['Date'];
            const time = record['Time'];
            
            if (!paymentId || paymentId === '') {
                console.log(`Skipping record with no Payment ID`);
                continue;
            }
            
            // Track zero amount payments separately
            if (amount === 0) {
                discrepancies.zeroAmountPayments.push({
                    paymentId,
                    customerName,
                    date,
                    time,
                    description: record['Description']
                });
                discrepancies.summary.zeroAmountCount++;
            }
            
            // Check if payment exists in payment_imports collection
            const paymentImport = await paymentImportsCollection.findOne({ squarePaymentId: paymentId });
            
            // Check if payment exists in payments collection
            const payment = await paymentsCollection.findOne({ paymentId: paymentId });
            
            const recordInfo = {
                paymentId,
                amount,
                customerName,
                date,
                time,
                transactionId: record['Transaction ID'],
                cardBrand: record['Card Brand'],
                description: record['Description']
            };
            
            if (!paymentImport && !payment) {
                // Missing from both
                discrepancies.missingFromPaymentImports.push({
                    ...recordInfo,
                    note: 'Missing from both collections'
                });
                discrepancies.missingFromPayments.push({
                    ...recordInfo,
                    note: 'Missing from both collections'
                });
                discrepancies.summary.missingFromPaymentImports++;
                discrepancies.summary.missingFromPayments++;
            } else if (paymentImport && !payment) {
                // In payment_imports but not in payments
                discrepancies.missingFromPayments.push({
                    ...recordInfo,
                    note: 'Found in payment_imports but missing from payments',
                    paymentImportData: {
                        _id: paymentImport._id,
                        status: paymentImport.status,
                        importedAt: paymentImport.importedAt
                    }
                });
                discrepancies.summary.foundInPaymentImports++;
                discrepancies.summary.missingFromPayments++;
            } else if (!paymentImport && payment) {
                // In payments but not in payment_imports
                discrepancies.missingFromPaymentImports.push({
                    ...recordInfo,
                    note: 'Found in payments but missing from payment_imports',
                    paymentData: {
                        _id: payment._id,
                        status: payment.status,
                        registrationId: payment.registrationId
                    }
                });
                discrepancies.summary.missingFromPaymentImports++;
                discrepancies.summary.foundInPayments++;
            } else {
                // Found in both
                discrepancies.presentInBoth.push({
                    paymentId,
                    amount,
                    customerName
                });
                discrepancies.summary.foundInPaymentImports++;
                discrepancies.summary.foundInPayments++;
                discrepancies.summary.foundInBoth++;
            }
        }
        
        // Save discrepancies report
        const reportPath = '/Users/darrenallatt/Development/LodgeTix - Reconcile/square-payment-verification-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(discrepancies, null, 2));
        
        // Print summary
        console.log('\n=== VERIFICATION SUMMARY ===');
        console.log(`Total CSV records: ${discrepancies.summary.totalCsvRecords}`);
        console.log(`Payments found in DB: ${discrepancies.summary.paymentsFound}`);
        console.log(`Payments missing from DB: ${discrepancies.summary.paymentsMissing}`);
        console.log(`Registrations found: ${discrepancies.summary.registrationsFound}`);
        console.log(`Registrations missing: ${discrepancies.summary.registrationsMissing}`);
        console.log(`Zero amount payments: ${discrepancies.summary.zeroAmountCount}`);
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return discrepancies;
        
    } catch (error) {
        console.error('Error during verification:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Run verification
verifySquarePayments()
    .then(() => {
        console.log('\nVerification completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });