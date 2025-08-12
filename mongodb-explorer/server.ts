import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import * as net from 'net';
import * as dotenv from 'dotenv';

interface PortConfig {
  apiPort: number;
}

interface EnvVars {
  [key: string]: string;
}

// Load parent environment variables first
const parentEnvPath = path.join(__dirname, '..', '.env.local');
if (fsSync.existsSync(parentEnvPath)) {
  console.log('Loading parent .env.local from:', parentEnvPath);
  dotenv.config({ path: parentEnvPath });
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    // Don't specify host to check both IPv4 and IPv6
    server.listen(port);
    
    server.on('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Find an available port
async function findAvailablePort(startPort: number, maxAttempts = 10, skipPorts: number[] = []): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    
    // Skip ports that are reserved (like the API port)
    if (skipPorts.includes(port)) {
      console.log(`Port ${port} is reserved for API, skipping...`);
      continue;
    }
    
    const available = await isPortAvailable(port);
    
    if (available) {
      return port;
    }
    
    console.log(`Port ${port} is busy, trying next...`);
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts starting from port ${startPort}`);
}

// Read API port configuration
async function readApiPort(): Promise<number> {
  try {
    const configPath = path.join(__dirname, '../.port-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config: PortConfig = JSON.parse(configData);
    return config.apiPort;
  } catch (error) {
    console.warn('Could not read API port config, using default');
    return 3006;
  }
}

// Write environment file for Next.js
async function writeEnvFile(webPort: number, apiPort: number): Promise<void> {
  const envPath = path.join(__dirname, '.env.local');
  let existingContent = '';
  
  // Read existing .env.local file
  try {
    existingContent = await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    // File doesn't exist, that's okay
  }
  
  // Parse existing content into key-value pairs
  const envVars: EnvVars = {};
  existingContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  // Update only the NEXT_PUBLIC variables
  envVars['NEXT_PUBLIC_WEB_PORT'] = webPort.toString();
  envVars['NEXT_PUBLIC_API_URL'] = `http://localhost:${apiPort}/api`;
  
  // Add MongoDB variables if they don't exist - use migration test database
  if (!envVars['MONGODB_URI']) {
    envVars['MONGODB_URI'] = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  }
  if (!envVars['MONGODB_DB']) {
    envVars['MONGODB_DB'] = 'lodgetix';
  }
  
  // Preserve SQUARE_ACCESS_TOKEN if it exists from parent env
  if (process.env.SQUARE_ACCESS_TOKEN && !envVars['SQUARE_ACCESS_TOKEN']) {
    envVars['SQUARE_ACCESS_TOKEN'] = process.env.SQUARE_ACCESS_TOKEN;
  }
  
  // Reconstruct the env file content
  const newContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  await fs.writeFile(envPath, newContent);
}

async function startServer(): Promise<void> {
  try {
    // Read API port from config
    const apiPort = await readApiPort();
    console.log(`📡 API server detected on port ${apiPort}`);
    
    // Find available web port (skip the API port)
    const defaultWebPort = parseInt(process.env.WEB_PORT || '3005');
    const webPort = await findAvailablePort(defaultWebPort, 10, [apiPort]);
    
    // Write environment configuration
    await writeEnvFile(webPort, apiPort);
    
    // Prepare Next.js app
    const app = next({ dev, hostname, port: webPort });
    const handle = app.getRequestHandler();
    
    await app.prepare();
    
    // Create server
    createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    })
    .once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${webPort} is still in use despite checks.`);
        console.error(`   This might be due to a race condition or permission issue.`);
        console.error(`   Please try again or manually kill the process using port ${webPort}`);
        console.error(`   You can use: lsof -i :${webPort} to find the process`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    })
    .listen(webPort, () => {
      console.log(`🌐 MongoDB Explorer running at http://${hostname}:${webPort}`);
      if (webPort !== defaultWebPort) {
        console.log(`✨ Port ${defaultWebPort} was busy, automatically found port ${webPort}`);
      }
      console.log(`🔗 Connected to API at http://localhost:${apiPort}`);
      console.log('\nPress Ctrl+C to stop the server');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down MongoDB Explorer...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down MongoDB Explorer...');
  process.exit(0);
});

startServer();
