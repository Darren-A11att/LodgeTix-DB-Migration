#!/bin/bash

# MongoDB Index Creation Runner Script
# This script helps you safely create indexes in MongoDB

echo "========================================="
echo "MongoDB Production Index Creation"
echo "========================================="
echo ""

# Check if MongoDB connection string is provided
if [ -z "$1" ]; then
    echo "Usage: ./run-index-creation.sh <mongodb-connection-string> [options]"
    echo ""
    echo "Examples:"
    echo "  Dry run (default):"
    echo "    ./run-index-creation.sh 'mongodb://localhost:27017/lodgetix'"
    echo ""
    echo "  Create indexes:"
    echo "    ./run-index-creation.sh 'mongodb://localhost:27017/lodgetix' --create"
    echo ""
    echo "  With authentication:"
    echo "    ./run-index-creation.sh 'mongodb://username:password@host:port/database?authSource=admin'"
    echo ""
    exit 1
fi

CONNECTION_STRING=$1
CREATE_MODE=${2:-"--dry-run"}

if [ "$CREATE_MODE" == "--create" ]; then
    echo "⚠️  WARNING: This will create indexes in PRODUCTION!"
    echo "This operation will run in the background but may impact performance."
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Operation cancelled."
        exit 0
    fi
    
    echo ""
    echo "Creating indexes..."
    mongo "$CONNECTION_STRING" --eval "var dryRun=false" create-indexes-production.js
else
    echo "Running in DRY RUN mode (no indexes will be created)"
    echo "To actually create indexes, add --create flag"
    echo ""
    mongo "$CONNECTION_STRING" --eval "var dryRun=true" create-indexes-production.js
fi

echo ""
echo "========================================="
echo "Operation completed!"
echo "========================================="