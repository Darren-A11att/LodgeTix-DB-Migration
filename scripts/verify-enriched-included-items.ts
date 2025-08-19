import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';

async function verifyEnrichedIncludedItems() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    
    // Fetch all packages
    const packages = await packagesCollection.find({}).toArray();
    
    console.log('📦 VERIFICATION REPORT - Enriched IncludedItems');
    console.log('='.repeat(80));
    console.log(`Found ${packages.length} packages\n`);
    
    for (const pkg of packages) {
      console.log(`\n📦 Package: ${pkg.name}`);
      console.log('-'.repeat(60));
      console.log(`Package ID: ${pkg.packageId}`);
      console.log(`Total Included Items: ${pkg.includedItems?.length || 0}`);
      
      if (pkg.includedItems && pkg.includedItems.length > 0) {
        console.log('\n📋 Included Items:');
        
        pkg.includedItems.forEach((item: any, index: number) => {
          console.log(`\n  ${index + 1}. ${item.name || '❌ NAME MISSING'}`);
          console.log(`     - Event Ticket ID: ${item.eventTicketId}`);
          console.log(`     - Quantity: ${item.quantity}`);
          console.log(`     - Price: ${item.price !== undefined ? `$${item.price}` : '❌ PRICE MISSING'}`);
          console.log(`     - Event ID: ${item.eventId || '❌ EVENT ID MISSING'}`);
          
          // Check if enrichment was successful
          const hasAllFields = item.name && item.price !== undefined && item.eventId;
          console.log(`     - Status: ${hasAllFields ? '✅ Fully Enriched' : '⚠️  Missing Fields'}`);
        });
        
        // Calculate totals
        const totalQuantity = pkg.includedItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const totalValue = pkg.includedItems.reduce((sum: number, item: any) => {
          const price = typeof item.price === 'object' ? parseFloat(item.price.toString()) : item.price || 0;
          return sum + (price * (item.quantity || 0));
        }, 0);
        
        console.log(`\n  📊 Package Summary:`);
        console.log(`     - Total Items: ${totalQuantity}`);
        console.log(`     - Total Value: $${totalValue.toFixed(2)}`);
        
        // Check enrichment status
        const fullyEnriched = pkg.includedItems.every((item: any) => 
          item.name && item.price !== undefined && item.eventId
        );
        console.log(`     - Enrichment Status: ${fullyEnriched ? '✅ Complete' : '⚠️  Incomplete'}`);
        
      } else {
        console.log('\n  ⚠️  No included items in this package');
      }
      
      if (pkg.lastEnriched) {
        console.log(`\n  Last Enriched: ${pkg.lastEnriched}`);
      }
    }
    
    // Overall Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(80));
    
    const totalPackages = packages.length;
    const enrichedPackages = packages.filter((pkg: any) => pkg.lastEnriched).length;
    const totalIncludedItems = packages.reduce((sum: number, pkg: any) => 
      sum + (pkg.includedItems?.length || 0), 0
    );
    const fullyEnrichedItems = packages.reduce((sum: number, pkg: any) => {
      if (!pkg.includedItems) return sum;
      return sum + pkg.includedItems.filter((item: any) => 
        item.name && item.price !== undefined && item.eventId
      ).length;
    }, 0);
    
    console.log(`Total Packages: ${totalPackages}`);
    console.log(`Enriched Packages: ${enrichedPackages}`);
    console.log(`Total Included Items: ${totalIncludedItems}`);
    console.log(`Fully Enriched Items: ${fullyEnrichedItems}`);
    console.log(`Enrichment Rate: ${totalIncludedItems > 0 ? ((fullyEnrichedItems / totalIncludedItems) * 100).toFixed(1) : 0}%`);
    
    if (fullyEnrichedItems === totalIncludedItems) {
      console.log('\n✅ SUCCESS: All included items are fully enriched!');
    } else {
      console.log(`\n⚠️  ${totalIncludedItems - fullyEnrichedItems} items still need enrichment`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoClient.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

verifyEnrichedIncludedItems().catch(console.error);