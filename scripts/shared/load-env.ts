// Centralized environment loading for sync-related scripts
// STANDARDIZED: Uses .env.explorer as the single source of truth for all sync operations
// This ensures consistency across all sync scripts and prevents environment mismatches
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Standard environment file path for all sync operations
const mongodbExplorerEnvPath = path.resolve(process.cwd(), 'mongodb-explorer', '.env.explorer');

// Load .env.explorer as the single source of truth for sync operations
if (fs.existsSync(mongodbExplorerEnvPath)) {
  console.log(`Loading environment from: ${mongodbExplorerEnvPath}`);
  const result = dotenv.config({ path: mongodbExplorerEnvPath });
  if (result.error) {
    console.error('Failed to load .env.explorer:', result.error);
  } else {
    console.log(`Loaded ${Object.keys(result.parsed || {}).length} environment variables from .env.explorer`);
  }
} else {
  console.error('Error: .env.explorer not found at:', mongodbExplorerEnvPath);
  console.error('Please ensure /mongodb-explorer/.env.explorer exists with the required environment variables.');
}

