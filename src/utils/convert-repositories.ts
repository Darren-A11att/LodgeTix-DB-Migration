import * as fs from 'fs';
import * as path from 'path';

const repositoriesPath = path.join(__dirname, '../repositories');
const jsFiles = fs.readdirSync(repositoriesPath).filter(file => file.endsWith('_Repository.js'));

console.log('JavaScript repository files found:');
console.log('=================================');
jsFiles.forEach(file => {
  const collectionName = file.replace('_Repository.js', '');
  console.log(`- ${file} -> ${collectionName} collection`);
});

console.log('\nThese files contain basic CRUD operations for each MongoDB collection.');
console.log('You can:');
console.log('1. Keep them as JavaScript and use them directly');
console.log('2. Convert them to TypeScript with proper interfaces');
console.log('3. Use them as reference while building your own repositories');

// List all collections from the files
const collections = jsFiles.map(file => {
  // Convert camelCase to snake_case
  const name = file.replace('_Repository.js', '');
  return name.replace(/([A-Z])/g, (match, offset) => {
    return offset > 0 ? '_' + match.toLowerCase() : match.toLowerCase();
  });
});

console.log('\nCollections in your MongoDB:');
collections.forEach(col => console.log(`  - ${col}`));