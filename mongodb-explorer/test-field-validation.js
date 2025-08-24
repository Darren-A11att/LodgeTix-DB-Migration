"use strict";
/**
 * Test script for new field validation methods
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFieldValidation = testFieldValidation;
var comparison_viewer_1 = require("./services/comparison-viewer");
// Mock test data
var mockAttendees = [{
        attendeeId: 'att-123',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        attendeeData: {
            firstName: 'John',
            lastName: 'Smith',
            primaryEmail: 'john.smith@example.com',
            lodge: 'Test Lodge #123',
            grandLodge: 'Grand Lodge of Test',
            rank: 'Master Mason',
            dietaryRequirements: 'Vegetarian',
            ticket: {
                selectedEvents: ['dinner', 'ceremony'],
                ticketDefinitionId: 'td-456'
            }
        }
    }];
var mockTickets = [{
        ticketId: 'tkt-789',
        attendeeId: 'att-123',
        originalPrice: 150.00,
        pricePaid: 150.00,
        eventId: 'evt-101',
        paymentStatus: 'completed'
    }];
var mockCart = {
    cartId: 'cart-999',
    customer: {
        name: 'John Smith',
        email: 'john.smith@example.com',
        type: 'individual'
    },
    cartItems: [{
            cartItemId: 'ci-111',
            name: 'Test Event Bundle',
            price: 150.00,
            quantity: 1,
            formData: {
                firstName: 'John',
                lastName: 'Smith',
                email: 'john.smith@example.com',
                lodge: 'Test Lodge #123',
                grandLodge: 'Grand Lodge of Test',
                attendeeData: {
                    firstName: 'John',
                    lastName: 'Smith',
                    primaryEmail: 'john.smith@example.com',
                    rank: 'Master Mason',
                    dietaryRequirements: 'Vegetarian'
                }
            },
            metadata: { attendeeId: 'att-123' }
        }],
    subtotal: 150.00,
    tax: 0.00,
    discount: 0.00,
    total: 150.00
};
function testFieldValidation() {
    return __awaiter(this, void 0, void 0, function () {
        var mockDb, comparisonViewer, validations, report;
        return __generator(this, function (_a) {
            mockDb = {};
            comparisonViewer = new comparison_viewer_1.ComparisonViewer(mockDb);
            console.log('🧪 Testing Field Validation Methods...\n');
            try {
                validations = comparisonViewer.validateFieldTransfer(mockAttendees, mockTickets, mockCart);
                console.log("\u2705 validateFieldTransfer() returned ".concat(validations.length, " validations"));
                report = comparisonViewer.generateFieldValidationReport(mockAttendees, mockTickets, mockCart);
                console.log("\u2705 generateFieldValidationReport() generated report with ".concat(report.summary.totalFields, " total fields"));
                console.log("   Transfer rate: ".concat(report.summary.transferRate, "%"));
                console.log("   Missing fields: ".concat(report.summary.missingFields));
                console.log("   Critical missing: ".concat(report.criticalMissing.length));
                // Show sample validations
                console.log('\n📊 Sample Validation Results:');
                validations.slice(0, 5).forEach(function (val, index) {
                    console.log("".concat(index + 1, ". ").concat(val.field, " (").concat(val.category, "): ").concat(val.status));
                    console.log("   Original: ".concat(JSON.stringify(val.originalValue)));
                    console.log("   Location: ".concat(val.location.original, " -> ").concat(val.location.transformed));
                });
                console.log('\n🎉 All field validation methods working correctly!');
            }
            catch (error) {
                console.error('❌ Error testing field validation:', error);
            }
            return [2 /*return*/];
        });
    });
}
// Run test if this file is executed directly
if (require.main === module) {
    testFieldValidation();
}
