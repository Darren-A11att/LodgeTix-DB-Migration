import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface BillingDetails {
  [key: string]: any;
}

interface BillingDetailsResult {
  path: string;
  isArray: boolean;
  length: number | null;
  sample: BillingDetails | BillingDetails[];
}

interface RegistrationTypeStats {
  total: number;
  withBillingDetails: number;
}

interface Stats {
  total: number;
  withBillingDetails: number;
  billingDetailsLocations: { [path: string]: number };
  byType: {
    individuals: RegistrationTypeStats;
    lodges: RegistrationTypeStats;
  };
  samples: Array<{
    confirmationNumber: string;
    registrationType: string;
    locations: BillingDetailsResult[];
  }>;
}

interface Registration {
  _id: ObjectId;
  confirmationNumber?: string;
  confirmation_number?: string;
  registrationType?: string;
  registration_type?: string;
  billingDetails?: BillingDetails | BillingDetails[];
  billing_details?: BillingDetails | BillingDetails[];
  [key: string]: any;
}

// Recursive function to search for billingDetails in any part of an object
function findBillingDetails(obj: any, path: string = ''): BillingDetailsResult[] {
  const results: BillingDetailsResult[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return results;
  }
  
  // Check if current object has billingDetails or billing_details
  if (obj.billingDetails || obj.billing_details) {
    const details = obj.billingDetails || obj.billing_details;
    results.push({
      path: path || 'root',
      isArray: Array.isArray(details),
      length: Array.isArray(details) ? details.length : null,
      sample: Array.isArray(details) ? details[0] : details
    });
  }
  
  // Recursively search in all properties
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
      const subResults = findBillingDetails(obj[key], path ? `${path}.${key}` : key);
      results.push(...subResults);
    }
  }
  
  return results;
}

async function analyzeBillingDetails(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    console.log('Searching for billingDetails arrays in registrations...\n');
    
    // Get all registrations
    const registrations = await db.collection<Registration>('registrations').find({}).toArray();
    
    // Initialize counters
    const stats: Stats = {
      total: registrations.length,
      withBillingDetails: 0,
      billingDetailsLocations: {},
      byType: {
        individuals: { total: 0, withBillingDetails: 0 },
        lodges: { total: 0, withBillingDetails: 0 }
      },
      samples: []
    };
    
    // Analyze each registration
    registrations.forEach(registration => {
      const regType = (registration.registrationType || registration.registration_type || '').toLowerCase();
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number || 'N/A';
      
      // Update type totals
      if (regType === 'individuals' || regType === 'individual') {
        stats.byType.individuals.total++;
      } else if (regType === 'lodge' || regType === 'lodges') {
        stats.byType.lodges.total++;
      }
      
      // Search for billingDetails anywhere in the document
      const billingDetailsFound = findBillingDetails(registration);
      
      if (billingDetailsFound.length > 0) {
        stats.withBillingDetails++;
        
        // Update type counts
        if (regType === 'individuals' || regType === 'individual') {
          stats.byType.individuals.withBillingDetails++;
        } else if (regType === 'lodge' || regType === 'lodges') {
          stats.byType.lodges.withBillingDetails++;
        }
        
        // Track locations
        billingDetailsFound.forEach(found => {
          if (!stats.billingDetailsLocations[found.path]) {
            stats.billingDetailsLocations[found.path] = 0;
          }
          stats.billingDetailsLocations[found.path]++;
        });
        
        // Save sample
        if (stats.samples.length < 5) {
          stats.samples.push({
            confirmationNumber,
            registrationType: regType,
            locations: billingDetailsFound
          });
        }
      }
    });
    
    // Display results
    console.log('=== OVERALL STATISTICS ===');
    console.log(`Total registrations: ${stats.total}`);
    console.log(`Registrations with billingDetails: ${stats.withBillingDetails} (${((stats.withBillingDetails/stats.total)*100).toFixed(1)}%)`);
    console.log(`Registrations without billingDetails: ${stats.total - stats.withBillingDetails} (${(((stats.total - stats.withBillingDetails)/stats.total)*100).toFixed(1)}%)`);
    
    console.log('\n=== BY REGISTRATION TYPE ===');
    console.log(`Individuals: ${stats.byType.individuals.withBillingDetails}/${stats.byType.individuals.total} have billingDetails (${stats.byType.individuals.total > 0 ? ((stats.byType.individuals.withBillingDetails/stats.byType.individuals.total)*100).toFixed(1) : 0}%)`);
    console.log(`Lodges: ${stats.byType.lodges.withBillingDetails}/${stats.byType.lodges.total} have billingDetails (${stats.byType.lodges.total > 0 ? ((stats.byType.lodges.withBillingDetails/stats.byType.lodges.total)*100).toFixed(1) : 0}%)`);
    
    console.log('\n=== BILLINGDETAILS LOCATIONS ===');
    Object.entries(stats.billingDetailsLocations).forEach(([path, count]) => {
      console.log(`${path}: ${count} occurrences`);
    });
    
    console.log('\n=== SAMPLE REGISTRATIONS WITH BILLINGDETAILS ===');
    stats.samples.forEach(sample => {
      console.log(`\n${sample.confirmationNumber} (${sample.registrationType}):`);
      sample.locations.forEach(loc => {
        console.log(`  Location: ${loc.path}`);
        console.log(`  Is Array: ${loc.isArray}`);
        if (loc.isArray) {
          console.log(`  Array Length: ${loc.length}`);
        }
        console.log(`  Sample Data:`, JSON.stringify(loc.sample, null, 4));
      });
    });
    
    // Check if billingDetails contains specific fields
    if (stats.samples.length > 0) {
      console.log('\n=== BILLINGDETAILS FIELD ANALYSIS ===');
      const firstSample = stats.samples[0].locations[0].sample;
      if (firstSample && typeof firstSample === 'object' && !Array.isArray(firstSample)) {
        console.log('Common fields found in billingDetails:');
        Object.keys(firstSample).forEach(key => {
          console.log(`  - ${key}`);
        });
      }
    }
    
  } finally {
    await client.close();
  }
}

analyzeBillingDetails().catch(console.error);