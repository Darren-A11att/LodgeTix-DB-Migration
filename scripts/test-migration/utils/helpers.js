const fs = require('fs').promises;
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../../../test-migration-output');

async function writeDocument(collection, id, document) {
  const dir = path.join(OUTPUT_DIR, collection);
  const filename = `${id}.json`;
  const filepath = path.join(dir, filename);
  
  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(filepath, JSON.stringify(document, null, 2));
  
  // Update stats if migrationState is available
  if (global.migrationState?.stats) {
    // Keep hyphenated names as they are in the stats object
    if (global.migrationState.stats[collection] !== undefined) {
      global.migrationState.stats[collection]++;
    }
  }
}

async function logError(stage, error, context = {}) {
  const errorLog = {
    timestamp: new Date(),
    stage,
    error: error.message || error,
    stack: error.stack,
    context
  };
  
  if (global.migrationState?.errors) {
    global.migrationState.errors.push(errorLog);
  }
  
  console.error(`[ERROR] ${stage}: ${error.message || error}`);
  
  // Write to error log file
  const errorFile = path.join(OUTPUT_DIR, 'migration-logs', 'errors.json');
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(errorFile), { recursive: true });
    
    let errors = [];
    try {
      const existing = await fs.readFile(errorFile, 'utf8');
      errors = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist yet
    }
    
    errors.push(errorLog);
    await fs.writeFile(errorFile, JSON.stringify(errors, null, 2));
  } catch (e) {
    console.error('Failed to write error log:', e);
  }
}

async function logWarning(stage, message, context = {}) {
  const warning = {
    timestamp: new Date(),
    stage,
    message,
    context
  };
  
  if (global.migrationState?.warnings) {
    global.migrationState.warnings.push(warning);
  }
  
  console.warn(`[WARNING] ${stage}: ${message}`);
  
  // Write to warning log file
  const warningFile = path.join(OUTPUT_DIR, 'migration-logs', 'warnings.json');
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(warningFile), { recursive: true });
    
    let warnings = [];
    try {
      const existing = await fs.readFile(warningFile, 'utf8');
      warnings = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist yet
    }
    
    warnings.push(warning);
    await fs.writeFile(warningFile, JSON.stringify(warnings, null, 2));
  } catch (e) {
    console.error('Failed to write warning log:', e);
  }
}

module.exports = {
  writeDocument,
  logError,
  logWarning
};