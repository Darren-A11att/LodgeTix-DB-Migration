<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
# LodgeTix - Square Payment Reconciliation

A comprehensive tool for synchronizing and reconciling payment data between the Square API and the LodgeTix MongoDB database. This ensures we have accurate and up-to-date financial data in our system.

## Overview

This project provides tools and scripts to:
- Define clean MongoDB schemas with validation rules
- Connect to the Square Payments API to fetch transaction data
- Transform and load Square payment data into the LodgeTix database
- Reconcile payment records to ensure data integrity
- Create indexes for optimal performance
- Set up computed fields using MongoDB views
- Validate and transform data during migration

## Project Structure

```
├── docs/database-schema/     # Database schema documentation
│   ├── collections/         # Schema for each collection
│   └── migration-strategy.md
├── scripts/                 # Migration and setup scripts
│   ├── mongodb-setup/      # Database creation scripts
│   └── copy-schemas.sh     # Schema copying utility
├── src/                    # Source code
│   ├── constants/          # Application constants
│   ├── services/           # Migration services
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
└── mongodb-explorer/       # Web-based data explorer
```

## Prerequisites

- Node.js 18+ 
- MongoDB 5.0+
- Access to both source and destination MongoDB clusters

## Installation

```bash
# Clone the repository
git clone https://github.com/Darren-A11att/LodgeTix-DB-Migration.git
cd LodgeTix-DB-Migration

# Install dependencies
npm install
```

## Configuration

Create a `.env.local` file in the root directory:

```env

# Destination MongoDB (new clean database)
NEW_MONGODB_URI=mongodb+srv://username:password@dest-cluster.mongodb.net/
NEW_MONGODB_DATABASE=LodgeTix

# Migration settings
BATCH_SIZE=1000
LOG_LEVEL=info
```

## Database Setup

### 1. Create the New Database Structure

```bash
cd scripts/mongodb-setup
node setup-database.js
```

This will:
- Create all collections with validation rules
- Set up indexes for performance
- Create computed field views
- Register scheduled aggregation functions

### 2. Run Individual Setup Scripts

If you prefer to run scripts individually:

```bash
node 01-create-collections.js        # Core collections
node 02-create-remaining-collections.js  # Additional collections
node 03-create-indexes.js           # Indexes
node 04-create-computed-fields.js   # Computed views
```

## Collections

### Core Collections
- **attendees** - Event attendees with QR codes and check-in tracking
- **contacts** - Centralized contact management
- **financial-transactions** - Financial records and reconciliation
- **functions** - Major events (parent of individual events)
- **invoices** - Invoice generation and tracking
- **jurisdictions** - Masonic jurisdiction hierarchy
- **organisations** - Lodges and other organizations
- **products** - Tickets, merchandise, and packages
- **registrations** - Event registrations
- **tickets** - Individual tickets with QR codes
- **users** - User accounts and authentication

### Computed Views
- **attendees_with_computed** - Adds fullName, check-in status, etc.
- **contacts_with_computed** - Adds display names, profile completion
- **functions_with_dates** - Computes start/end dates from events
- **registrations_with_totals** - Adds payment calculations
- **tickets_with_status** - Computes validity and usage status
- **transactions_with_calculations** - Adds reconciliation flags

## Schema Documentation

Each collection has comprehensive documentation in `docs/database-schema/collections/[collection-name]/`:

- `schema.md` - MongoDB document structure
- `documents.json` - Field mappings from legacy database
- `indexes.md` - Index definitions
- `validation.md` - Validation rules
- `aggregations.md` - Common aggregation pipelines

## Data Explorer

A web-based MongoDB explorer is included for browsing the migrated data:

```bash
cd mongodb-explorer
npm install
npm run dev
```

Access at: http://localhost:3005

## Migration Process

1. **Setup new database**: Run the setup scripts
2. **Map legacy data**: Review documents.json files
3. **Run migration**: Use migration scripts (coming soon)
4. **Validate data**: Check computed views and run validation
5. **Test thoroughly**: Use the data explorer to verify

## Key Features

### Validation Rules
- Strict schema validation on all collections
- Pattern matching for IDs, emails, phone numbers
- Enum validation for status fields
- Required field enforcement

### Computed Fields
- Dynamic calculation of full names, display names
- Real-time check-in status
- Payment calculations and balances
- Ticket validity and expiration

### Performance Optimization
- Indexes on all foreign keys
- Compound indexes for common queries
- Text search indexes for name searches
- Sparse indexes for optional unique fields

### Data Integrity
- Unique constraints on business keys
- Referential integrity through ObjectId types
- Atomic operations for data consistency
- Audit trails on all modifications

## Security

### Secret Management

**DO NOT** commit `.env` files to source control. The `.gitignore` file is already configured to prevent this.

For production environments, do not use `.env` files. Instead, use the secret management tools provided by your hosting platform or cloud provider, such as:
- Vercel Environment Variables
- AWS Secrets Manager
- Google Cloud Secret Manager

## Scheduled Tasks

The following aggregations should be scheduled:

1. **Update Function Dates** (every 6 hours)
   - Syncs function dates with event dates

2. **Update Ticket Expiry** (daily)
   - Marks expired tickets based on validity

3. **Update Invoice Status** (daily)
   - Flags overdue invoices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary software for LodgeTix.

## Support

For questions or issues, please contact the development team.
>>>>>>> origin/main
