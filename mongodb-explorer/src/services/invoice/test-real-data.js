#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Run the TypeScript file
require('ts-node/register');
require('./test-with-real-data');