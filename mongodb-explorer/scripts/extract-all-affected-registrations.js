// Load environment variables
require('dotenv').config({ path: '../.env.local' });
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');

// Extract all registration IDs that had "Event ticket undefined not found" errors
async function extractAffectedRegistrations() {
  console.log('🔍 EXTRACTING ALL AFFECTED REGISTRATION IDS');
  console.log('===========================================\n');
  
  const logFilePath = '../sync-logs/enhanced-sync-2025-08-14T14-17-33-920Z.log';
  
  if (!fs.existsSync(logFilePath)) {
    console.error('❌ Log file not found:', logFilePath);
    process.exit(1);
  }
  
  const logContent = fs.readFileSync(logFilePath, 'utf8');
  const lines = logContent.split('\n');
  
  const affectedRegistrations = [];
  let currentRegistrationId = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for "Found registration:" lines
    if (line.includes('Found registration:')) {
      const match = line.match(/Found registration: ([a-f0-9-]{36})/);
      if (match) {
        currentRegistrationId = match[1];
      }
    }
    
    // Look for "Event ticket undefined not found" errors
    if (line.includes('Event ticket undefined not found') && currentRegistrationId) {
      if (!affectedRegistrations.includes(currentRegistrationId)) {
        affectedRegistrations.push(currentRegistrationId);
      }
    }
  }
  
  console.log(`Found ${affectedRegistrations.length} affected registrations:\n`);
  affectedRegistrations.forEach((id, index) => {
    console.log(`${index + 1}. ${id}`);
  });
  
  // Export as JavaScript array for easy copying
  console.log('\n📝 JavaScript array for scripts:');
  console.log('const affectedRegistrationIds = [');
  affectedRegistrations.forEach((id, index) => {
    const comma = index === affectedRegistrations.length - 1 ? '' : ',';
    console.log(`  '${id}'${comma}`);
  });
  console.log('];');
  
  return affectedRegistrations;
}

extractAffectedRegistrations().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});