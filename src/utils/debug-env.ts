import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

console.log('Environment variables check:');
console.log('----------------------------');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set (hidden)' : 'NOT SET');
console.log('MONGODB_DATABASE:', process.env.MONGODB_DATABASE || 'NOT SET');
console.log('MONGODB_PASSWORD:', process.env.MONGODB_PASSWORD ? 'Set (hidden)' : 'NOT SET');

// Show first part of URI to debug
if (process.env.MONGODB_URI) {
  const uriParts = process.env.MONGODB_URI.split('@');
  if (uriParts.length > 1) {
    console.log('MongoDB URI format:', uriParts[0].substring(0, 20) + '...@' + uriParts[1].substring(0, 20) + '...');
  }
  
  // Check if it's the Atlas format with <db_password>
  if (process.env.MONGODB_URI.includes('<db_password>')) {
    console.log('MongoDB URI contains <db_password> placeholder - will be replaced');
  }
  
  // Check URI format
  if (process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    console.log('Using MongoDB Atlas SRV connection');
  } else if (process.env.MONGODB_URI.startsWith('mongodb://')) {
    console.log('Using standard MongoDB connection');
  }
}

console.log('\nSupabase variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set (hidden)' : 'NOT SET');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Set (hidden)' : 'NOT SET');

console.log('\nPostgres variables:');
console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST || 'NOT SET');
console.log('POSTGRES_DATABASE:', process.env.POSTGRES_DATABASE || 'NOT SET');