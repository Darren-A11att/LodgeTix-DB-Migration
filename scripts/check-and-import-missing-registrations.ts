import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function checkAndImportMissingRegistrations() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrationsCollection = db.collection('registrations');
    const importQueueCollection = db.collection('import_queue');
    
    console.log('=== CHECKING FOR MISSING REGISTRATIONS ===\n');
    
    // Step 1: Get all registration IDs from MongoDB
    const mongoRegistrations = await registrationsCollection
      .find({}, { projection: { registrationId: 1 } })
      .toArray();
    
    const mongoRegIds = new Set(mongoRegistrations.map(r => r.registrationId));
    console.log(`Found ${mongoRegIds.size} registrations in MongoDB`);
    
    // Step 2: Get all registration IDs from import queue
    const queueItems = await importQueueCollection
      .find({}, { projection: { 'registrationData.registrationId': 1, 'registrationData.id': 1 } })
      .toArray();
    
    const queueRegIds = new Set(queueItems.map(item => 
      item.registrationData?.registrationId || item.registrationData?.id
    ).filter(Boolean));
    console.log(`Found ${queueRegIds.size} registrations in import queue`);
    
    // Step 3: Get all registrations from Supabase
    const { data: supabaseRegistrations, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${supabaseRegistrations?.length || 0} registrations in Supabase`);
    
    // Step 4: Find registrations that are neither in MongoDB nor in import queue
    const missingRegistrations = [];
    
    for (const reg of supabaseRegistrations || []) {
      const regId = reg.id || reg.registration_id;
      
      if (!mongoRegIds.has(regId) && !queueRegIds.has(regId)) {
        missingRegistrations.push(reg);
      }
    }
    
    console.log(`\nFound ${missingRegistrations.length} registrations not in MongoDB or import queue`);
    
    if (missingRegistrations.length > 0) {
      console.log('\n=== ADDING MISSING REGISTRATIONS TO IMPORT QUEUE ===\n');
      
      let addedCount = 0;
      let errorCount = 0;
      
      for (const reg of missingRegistrations) {
        try {
          // Create import queue item
          const queueItem = {
            importType: 'registration',
            importStatus: 'pending',
            registrationData: reg,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              source: 'missing-registrations-check',
              registrationId: reg.id || reg.registration_id,
              confirmationNumber: reg.confirmation_number,
              registrationType: reg.registration_type
            }
          };
          
          const result = await importQueueCollection.insertOne(queueItem);
          
          if (result.acknowledged) {
            addedCount++;
            console.log(`✅ Added ${reg.confirmation_number} (${reg.registration_type}) to import queue`);
          } else {
            errorCount++;
            console.log(`❌ Failed to add ${reg.confirmation_number} to import queue`);
          }
        } catch (error) {
          errorCount++;
          console.log(`❌ Error adding ${reg.confirmation_number} to import queue:`, error);
        }
      }
      
      console.log(`\n=== SUMMARY ===`);
      console.log(`Successfully added to queue: ${addedCount}`);
      console.log(`Errors: ${errorCount}`);
    }
    
    // Step 5: Check for duplicate registration IDs in MongoDB
    console.log('\n=== CHECKING FOR DUPLICATE REGISTRATION IDs ===\n');
    
    const duplicates = await registrationsCollection.aggregate([
      {
        $group: {
          _id: '$registrationId',
          count: { $sum: 1 },
          documents: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate registration IDs:`);
      
      for (const dup of duplicates) {
        console.log(`\nRegistration ID: ${dup._id}`);
        console.log(`Count: ${dup.count}`);
        console.log(`Document IDs: ${dup.documents.join(', ')}`);
        
        // Get more details about the duplicates
        const dupDocs = await registrationsCollection
          .find({ registrationId: dup._id })
          .project({ 
            confirmationNumber: 1, 
            registrationType: 1, 
            createdAt: 1,
            'registrationData.bookingContact.firstName': 1,
            'registrationData.bookingContact.lastName': 1
          })
          .toArray();
        
        dupDocs.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.confirmationNumber} - ${doc.registrationData?.bookingContact?.firstName} ${doc.registrationData?.bookingContact?.lastName} (${doc.registrationType})`);
        });
      }
    } else {
      console.log('✅ No duplicate registration IDs found');
    }
    
    // Step 6: Process import queue
    console.log('\n=== PROCESSING IMPORT QUEUE ===\n');
    
    const pendingImports = await importQueueCollection
      .find({ importStatus: 'pending', importType: 'registration' })
      .limit(10) // Process 10 at a time
      .toArray();
    
    console.log(`Found ${pendingImports.length} pending registrations to import`);
    
    if (pendingImports.length > 0) {
      console.log('\nTo process these imports, run: npm run import-with-ownership');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkAndImportMissingRegistrations();