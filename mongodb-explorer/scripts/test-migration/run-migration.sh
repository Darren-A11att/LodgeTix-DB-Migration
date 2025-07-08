#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}LodgeTix Test Migration Script${NC}"
echo "================================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Navigate to script directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Clean previous migration output
echo -e "${YELLOW}Cleaning previous migration output...${NC}"
rm -rf ../../test-migration-output/*
echo ""

# Create fresh directories
echo -e "${YELLOW}Creating output directories...${NC}"
mkdir -p ../../test-migration-output/{catalog-objects,contacts,users,orders,tickets,financial-transactions,jurisdictions,organisations,migration-logs}
echo ""

# Run migration
echo -e "${GREEN}Starting migration...${NC}"
echo ""
node migrate-all.js

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Migration completed successfully!${NC}"
    echo ""
    echo "Output location: $(pwd)/../../test-migration-output/"
    echo "View the migration report at: $(pwd)/../../test-migration-output/migration-logs/migration-report.md"
else
    echo ""
    echo -e "${RED}Migration failed!${NC}"
    echo "Check the error logs at: $(pwd)/../../test-migration-output/migration-logs/errors.json"
    exit 1
fi