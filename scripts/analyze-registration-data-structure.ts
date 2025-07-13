import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface RegistrationData {
  selectedTickets?: any[];
  tickets?: any[];
}

interface Registration {
  _id: ObjectId;
  registrationType?: string;
  registration_type?: string;
  registrationData?: RegistrationData;
  registration_data?: RegistrationData;
  confirmationNumber?: string;
  confirmation_number?: string;
}

interface TypeStats {
  total: number;
  withSelectedTickets: number;
  withTickets: number;
  withBoth: number;
  withNeither: number;
  samples: {
    selectedTickets: string[];
    tickets: string[];
  };
}

interface Stats {
  individuals: TypeStats;
  lodges: TypeStats;
}

async function analyzeRegistrationDataStructure(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    console.log('Analyzing registration data structure...\n');
    
    // Get all registrations
    const registrations = await db.collection<Registration>('registrations').find({}).toArray();
    
    // Initialize counters
    const stats: Stats = {
      individuals: {
        total: 0,
        withSelectedTickets: 0,
        withTickets: 0,
        withBoth: 0,
        withNeither: 0,
        samples: {
          selectedTickets: [],
          tickets: []
        }
      },
      lodges: {
        total: 0,
        withSelectedTickets: 0,
        withTickets: 0,
        withBoth: 0,
        withNeither: 0,
        samples: {
          selectedTickets: [],
          tickets: []
        }
      }
    };
    
    // Analyze each registration
    registrations.forEach(registration => {
      const regType = (registration.registrationType || registration.registration_type || '').toLowerCase();
      const regData = registration.registrationData || registration.registration_data;
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number || 'N/A';
      
      // Check if it's individuals
      if (regType === 'individuals' || regType === 'individual') {
        stats.individuals.total++;
        
        const hasSelectedTickets = regData?.selectedTickets && Array.isArray(regData.selectedTickets) && regData.selectedTickets.length > 0;
        const hasTickets = regData?.tickets && Array.isArray(regData.tickets) && regData.tickets.length > 0;
        
        if (hasSelectedTickets && hasTickets) {
          stats.individuals.withBoth++;
        } else if (hasSelectedTickets) {
          stats.individuals.withSelectedTickets++;
          if (stats.individuals.samples.selectedTickets.length < 3) {
            stats.individuals.samples.selectedTickets.push(confirmationNumber);
          }
        } else if (hasTickets) {
          stats.individuals.withTickets++;
          if (stats.individuals.samples.tickets.length < 3) {
            stats.individuals.samples.tickets.push(confirmationNumber);
          }
        } else {
          stats.individuals.withNeither++;
        }
      }
      // Check if it's lodges (both 'lodge' and 'lodges')
      else if (regType === 'lodge' || regType === 'lodges') {
        stats.lodges.total++;
        
        const hasSelectedTickets = regData?.selectedTickets && Array.isArray(regData.selectedTickets) && regData.selectedTickets.length > 0;
        const hasTickets = regData?.tickets && Array.isArray(regData.tickets) && regData.tickets.length > 0;
        
        if (hasSelectedTickets && hasTickets) {
          stats.lodges.withBoth++;
        } else if (hasSelectedTickets) {
          stats.lodges.withSelectedTickets++;
          if (stats.lodges.samples.selectedTickets.length < 3) {
            stats.lodges.samples.selectedTickets.push(confirmationNumber);
          }
        } else if (hasTickets) {
          stats.lodges.withTickets++;
          if (stats.lodges.samples.tickets.length < 3) {
            stats.lodges.samples.tickets.push(confirmationNumber);
          }
        } else {
          stats.lodges.withNeither++;
        }
      }
    });
    
    // Display results
    console.log('=== INDIVIDUALS REGISTRATIONS ===');
    console.log(`Total: ${stats.individuals.total}`);
    console.log(`With selectedTickets array: ${stats.individuals.withSelectedTickets}`);
    console.log(`With tickets array: ${stats.individuals.withTickets}`);
    console.log(`With both arrays: ${stats.individuals.withBoth}`);
    console.log(`With neither: ${stats.individuals.withNeither}`);
    if (stats.individuals.samples.selectedTickets.length > 0) {
      console.log(`\nSample registrations with selectedTickets: ${stats.individuals.samples.selectedTickets.join(', ')}`);
    }
    if (stats.individuals.samples.tickets.length > 0) {
      console.log(`Sample registrations with tickets: ${stats.individuals.samples.tickets.join(', ')}`);
    }
    
    console.log('\n\n=== LODGE REGISTRATIONS (includes both "lodge" and "lodges") ===');
    console.log(`Total: ${stats.lodges.total}`);
    console.log(`With selectedTickets array: ${stats.lodges.withSelectedTickets}`);
    console.log(`With tickets array: ${stats.lodges.withTickets}`);
    console.log(`With both arrays: ${stats.lodges.withBoth}`);
    console.log(`With neither: ${stats.lodges.withNeither}`);
    if (stats.lodges.samples.selectedTickets.length > 0) {
      console.log(`\nSample registrations with selectedTickets: ${stats.lodges.samples.selectedTickets.join(', ')}`);
    }
    if (stats.lodges.samples.tickets.length > 0) {
      console.log(`Sample registrations with tickets: ${stats.lodges.samples.tickets.join(', ')}`);
    }
    
    // Additional analysis - check lodge vs lodges
    const lodgeSingular = registrations.filter(r => (r.registrationType || r.registration_type || '').toLowerCase() === 'lodge').length;
    const lodgePlural = registrations.filter(r => (r.registrationType || r.registration_type || '').toLowerCase() === 'lodges').length;
    
    console.log('\n\n=== LODGE TYPE BREAKDOWN ===');
    console.log(`Registrations with type "lodge": ${lodgeSingular}`);
    console.log(`Registrations with type "lodges": ${lodgePlural}`);
    
    // Check a sample registration structure
    console.log('\n\n=== SAMPLE REGISTRATION STRUCTURE ===');
    const sampleWithTickets = registrations.find(r => {
      const regData = r.registrationData || r.registration_data;
      return regData?.tickets && Array.isArray(regData.tickets) && regData.tickets.length > 0;
    });
    
    if (sampleWithTickets) {
      const regData = sampleWithTickets.registrationData || sampleWithTickets.registration_data;
      console.log(`\nSample registration with tickets array (${sampleWithTickets.confirmationNumber || sampleWithTickets.confirmation_number}):`);
      if (regData?.tickets && regData.tickets.length > 0) {
        console.log('First ticket in array:', JSON.stringify(regData.tickets[0], null, 2));
      }
    }
    
    const sampleWithSelectedTickets = registrations.find(r => {
      const regData = r.registrationData || r.registration_data;
      return regData?.selectedTickets && Array.isArray(regData.selectedTickets) && regData.selectedTickets.length > 0;
    });
    
    if (sampleWithSelectedTickets) {
      const regData = sampleWithSelectedTickets.registrationData || sampleWithSelectedTickets.registration_data;
      console.log(`\nSample registration with selectedTickets array (${sampleWithSelectedTickets.confirmationNumber || sampleWithSelectedTickets.confirmation_number}):`);
      if (regData?.selectedTickets && regData.selectedTickets.length > 0) {
        console.log('First selectedTicket in array:', JSON.stringify(regData.selectedTickets[0], null, 2));
      }
    }
    
  } finally {
    await client.close();
  }
}

analyzeRegistrationDataStructure().catch(console.error);