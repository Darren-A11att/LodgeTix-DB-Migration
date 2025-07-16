import { connectMongoDB, disconnectMongoDB } from '../src/connections/mongodb';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function extractAllRegistrations() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    const { db } = await connectMongoDB();
    
    console.log('Fetching all registrations...');
    const registrations = await db.collection('registrations').find({}).toArray();
    
    console.log(`Found ${registrations.length} registrations`);
    
    // Save to file
    const outputPath = join(__dirname, 'registrations.json');
    writeFileSync(outputPath, JSON.stringify(registrations, null, 2));
    
    console.log(`Registrations saved to: ${outputPath}`);
    
    // Print summary statistics
    const registrationTypes = registrations.reduce((acc, reg) => {
      const type = reg.registrationType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nRegistration type breakdown:');
    Object.entries(registrationTypes)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    
  } catch (error) {
    console.error('Error extracting registrations:', error);
    process.exit(1);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the extraction
extractAllRegistrations();