// Test the enhanced sync with just 2 payments
const { spawn } = require('child_process');
const path = require('path');

// Set environment variable to limit the sync
process.env.SYNC_TEST_LIMIT = '2';

console.log('=== TESTING ENHANCED SYNC (2 payments) ===\n');

const syncProcess = spawn('node', [path.join(__dirname, 'sync-all-square-payments.js')], {
  env: { ...process.env, SYNC_TEST_LIMIT: '2' },
  stdio: 'inherit'
});

syncProcess.on('close', (code) => {
  console.log(`\nSync process exited with code ${code}`);
  process.exit(code);
});