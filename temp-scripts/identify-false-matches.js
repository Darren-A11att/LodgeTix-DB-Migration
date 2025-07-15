"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var mongodb_1 = require("mongodb");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
function identifyFalseMatches() {
    return __awaiter(this, void 0, void 0, function () {
        var client, db, payments, registrations, matchedPayments, falseMatches, validMatches, missingRegistrations, _i, matchedPayments_1, payment, paymentIdValue, registration, paymentIdFound, error_1, byMethod_1, timestamp, outputDir, outputPath, report;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    client = new mongodb_1.MongoClient('mongodb://localhost:27017');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, , 10, 12]);
                    return [4 /*yield*/, client.connect()];
                case 2:
                    _d.sent();
                    db = client.db('lodgetix-reconcile');
                    payments = db.collection('payments');
                    registrations = db.collection('registrations');
                    console.log('🔍 Identifying false payment matches...\n');
                    return [4 /*yield*/, payments.find({
                            matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
                        }).toArray()];
                case 3:
                    matchedPayments = _d.sent();
                    console.log("Found ".concat(matchedPayments.length, " matched payments to verify\n"));
                    falseMatches = [];
                    validMatches = 0;
                    missingRegistrations = 0;
                    _i = 0, matchedPayments_1 = matchedPayments;
                    _d.label = 4;
                case 4:
                    if (!(_i < matchedPayments_1.length)) return [3 /*break*/, 9];
                    payment = matchedPayments_1[_i];
                    paymentIdValue = payment.paymentId || payment.transactionId;
                    if (!paymentIdValue) {
                        console.log("\u26A0\uFE0F  Payment ".concat(payment._id, " has no payment ID"));
                        return [3 /*break*/, 8];
                    }
                    _d.label = 5;
                case 5:
                    _d.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, registrations.findOne({
                            _id: new mongodb_1.ObjectId(payment.matchedRegistrationId)
                        })];
                case 6:
                    registration = _d.sent();
                    if (!registration) {
                        missingRegistrations++;
                        falseMatches.push({
                            paymentId: payment._id.toString(),
                            paymentIdValue: paymentIdValue,
                            registrationId: payment.matchedRegistrationId,
                            matchMethod: payment.matchMethod || 'unknown',
                            matchConfidence: payment.matchConfidence || 0,
                            issue: 'Registration not found',
                            paymentDetails: {
                                source: payment.source || 'unknown',
                                amount: payment.grossAmount || payment.amount || 0,
                                timestamp: payment.timestamp || payment.createdAt || '',
                                customerName: payment.customerName || ((_a = payment.originalData) === null || _a === void 0 ? void 0 : _a['Customer Name']),
                                transactionId: payment.transactionId
                            },
                            registrationDetails: {
                            // Registration doesn't exist
                            }
                        });
                        return [3 /*break*/, 8];
                    }
                    paymentIdFound = searchForPaymentId(registration, paymentIdValue);
                    if (!paymentIdFound) {
                        // This is a false match - payment ID not found in registration
                        falseMatches.push({
                            paymentId: payment._id.toString(),
                            paymentIdValue: paymentIdValue,
                            registrationId: registration._id.toString(),
                            matchMethod: payment.matchMethod || 'unknown',
                            matchConfidence: payment.matchConfidence || 0,
                            issue: "Payment ID \"".concat(paymentIdValue, "\" not found in registration"),
                            paymentDetails: {
                                source: payment.source || 'unknown',
                                amount: payment.grossAmount || payment.amount || 0,
                                timestamp: payment.timestamp || payment.createdAt || '',
                                customerName: payment.customerName || ((_b = payment.originalData) === null || _b === void 0 ? void 0 : _b['Customer Name']),
                                transactionId: payment.transactionId
                            },
                            registrationDetails: {
                                stripePaymentIntentId: registration.stripePaymentIntentId,
                                squarePaymentId: registration.squarePaymentId,
                                confirmationNumber: registration.confirmationNumber,
                                registrationType: registration.registrationType,
                                totalAmount: ((_c = registration.totalAmountPaid) === null || _c === void 0 ? void 0 : _c.$numberDecimal) ?
                                    parseFloat(registration.totalAmountPaid.$numberDecimal) :
                                    registration.totalAmountPaid,
                                createdAt: registration.createdAt
                            }
                        });
                        console.log("\u274C FALSE MATCH FOUND:");
                        console.log("   Payment: ".concat(payment._id));
                        console.log("   Payment ID: ".concat(paymentIdValue));
                        console.log("   Registration: ".concat(registration._id));
                        console.log("   Registration has:");
                        console.log("     - stripePaymentIntentId: ".concat(registration.stripePaymentIntentId || 'null'));
                        console.log("     - squarePaymentId: ".concat(registration.squarePaymentId || 'null'));
                        console.log("   Match Method: ".concat(payment.matchMethod || 'unknown'));
                        console.log("   Match Confidence: ".concat(payment.matchConfidence || 'N/A', "%"));
                        console.log('');
                    }
                    else {
                        validMatches++;
                    }
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _d.sent();
                    console.error("Error checking payment ".concat(payment._id, ":"), error_1);
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9:
                    // Summary
                    console.log('\n' + '='.repeat(80));
                    console.log('SUMMARY');
                    console.log('='.repeat(80));
                    console.log("Total matched payments checked: ".concat(matchedPayments.length));
                    console.log("\u2705 Valid matches: ".concat(validMatches));
                    console.log("\u274C False matches: ".concat(falseMatches.length));
                    console.log("\u26A0\uFE0F  Missing registrations: ".concat(missingRegistrations));
                    if (falseMatches.length > 0) {
                        console.log('\n' + '='.repeat(80));
                        console.log('FALSE MATCHES DETAIL');
                        console.log('='.repeat(80));
                        byMethod_1 = {};
                        falseMatches.forEach(function (fm) {
                            byMethod_1[fm.matchMethod] = (byMethod_1[fm.matchMethod] || 0) + 1;
                        });
                        console.log('\nBy Match Method:');
                        Object.entries(byMethod_1).forEach(function (_a) {
                            var method = _a[0], count = _a[1];
                            console.log("  ".concat(method, ": ").concat(count));
                        });
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        outputDir = path.join(process.cwd(), 'payment-match-reports');
                        // Create directory if it doesn't exist
                        if (!fs.existsSync(outputDir)) {
                            fs.mkdirSync(outputDir, { recursive: true });
                        }
                        outputPath = path.join(outputDir, "false-matches-".concat(timestamp, ".json"));
                        report = {
                            generatedAt: new Date().toISOString(),
                            summary: {
                                totalChecked: matchedPayments.length,
                                validMatches: validMatches,
                                falseMatches: falseMatches.length,
                                missingRegistrations: missingRegistrations,
                                byMatchMethod: byMethod_1
                            },
                            falseMatches: falseMatches
                        };
                        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
                        console.log("\n\uD83D\uDCC4 Detailed report saved to: ".concat(outputPath));
                    }
                    return [3 /*break*/, 12];
                case 10: return [4 /*yield*/, client.close()];
                case 11:
                    _d.sent();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// Recursively search for payment ID in registration object
function searchForPaymentId(obj, paymentId, visited) {
    if (visited === void 0) { visited = new Set(); }
    // Avoid circular references
    if (visited.has(obj))
        return false;
    if (typeof obj === 'object' && obj !== null) {
        visited.add(obj);
    }
    // Direct value check
    if (obj === paymentId)
        return true;
    // If not an object, no need to search further
    if (typeof obj !== 'object' || obj === null)
        return false;
    // Search in all properties
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Skip MongoDB ObjectId objects
            if (mongodb_1.ObjectId.isValid(obj[key]) && typeof obj[key] === 'object') {
                continue;
            }
            if (searchForPaymentId(obj[key], paymentId, visited)) {
                return true;
            }
        }
    }
    return false;
}
// Run the script
identifyFalseMatches().catch(console.error);
