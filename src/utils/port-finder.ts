import * as net from 'net';

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
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

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
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

/**
 * Find available ports for both API and web servers
 */
export async function findAvailablePorts(apiStartPort: number = 3006, webStartPort: number = 3005): Promise<{ apiPort: number; webPort: number }> {
  const apiPort = await findAvailablePort(apiStartPort);
  
  // Ensure web port is different from API port
  let webPort = webStartPort;
  if (webPort === apiPort) {
    webPort = apiPort + 1;
  }
  
  webPort = await findAvailablePort(webPort);
  
  return { apiPort, webPort };
}