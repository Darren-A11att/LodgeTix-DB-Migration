const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, '127.0.0.1');
    
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
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    
    if (available) {
      return port;
    }
    
    console.log(`Port ${port} is busy, trying next...`);
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts starting from port ${startPort}`);
}

// Read API port configuration
async function readApiPort() {
  try {
    const configPath = path.join(__dirname, '../.port-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config.apiPort;
  } catch (error) {
    console.warn('Could not read API port config, using default');
    return 3006;
  }
}

// Write environment file for Next.js
async function writeEnvFile(webPort, apiPort) {
  const envPath = path.join(__dirname, '.env.local');
  let existingContent = '';
  
  // Read existing .env.local file
  try {
    existingContent = await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    // File doesn't exist, that's okay
  }
  
  // Parse existing content into key-value pairs
  const envVars = {};
  existingContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  // Update only the NEXT_PUBLIC variables
  envVars['NEXT_PUBLIC_WEB_PORT'] = webPort;
  envVars['NEXT_PUBLIC_API_URL'] = `http://localhost:${apiPort}/api`;
  
  // Add MongoDB variables if they don't exist - use production database
  if (!envVars['MONGODB_URI']) {
    envVars['MONGODB_URI'] = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  }
  if (!envVars['MONGODB_DB']) {
    envVars['MONGODB_DB'] = 'LodgeTix';
  }
  
  // Reconstruct the env file content
  const newContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  await fs.writeFile(envPath, newContent);
}

async function startServer() {
  try {
    // Read API port from config
    const apiPort = await readApiPort();
    console.log(`📡 API server detected on port ${apiPort}`);
    
    // Find available web port
    const defaultWebPort = parseInt(process.env.WEB_PORT || '3005');
    const webPort = await findAvailablePort(defaultWebPort);
    
    // Write environment configuration
    await writeEnvFile(webPort, apiPort);
    
    // Prepare Next.js app
    const app = next({ dev, hostname, port: webPort });
    const handle = app.getRequestHandler();
    
    await app.prepare();
    
    // Create server
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    })
    .once('error', (err) => {
      console.error(err);
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