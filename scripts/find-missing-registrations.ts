import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;

// MongoDB config
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findMissingRegistrations() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Fetching registrations from Supabase...');
    
    // Fetch all registrations from Supabase with pagination
    const allSupabaseRegistrations: any[] = [];
    const pageSize = 100;
    let start = 0;
    
    // First get the count
    const { count } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total registrations in Supabase: ${count}`);
    
    // Fetch all with pagination
    while (start < (count || 0)) {
      const end = Math.min(start + pageSize - 1, (count || 0) - 1);
      
      const { data, error } = await supabase
        .from('registrations')
        .select('registration_id, registration_data, created_at')
        .range(start, end);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        allSupabaseRegistrations.push(...data);
      }
      
      start += pageSize;
    }
    
    console.log(`Found ${allSupabaseRegistrations.length} registrations in Supabase`);
    
    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Get all registration IDs from MongoDB
    const mongoRegistrations = await registrations
      .find({}, { projection: { registrationId: 1 } })
      .toArray();
    
    const mongoRegistrationIds = new Set(mongoRegistrations.map(r => r.registrationId));
    console.log(`Found ${mongoRegistrationIds.size} registrations in MongoDB`);
    
    // Find missing registrations
    const missingRegistrations = allSupabaseRegistrations.filter(
      reg => !mongoRegistrationIds.has(reg.registration_id)
    );
    
    console.log(`\n=== MISSING REGISTRATIONS ===`);
    console.log(`Found ${missingRegistrations.length} registrations in Supabase but not in MongoDB\n`);
    
    // Extract detailed information
    const missingDetails = missingRegistrations.map(reg => {
      const regData = reg.registration_data || {};
      const bookingContact = regData.bookingContact || {};
      
      return {
        registrationId: reg.registration_id,
        createdAt: reg.created_at,
        registrationType: regData.registrationType || 'unknown',
        bookingContact: {
          firstName: bookingContact.firstName || '',
          lastName: bookingContact.lastName || ''
        },
        // Additional useful fields
        eventTitle: regData.eventTitle || '',
        ticketCount: regData.tickets?.length || 0,
        attendeeCount: regData.attendees?.length || 0
      };
    });
    
    // Sort by creation date
    missingDetails.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Display results
    console.log('Registration ID                              | Created Date        | Type        | Booking Contact');
    console.log('-------------------------------------------|--------------------|--------------|-----------------------');
    
    missingDetails.forEach(reg => {
      const date = new Date(reg.createdAt).toISOString().split('T')[0];
      const name = `${reg.bookingContact.firstName} ${reg.bookingContact.lastName}`.trim() || 'N/A';
      console.log(
        `${reg.registrationId} | ${date} | ${reg.registrationType.padEnd(12)} | ${name}`
      );
    });
    
    // Save to file
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'missing-registrations.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      summary: {
        totalSupabase: allSupabaseRegistrations.length,
        totalMongoDB: mongoRegistrationIds.size,
        missingCount: missingDetails.length
      },
      missingRegistrations: missingDetails
    }, null, 2));
    
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
    // Group by registration type
    const byType: { [key: string]: number } = {};
    missingDetails.forEach(reg => {
      byType[reg.registrationType] = (byType[reg.registrationType] || 0) + 1;
    });
    
    console.log('\n=== MISSING BY TYPE ===');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    
    // Show date range
    if (missingDetails.length > 0) {
      const dates = missingDetails.map(r => new Date(r.createdAt));
      const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
      const latest = new Date(Math.max(...dates.map(d => d.getTime())));
      
      console.log('\n=== DATE RANGE ===');
      console.log(`Earliest: ${earliest.toISOString().split('T')[0]}`);
      console.log(`Latest: ${latest.toISOString().split('T')[0]}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the comparison
findMissingRegistrations();