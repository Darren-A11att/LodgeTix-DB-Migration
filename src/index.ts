console.log(`
🚀 LodgeTix MongoDB Migration & Reconciliation Tool

Available commands:
  npm run server      - Start web server to view MongoDB data
  npm run migrate     - Run migration scripts (not yet implemented)
  npm test            - Run tests (not yet implemented)

Utility scripts:
  npx ts-node src/utils/test-connections.ts    - Test database connections
  npx ts-node src/scripts/explore-database.ts  - Explore database structure
  npx ts-node src/scripts/explore-events.ts    - Explore events collection

To view your events data:
  1. Run: npm run server
  2. Open: http://localhost:3000
`);