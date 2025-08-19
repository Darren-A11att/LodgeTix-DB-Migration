import { MongoClient, ServerApiVersion } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import { config } from '../config/environment';

// Test MongoDB connection
async function testMongoDB(): Promise<void> {
  console.log('Testing MongoDB connection...');
  
  // Build connection URI with credentials
  let connectionUri = config.mongodb.uri;
  
  // Only replace if the URI contains the placeholder
  if (connectionUri.includes('<db_password>') && config.mongodb.password) {
    connectionUri = connectionUri.replace('<db_password>', encodeURIComponent(config.mongodb.password));
  }
  // If the URI already contains credentials, use it as-is
  
  // Create MongoClient with Server API version for MongoDB Atlas
  const client = new MongoClient(connectionUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB connection successful! Pinged your deployment.');
    
    // List databases
    const dbs = await client.db().admin().listDatabases();
    console.log('Available databases:', dbs.databases.map(db => db.name));
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  } finally {
    await client.close();
  }
}

// Test Supabase connection
async function testSupabase(): Promise<void> {
  console.log('\nTesting Supabase connection...');
  
  try {
    const supabase = createClient(config.supabase.url, config.supabase.key);
    
    // First, let's list available tables
    const { data: tables, error: tablesError } = await supabase.rpc('get_tables', {});
    
    if (tablesError) {
      // If RPC doesn't exist, try a simple query on a common table
      // Based on your CSV exports, let's try the 'events' table
      const { error } = await supabase.from('events').select('*').limit(1);
      
      if (error) {
        // Try another common table
        const { error: error2 } = await supabase.from('users').select('*').limit(1);
        
        if (error2) {
          console.error('❌ Supabase connection failed:', error2);
        } else {
          console.log('✅ Supabase connection successful!');
          console.log('Found users table');
        }
      } else {
        console.log('✅ Supabase connection successful!');
        console.log('Found events table');
      }
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Available tables:', tables);
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
  }
}

// Test direct PostgreSQL connection
async function testPostgres(): Promise<void> {
  console.log('\nTesting direct PostgreSQL connection...');
  
  const client = new PgClient({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful!');
    console.log('Server time:', result.rows[0].now);
    
    // List tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Available tables:', tables.rows.map(row => row.table_name));
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
  } finally {
    await client.end();
  }
}

// Run all tests
async function runAllTests(): Promise<void> {
  console.log('🔍 Running connection tests...\n');
  
  await testMongoDB();
  await testSupabase();
  await testPostgres();
  
  console.log('\n✅ Connection tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { testMongoDB, testSupabase, testPostgres, runAllTests };