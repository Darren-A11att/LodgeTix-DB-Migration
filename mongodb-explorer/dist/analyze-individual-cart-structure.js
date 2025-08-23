"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeIndividualCartStructure = analyzeIndividualCartStructure;
const mongodb_1 = require("mongodb");
const fs = require("fs");
const path = require("path");
// Required fields for complete attendee information based on actual cart structure
const REQUIRED_FIELDS = [
    // Basic info
    'firstName',
    'lastName',
    'email',
    'phone',
    'title',
    // Mason details (may be empty for guests)
    'lodgeName',
    'lodgeNumber',
    'rank',
    // Additional info
    'dietary', // actual field name in the carts
    'accessibility', // actual field name
    'specialNeeds',
    // Relationship info
    'isPartner',
    'partnerOf',
    'relationship'
];
async function analyzeIndividualCartStructure() {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    console.log(`Connecting to MongoDB at: ${mongoUrl}`);
    const client = new mongodb_1.MongoClient(mongoUrl);
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        console.log('Connected to MongoDB successfully');
        console.log('Accessing supabase database...');
        const db = client.db('supabase');
        console.log('Accessing carts collection...');
        const collection = db.collection('carts');
        // Find all carts with individual registration items
        console.log('Searching for carts with individual registration items...');
        const individualCarts = await collection.find({
            'cartItems.metadata.registrationType': 'individual'
        }).toArray();
        console.log(`Found ${individualCarts.length} individual carts`);
        const report = {
            totalCarts: individualCarts.length,
            cartsWithIssues: 0,
            issues: {
                incompleteBundleStructure: [],
                incompleteFormData: [],
                improperlLinkedChildren: [],
                multipleBundlesPerCart: []
            },
            examples: {}
        };
        for (const cart of individualCarts) {
            let hasIssues = false;
            // Get individual registration items (these act as bundles)
            const individualItems = cart.cartItems.filter(item => item.metadata?.registrationType === 'individual' &&
                item.formData &&
                !item.parentItemId);
            // Get child items (bundled event tickets)
            const childItems = cart.cartItems.filter(item => item.parentItemId);
            // Check 1: Bundle structure analysis
            // For individual registrations, each attendee should have their own item with formData
            const attendeeCount = individualItems.length;
            // Check 2: FormData completeness for each individual item
            for (const item of individualItems) {
                const missingFields = [];
                const formData = item.formData || {};
                // Check for required fields
                for (const field of REQUIRED_FIELDS) {
                    if (!formData[field] || formData[field] === '' || formData[field] === null) {
                        missingFields.push(field);
                    }
                }
                // Store examples
                if (missingFields.length === 0 && !report.examples.goodFormData) {
                    report.examples.goodFormData = {
                        bundleId: item.cartItemId,
                        formData: item.formData
                    };
                }
                if (missingFields.length > 0) {
                    report.issues.incompleteFormData.push({
                        cart,
                        bundleId: item.cartItemId,
                        missingFields,
                        formData
                    });
                    hasIssues = true;
                    if (!report.examples.badFormData) {
                        report.examples.badFormData = {
                            bundleId: item.cartItemId,
                            missingFields,
                            formData
                        };
                    }
                }
            }
            // Check 3: Child items linking
            const orphanedChildren = childItems.filter(child => {
                const parentExists = individualItems.some(item => item.cartItemId === child.parentItemId);
                return !parentExists;
            });
            if (orphanedChildren.length > 0) {
                report.issues.improperlLinkedChildren.push({
                    cart,
                    childItems: orphanedChildren
                });
                hasIssues = true;
            }
            // Check 4: Verify individual cart structure (should have at least one individual item)
            if (individualItems.length === 0) {
                report.issues.incompleteBundleStructure.push(cart);
                hasIssues = true;
            }
            if (hasIssues) {
                report.cartsWithIssues++;
            }
        }
        console.log('Analysis complete, returning report...');
        return report;
    }
    catch (error) {
        console.error('Error in analyzeIndividualCartStructure:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
    finally {
        console.log('Closing MongoDB connection...');
        await client.close();
        console.log('MongoDB connection closed.');
    }
}
function generateReport(report) {
    let output = `
INDIVIDUAL CART STRUCTURE ANALYSIS REPORT
=========================================

SUMMARY:
- Total individual carts analyzed: ${report.totalCarts}
- Carts with issues: ${report.cartsWithIssues}
- Carts without issues: ${report.totalCarts - report.cartsWithIssues}
- Success rate: ${((report.totalCarts - report.cartsWithIssues) / report.totalCarts * 100).toFixed(1)}%

ISSUES FOUND:
=============

1. INCOMPLETE INDIVIDUAL STRUCTURE (${report.issues.incompleteBundleStructure.length} carts)
   - Carts with no individual registration items
   
2. MULTIPLE BUNDLES PER CART (${report.issues.multipleBundlesPerCart.length} carts)
   - Not applicable for current cart structure
   
3. INCOMPLETE FORM DATA (${report.issues.incompleteFormData.length} items)
   - Individual items missing required attendee information
   
4. IMPROPERLY LINKED CHILDREN (${report.issues.improperlLinkedChildren.length} carts)
   - Child items (event tickets) not properly linked to parent individual items

DETAILED ANALYSIS:
==================
`;
    // Incomplete FormData Details
    if (report.issues.incompleteFormData.length > 0) {
        output += `\nINCOMPLETE FORM DATA DETAILS:\n`;
        const fieldMissing = new Map();
        report.issues.incompleteFormData.forEach(issue => {
            issue.missingFields.forEach(field => {
                fieldMissing.set(field, (fieldMissing.get(field) || 0) + 1);
            });
        });
        output += `\nMost commonly missing fields:\n`;
        Array.from(fieldMissing.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([field, count]) => {
            output += `- ${field}: missing in ${count} bundles\n`;
        });
        // Show specific examples
        output += `\nEXAMPLES OF INCOMPLETE FORM DATA:\n`;
        report.issues.incompleteFormData.slice(0, 3).forEach((issue, index) => {
            output += `\nExample ${index + 1}:\n`;
            output += `Cart ID: ${issue.cart.cartId}\n`;
            output += `Item ID: ${issue.bundleId}\n`;
            output += `Customer: ${issue.cart.customer?.name || 'Unknown'}\n`;
            output += `Missing fields: ${issue.missingFields.join(', ')}\n`;
            output += `Current formData keys: ${Object.keys(issue.formData).join(', ')}\n`;
            output += `Sample formData: ${JSON.stringify(issue.formData, null, 2)}\n`;
        });
    }
    // Examples section
    if (report.examples.goodFormData) {
        output += `\nEXAMPLE OF COMPLETE FORM DATA:\n`;
        output += `Bundle ID: ${report.examples.goodFormData.bundleId}\n`;
        output += `FormData: ${JSON.stringify(report.examples.goodFormData.formData, null, 2)}\n`;
    }
    // Individual structure issues
    if (report.issues.incompleteBundleStructure.length > 0) {
        output += `\nCARTS WITH NO INDIVIDUAL ITEMS:\n`;
        report.issues.incompleteBundleStructure.slice(0, 5).forEach(cart => {
            const totalItems = cart.cartItems?.length || 0;
            const individualItems = cart.cartItems?.filter(item => item.metadata?.registrationType === 'individual') || [];
            output += `- Cart ID: ${cart.cartId} (${totalItems} items, ${individualItems.length} individual items)\n`;
        });
    }
    // Multiple bundles issues (not applicable for current structure, but keeping for completeness)
    if (report.issues.multipleBundlesPerCart.length > 0) {
        output += `\nCARTS WITH MULTIPLE BUNDLES:\n`;
        report.issues.multipleBundlesPerCart.slice(0, 5).forEach(cart => {
            const individualItems = cart.cartItems.filter(i => i.metadata?.registrationType === 'individual');
            output += `- Cart ID: ${cart.cartId} has ${individualItems.length} individual items\n`;
        });
    }
    // Orphaned children issues
    if (report.issues.improperlLinkedChildren.length > 0) {
        output += `\nCARTS WITH ORPHANED CHILD ITEMS:\n`;
        report.issues.improperlLinkedChildren.slice(0, 5).forEach(issue => {
            output += `- Cart ID: ${issue.cart.cartId} has ${issue.childItems.length} orphaned children\n`;
            issue.childItems.forEach(child => {
                output += `  * Child ID: ${child.cartItemId}, Parent ID: ${child.parentItemId}, Product ID: ${child.productId}\n`;
            });
        });
    }
    return output;
}
async function main() {
    console.log('Starting individual cart structure analysis...');
    try {
        const report = await analyzeIndividualCartStructure();
        const reportText = generateReport(report);
        // Write report to file
        const reportsDir = path.join(process.cwd(), 'analysis-reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportsDir, `individual-cart-analysis-${timestamp}.txt`);
        fs.writeFileSync(reportPath, reportText);
        console.log(reportText);
        console.log(`\nFull report saved to: ${reportPath}`);
        // Also save raw data for further analysis
        const jsonPath = path.join(reportsDir, `individual-cart-analysis-data-${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
        console.log(`Raw data saved to: ${jsonPath}`);
    }
    catch (error) {
        console.error('FATAL ERROR during analysis:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}
// Run if this script is executed directly
if (require.main === module) {
    main();
}
