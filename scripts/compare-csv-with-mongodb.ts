import { MongoClient } from 'mongodb';
import { parse } from 'csv-parse';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB config
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function compareCSVWithMongoDB() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== COMPARING SUPABASE CSV WITH MONGODB ===\n');
    
    // Read and parse CSV
    const csvPath = '/Users/darrenallatt/Downloads/registrations_rows (2).csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records = await new Promise<any[]>((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
    
    console.log(`Found ${records.length} registrations in CSV`);
    
    // Get all registration IDs from MongoDB
    const mongoRegistrations = await registrationsCollection
      .find({}, { projection: { registrationId: 1, confirmationNumber: 1 } })
      .toArray();
    
    const mongoRegIds = new Set(mongoRegistrations.map(r => r.registrationId));
    console.log(`Found ${mongoRegIds.size} registrations in MongoDB`);
    
    // Find missing registrations
    const missingRegistrations = [];
    const csvRegIds = new Set();
    
    for (const record of records) {
      const regId = record.registration_id;
      csvRegIds.add(regId);
      
      if (!mongoRegIds.has(regId)) {
        missingRegistrations.push({
          registrationId: regId,
          confirmationNumber: record.confirmation_number,
          registrationType: record.registration_type,
          status: record.status,
          paymentStatus: record.payment_status,
          createdAt: record.created_at,
          totalAmountPaid: record.total_amount_paid,
          customerEmail: record.registration_data ? 
            JSON.parse(record.registration_data).bookingContact?.emailAddress : 'N/A'
        });
      }
    }
    
    console.log(`\nFound ${missingRegistrations.length} registrations in CSV but not in MongoDB:\n`);
    
    if (missingRegistrations.length > 0) {
      // Group by status
      const byStatus = missingRegistrations.reduce((acc, reg) => {
        const status = reg.status || 'unknown';
        if (!acc[status]) acc[status] = [];
        acc[status].push(reg);
        return acc;
      }, {} as Record<string, any[]>);
      
      for (const [status, regs] of Object.entries(byStatus)) {
        console.log(`\n${status.toUpperCase()} (${regs.length}):`);
        regs.forEach(reg => {
          console.log(`  - ${reg.confirmationNumber} (${reg.registrationId}) - ${reg.registrationType} - Payment: ${reg.paymentStatus}`);
        });
      }
      
      // Save missing registrations to file for import
      const outputPath = path.join(__dirname, 'missing-registrations-from-csv.json');
      fs.writeFileSync(outputPath, JSON.stringify({
        count: missingRegistrations.length,
        registrations: missingRegistrations,
        csvRegistrationIds: Array.from(csvRegIds)
      }, null, 2));
      
      console.log(`\nMissing registrations saved to: ${outputPath}`);
    }
    
    // Check for registrations in MongoDB but not in CSV
    const inMongoNotInCSV = [];
    for (const mongoReg of mongoRegistrations) {
      if (!csvRegIds.has(mongoReg.registrationId)) {
        inMongoNotInCSV.push(mongoReg);
      }
    }
    
    if (inMongoNotInCSV.length > 0) {
      console.log(`\n⚠️  Found ${inMongoNotInCSV.length} registrations in MongoDB but not in CSV:`);
      inMongoNotInCSV.forEach(reg => {
        console.log(`  - ${reg.confirmationNumber} (${reg.registrationId})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the comparison
compareCSVWithMongoDB();