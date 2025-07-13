#!/bin/bash

echo "=== Updating pending-imports references to registration_imports ==="
echo ""

# Define directories to search
DIRS=(
    "src"
    "mongodb-explorer/src"
)

# Count occurrences first
echo "Counting occurrences..."
TOTAL=0
for DIR in "${DIRS[@]}"; do
    if [ -d "$DIR" ]; then
        COUNT=$(grep -r "pending-imports" "$DIR" --include="*.ts" --include="*.tsx" --include="*.js" | wc -l)
        echo "  $DIR: $COUNT occurrences"
        TOTAL=$((TOTAL + COUNT))
    fi
done

echo ""
echo "Total occurrences to update: $TOTAL"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with the update? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Updating files..."
    
    # Update TypeScript and JavaScript files
    for DIR in "${DIRS[@]}"; do
        if [ -d "$DIR" ]; then
            echo "  Processing $DIR..."
            find "$DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i '' 's/pending-imports/registration_imports/g' {} \;
        fi
    done
    
    echo ""
    echo "✅ All references updated!"
    
    # Show some examples of updated files
    echo ""
    echo "Sample of updated files:"
    for DIR in "${DIRS[@]}"; do
        if [ -d "$DIR" ]; then
            grep -r "registration_imports" "$DIR" --include="*.ts" --include="*.tsx" --include="*.js" | head -5
        fi
    done
else
    echo "Update cancelled."
fi