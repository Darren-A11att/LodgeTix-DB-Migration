#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchSimilarConfirmations() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('Searching for similar confirmation numbers...\n');
    
    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    // The missing confirmation numbers
    const missing = ['IND-345853BB', 'IND-683658FV', 'IND-313622CJ', 'IND-597149MK'];
    
    console.log('1. Checking MongoDB for similar patterns:');
    for (const conf of missing) {
      // Extract the numeric part
      const match = conf.match(/IND-(\d+)([A-Z]{2})/);
      if (match) {
        const number = match[1];
        const pattern = new RegExp(`IND-${number}`);
        
        const similar = await registrationsCollection.find({
          confirmationNumber: pattern
        }).limit(5).toArray();
        
        if (similar.length > 0) {
          console.log(`\nSimilar to ${conf}:`);
          similar.forEach(s => console.log(`  - ${s.confirmationNumber}`));
        }
      }
    }
    
    console.log('\n2. Checking Supabase for registrations with similar patterns:');
    
    // Search for registrations that might have similar patterns
    for (const conf of missing) {
      const match = conf.match(/IND-(\d+)/);
      if (match) {
        const numberPart = match[1];
        
        // Search for registrations with this number pattern
        const { data, error } = await supabase
          .from('registrations')
          .select('confirmation_number, registration_type, created_at')
          .like('confirmation_number', `%${numberPart}%`)
          .limit(5);
        
        if (!error && data && data.length > 0) {
          console.log(`\nSimilar to ${conf} (containing ${numberPart}):`);
          data.forEach(d => {
            console.log(`  - ${d.confirmation_number} (${d.registration_type}) - ${new Date(d.created_at).toLocaleDateString()}`);
          });
        }
      }
    }
    
    // Check if these might be from a different pattern
    console.log('\n3. Checking if these follow a different naming pattern:');
    
    // Get a sample of confirmation numbers from Supabase to see patterns
    const { data: sampleRegs } = await supabase
      .from('registrations')
      .select('confirmation_number')
      .eq('registration_type', 'individuals')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (sampleRegs) {
      console.log('\nRecent individual registration patterns:');
      const patterns = new Set();
      sampleRegs.forEach(r => {
        const pattern = r.confirmation_number.replace(/\d+/, 'XXX').replace(/[A-Z]{2}$/, 'YY');
        patterns.add(pattern);
      });
      patterns.forEach(p => console.log(`  - ${p}`));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
    console.log('\nSearch complete');
  }
}

// Run the search
searchSimilarConfirmations();