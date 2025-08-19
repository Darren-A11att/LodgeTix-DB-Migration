import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function examineErrorPaymentsStructure(): Promise<void> {
  console.log('🔍 Examining error_payments collection structure in detail...\n');

  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';

  let client: MongoClient | null = null;

  try {
    console.log('📡 Connecting to lodgetix database...');
    client = new MongoClient(lodgetixConnectionString);
    await client.connect();
    console.log('✅ Connected to lodgetix database\n');

    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');

    // Get all documents and examine their full structure
    console.log('📄 Full document structures:');
    const allDocs = await errorPaymentsCollection.find().toArray();
    
    console.log(`Total documents: ${allDocs.length}\n`);

    allDocs.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`);
      console.log(JSON.stringify(doc, null, 2));
      console.log('─'.repeat(50));
    });

    // Get all unique field names across all documents
    console.log('\n🔑 All unique field names across documents:');
    const allFieldNames = new Set<string>();
    
    allDocs.forEach(doc => {
      Object.keys(doc).forEach(key => allFieldNames.add(key));
    });

    const sortedFields = Array.from(allFieldNames).sort();
    sortedFields.forEach(field => {
      const countWithField = allDocs.filter(doc => doc.hasOwnProperty(field)).length;
      console.log(`  ${field}: present in ${countWithField}/${allDocs.length} documents`);
    });

    // Look for any field that might contain "stripe"
    console.log('\n🔍 Searching for "stripe" in field values:');
    allDocs.forEach((doc, index) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (typeof value === 'string' && value.toLowerCase().includes('stripe')) {
          console.log(`  Document ${index + 1}, field '${key}': ${value}`);
        }
      });
    });

    // Look for any field that might contain payment status indicators
    console.log('\n🔍 Searching for status-like values:');
    const statusKeywords = ['complete', 'success', 'fail', 'pending', 'cancel', 'error'];
    allDocs.forEach((doc, index) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          statusKeywords.forEach(keyword => {
            if (lowerValue.includes(keyword)) {
              console.log(`  Document ${index + 1}, field '${key}': ${value} (contains '${keyword}')`);
            }
          });
        }
      });
    });

    // Look for payment intent IDs (typically start with "pi_")
    console.log('\n🔍 Searching for Stripe payment intent IDs (pi_*):');
    allDocs.forEach((doc, index) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('pi_')) {
          console.log(`  Document ${index + 1}, field '${key}': ${value}`);
        }
      });
    });

    // Look for Square payment IDs (different pattern)
    console.log('\n🔍 Searching for Square payment IDs:');
    allDocs.forEach((doc, index) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (typeof value === 'string' && (value.includes('square') || value.match(/^[A-Za-z0-9]{20,}$/))) {
          console.log(`  Document ${index + 1}, field '${key}': ${value}`);
        }
      });
    });

  } catch (error) {
    console.error('❌ Error during examination:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run the examination
examineErrorPaymentsStructure()
  .then(() => {
    console.log('\n✅ Examination completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Examination failed:', error);
    process.exit(1);
  });

export { examineErrorPaymentsStructure };