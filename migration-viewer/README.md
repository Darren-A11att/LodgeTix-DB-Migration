# Migration Viewer

A web interface for viewing and validating migrated records from the LodgeTix database migration.

## Features

- **Dashboard View**: Shows counts of all migrated collections (Orders, Catalog Objects, Contacts, etc.)
- **List View**: Browse records by type with pagination and search
- **Comparison View**: Side-by-side comparison of original vs migrated records
- **Field Mapping**: Visual mapping showing how fields were transformed during migration

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB running locally with the original data
- Migration output files in `../test-migration-output/`

### Installation & Running

```bash
# From the migration-viewer directory
./start-viewer.sh

# Or manually:
npm install
npm run dev
```

The viewer will be available at: http://localhost:3003

## Usage

1. **Browse Collections**: Click on any collection card to view its records
2. **View Details**: Click "View Comparison" on any record to see:
   - Original record from MongoDB
   - Migrated record from JSON files
   - Field-by-field mapping showing transformations

## Views

### Side-by-Side View
Shows the full JSON of both original and migrated records for detailed inspection.

### Field Mapping View
Shows a table with:
- Field names
- Original values
- Migrated values
- Transformation notes
- Highlights differences in yellow

## Configuration

The viewer expects:
- Migration output in `../test-migration-output/`
- MongoDB connection at `mongodb://localhost:27017/dirty`

To change these, update the environment variables:
```bash
MONGO_URI=mongodb://your-mongo-uri
OUTPUT_DIR=/path/to/migration/output
```