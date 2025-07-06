const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const viewerDir = path.join(__dirname, '../migration-viewer');
const nodeModulesPath = path.join(viewerDir, 'node_modules');

// Check if node_modules exists
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing migration viewer dependencies...');
  try {
    execSync('npm install', { 
      cwd: viewerDir, 
      stdio: 'inherit' 
    });
    console.log('✅ Migration viewer dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install migration viewer dependencies:', error.message);
    process.exit(1);
  }
}