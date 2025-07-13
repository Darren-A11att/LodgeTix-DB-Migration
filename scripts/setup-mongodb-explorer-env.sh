#!/bin/bash

# This script copies Square credentials from main project to mongodb-explorer

MAIN_ENV="../.env.local"
EXPLORER_ENV="../mongodb-explorer/.env.local"

echo "Setting up Square credentials for MongoDB Explorer..."

# Check if main .env.local exists
if [ ! -f "$MAIN_ENV" ]; then
    echo "Error: Main project .env.local not found at $MAIN_ENV"
    exit 1
fi

# Extract Square credentials from main .env.local
SQUARE_APP_ID=$(grep "^SQUARE_APPLICATION_ID=" "$MAIN_ENV" | cut -d'=' -f2-)
SQUARE_TOKEN=$(grep "^SQUARE_ACCESS_TOKEN=" "$MAIN_ENV" | cut -d'=' -f2-)

if [ -z "$SQUARE_TOKEN" ]; then
    echo "Error: SQUARE_ACCESS_TOKEN not found in main .env.local"
    exit 1
fi

# Append to mongodb-explorer .env.local if not already present
if ! grep -q "SQUARE_ACCESS_TOKEN=" "$EXPLORER_ENV" 2>/dev/null; then
    echo "" >> "$EXPLORER_ENV"
    echo "# Square API Credentials (copied from main project)" >> "$EXPLORER_ENV"
    [ -n "$SQUARE_APP_ID" ] && echo "SQUARE_APPLICATION_ID=$SQUARE_APP_ID" >> "$EXPLORER_ENV"
    echo "SQUARE_ACCESS_TOKEN=$SQUARE_TOKEN" >> "$EXPLORER_ENV"
    echo "✓ Square credentials added to $EXPLORER_ENV"
else
    echo "⚠️  SQUARE_ACCESS_TOKEN already exists in $EXPLORER_ENV"
    echo "   Please verify it matches the main project's token"
fi

echo ""
echo "Done! Please restart the MongoDB Explorer dev server for changes to take effect."