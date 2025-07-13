import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * Load environment variables from the parent project's .env.local file
 */
export function loadParentEnv() {
  // In Next.js, we need to use process.cwd() instead of __dirname
  // because __dirname behaves differently in the compiled output
  const projectRoot = process.cwd();
  const parentProjectPath = path.resolve(projectRoot, '..');
  const parentEnvPath = path.join(parentProjectPath, '.env.local');
  
  console.log('Current working directory:', projectRoot);
  console.log('Parent project path:', parentProjectPath);
  console.log('Loading parent env from:', parentEnvPath);
  console.log('File exists:', fs.existsSync(parentEnvPath));
  
  if (fs.existsSync(parentEnvPath)) {
    const result = dotenv.config({ path: parentEnvPath });
    if (result.error) {
      console.error('Error loading parent .env.local:', result.error);
    } else {
      console.log('Successfully loaded parent .env.local');
      console.log('SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
      console.log('Token starts with:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 4));
    }
  } else {
    console.error('Parent .env.local not found at:', parentEnvPath);
  }
  
  // Also try to load the local .env.local as a fallback
  const localEnvPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(localEnvPath)) {
    console.log('Loading local .env.local as fallback');
    const localResult = dotenv.config({ path: localEnvPath });
    if (!localResult.error) {
      console.log('Successfully loaded local .env.local');
      console.log('SQUARE_ACCESS_TOKEN exists after local load:', !!process.env.SQUARE_ACCESS_TOKEN);
    }
  }
}