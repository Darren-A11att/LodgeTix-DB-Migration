"use strict";
/**
 * Registration to Cart Comparison Viewer
 * Provides visual comparison between original registration and transformed cart
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComparisonViewer = void 0;
var fs = require("fs");
var path = require("path");
var ComparisonViewer = /** @class */ (function () {
    function ComparisonViewer(db) {
        this.db = db;
    }
    /**
     * Compare a registration with its transformed cart
     */
    ComparisonViewer.prototype.compareRegistrationToCart = function (registrationId) {
        return __awaiter(this, void 0, void 0, function () {
            var registration, cart, attendees, tickets, CartValidationService, validationService, validation, comparison;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.collection('registrations').findOne({ registrationId: registrationId })];
                    case 1:
                        registration = _a.sent();
                        if (!registration) {
                            console.error("Registration ".concat(registrationId, " not found"));
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.db.collection('carts').findOne({
                                'cartItems.metadata.registrationId': registrationId
                            })];
                    case 2:
                        cart = _a.sent();
                        if (!cart) {
                            console.error("Cart for registration ".concat(registrationId, " not found"));
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.db.collection('attendees')
                                .find({ registrationId: registrationId })
                                .toArray()];
                    case 3:
                        attendees = _a.sent();
                        return [4 /*yield*/, this.db.collection('tickets')
                                .find({ registrationId: registrationId })
                                .toArray()];
                    case 4:
                        tickets = _a.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('./cart-validation-service'); })];
                    case 5:
                        CartValidationService = (_a.sent()).CartValidationService;
                        validationService = new CartValidationService();
                        validation = validationService.validateCart(cart);
                        comparison = {
                            registrationId: registrationId,
                            registrationType: registration.registrationType || 'unknown',
                            original: {
                                registration: registration,
                                attendees: attendees,
                                tickets: tickets
                            },
                            transformed: {
                                cart: cart,
                                validation: validation
                            },
                            mapping: this.createMapping(registration, attendees, tickets, cart),
                            differences: this.findDifferences(registration, attendees, tickets, cart)
                        };
                        return [2 /*return*/, comparison];
                }
            });
        });
    };
    /**
     * Create field mapping between registration and cart
     */
    ComparisonViewer.prototype.createMapping = function (registration, attendees, tickets, cart) {
        // Customer mapping
        var customerMapping = this.mapCustomer(registration, cart);
        // Item mapping
        var itemMappings = this.mapItems(registration, attendees, tickets, cart);
        // Pricing mapping
        var pricingMapping = this.mapPricing(registration, tickets, cart);
        return {
            customer: customerMapping,
            items: itemMappings,
            pricing: pricingMapping
        };
    };
    /**
     * Map customer fields
     */
    ComparisonViewer.prototype.mapCustomer = function (registration, cart) {
        var bookingContact = registration.bookingContact || {};
        var customer = cart.customer;
        var fields = [
            {
                from: 'bookingContact.email',
                to: 'customer.email',
                originalValue: bookingContact.email,
                transformedValue: customer === null || customer === void 0 ? void 0 : customer.email,
                status: (bookingContact.email === (customer === null || customer === void 0 ? void 0 : customer.email) ? 'matched' : 'transformed')
            },
            {
                from: 'bookingContact.firstName + lastName',
                to: 'customer.name',
                originalValue: "".concat(bookingContact.firstName || '', " ").concat(bookingContact.lastName || '').trim(),
                transformedValue: customer === null || customer === void 0 ? void 0 : customer.name,
                status: 'transformed'
            },
            {
                from: 'bookingContact.businessName',
                to: 'customer.type',
                originalValue: bookingContact.businessName,
                transformedValue: customer === null || customer === void 0 ? void 0 : customer.type,
                status: (bookingContact.businessName ? 'transformed' : 'matched')
            }
        ];
        return {
            source: 'bookingContact',
            fields: fields
        };
    };
    /**
     * Map cart items
     */
    ComparisonViewer.prototype.mapItems = function (registration, attendees, tickets, cart) {
        var _this = this;
        var mappings = [];
        // Map bundle items
        var bundleItems = cart.cartItems.filter(function (item) { return !item.parentItemId; });
        bundleItems.forEach(function (bundleItem) {
            var attendeeMatch = attendees.find(function (a) { var _a; return a.attendeeId === ((_a = bundleItem.formData) === null || _a === void 0 ? void 0 : _a.attendeeId); });
            var mapping = {
                type: 'bundle',
                sourceId: (attendeeMatch === null || attendeeMatch === void 0 ? void 0 : attendeeMatch.attendeeId) || 'organization',
                cartItemId: bundleItem.cartItemId,
                quantity: {
                    original: registration.registrationType === 'individual' ? 1 : attendees.length,
                    transformed: bundleItem.quantity
                },
                price: {
                    original: 0, // Original didn't have bundle pricing
                    transformed: bundleItem.price
                },
                formData: _this.compareFormData(attendeeMatch || registration, bundleItem.formData)
            };
            mappings.push(mapping);
        });
        // Map event items
        var eventItems = cart.cartItems.filter(function (item) { return item.parentItemId; });
        eventItems.forEach(function (eventItem) {
            var ticketMatch = tickets.find(function (t) { var _a; return t.ticketId === ((_a = eventItem.metadata) === null || _a === void 0 ? void 0 : _a.ticketId); });
            if (ticketMatch) {
                var mapping = {
                    type: 'event',
                    sourceId: ticketMatch.ticketId,
                    cartItemId: eventItem.cartItemId,
                    quantity: {
                        original: 1,
                        transformed: eventItem.quantity
                    },
                    price: {
                        original: ticketMatch.price || 0,
                        transformed: eventItem.price
                    },
                    formData: { added: [], missing: [], matched: [] }
                };
                mappings.push(mapping);
            }
        });
        return mappings;
    };
    /**
     * Compare formData fields
     */
    ComparisonViewer.prototype.compareFormData = function (original, formData) {
        var originalKeys = new Set(Object.keys(original || {}));
        var formDataKeys = new Set(Object.keys(formData || {}));
        var added = Array.from(formDataKeys).filter(function (k) { return !originalKeys.has(k); });
        var missing = Array.from(originalKeys).filter(function (k) { return !formDataKeys.has(k); });
        var matched = Array.from(originalKeys).filter(function (k) { return formDataKeys.has(k); });
        return { added: added, missing: missing, matched: matched };
    };
    /**
     * Map pricing information
     */
    ComparisonViewer.prototype.mapPricing = function (registration, tickets, cart) {
        var originalTotal = tickets.reduce(function (sum, t) { return sum + (t.price || 0); }, 0);
        return {
            originalTotal: originalTotal,
            transformedTotal: cart.total,
            difference: cart.total - originalTotal,
            breakdown: {
                subtotal: {
                    original: originalTotal,
                    transformed: cart.subtotal
                },
                tax: {
                    original: 0,
                    transformed: cart.tax
                },
                discount: {
                    original: 0,
                    transformed: cart.discount
                }
            }
        };
    };
    /**
     * Find differences between registration and cart
     */
    ComparisonViewer.prototype.findDifferences = function (registration, attendees, tickets, cart) {
        var differences = [];
        // Structure changes
        differences.push({
            field: 'structure',
            type: 'restructured',
            description: 'Registration transformed to e-commerce cart structure',
            original: 'registration + attendees + tickets',
            transformed: 'cart + customer + cartItems'
        });
        // Customer creation
        differences.push({
            field: 'customer',
            type: 'added',
            description: 'Customer object created from bookingContact',
            transformed: cart.customer
        });
        // Bundle items
        var bundleCount = cart.cartItems.filter(function (i) { return !i.parentItemId; }).length;
        differences.push({
            field: 'bundleItems',
            type: 'added',
            description: "".concat(bundleCount, " bundle item(s) created"),
            original: 0,
            transformed: bundleCount
        });
        // FormData
        if (registration.registrationType === 'individual') {
            differences.push({
                field: 'formData',
                type: 'restructured',
                description: 'Attendee data moved to bundle item formData',
                original: "".concat(attendees.length, " separate attendee records"),
                transformed: "".concat(bundleCount, " bundle items with formData")
            });
        }
        else {
            differences.push({
                field: 'formData',
                type: 'restructured',
                description: 'Organization details moved to single bundle formData',
                original: 'Separate organization fields',
                transformed: 'Consolidated in bundle formData'
            });
        }
        // Pricing
        if (cart.total !== tickets.reduce(function (sum, t) { return sum + (t.price || 0); }, 0)) {
            differences.push({
                field: 'pricing',
                type: 'modified',
                description: 'Pricing structure changed',
                original: tickets.reduce(function (sum, t) { return sum + (t.price || 0); }, 0),
                transformed: cart.total
            });
        }
        return differences;
    };
    /**
     * Generate console output for comparison
     */
    ComparisonViewer.prototype.formatConsoleOutput = function (comparison) {
        var lines = [];
        lines.push('\n' + '='.repeat(80));
        lines.push("REGISTRATION TO CART COMPARISON");
        lines.push('='.repeat(80));
        // Header
        lines.push("\nRegistration ID: ".concat(comparison.registrationId));
        lines.push("Type: ".concat(comparison.registrationType));
        lines.push("Cart ID: ".concat(comparison.transformed.cart.cartId));
        lines.push("Validation: ".concat(comparison.transformed.validation.valid ? '✅ Valid' : '❌ Invalid'));
        // Customer Mapping
        lines.push('\n' + '-'.repeat(40));
        lines.push('CUSTOMER MAPPING');
        lines.push('-'.repeat(40));
        comparison.mapping.customer.fields.forEach(function (field) {
            var status = field.status === 'matched' ? '✓' : '→';
            lines.push("".concat(status, " ").concat(field.from, " => ").concat(field.to));
            if (field.originalValue !== field.transformedValue) {
                lines.push("  Original: ".concat(field.originalValue));
                lines.push("  Transformed: ".concat(field.transformedValue));
            }
        });
        // Item Mapping
        lines.push('\n' + '-'.repeat(40));
        lines.push('ITEM MAPPING');
        lines.push('-'.repeat(40));
        comparison.mapping.items.forEach(function (item) {
            lines.push("\n".concat(item.type.toUpperCase(), " Item:"));
            lines.push("  Source: ".concat(item.sourceId));
            lines.push("  Cart Item: ".concat(item.cartItemId));
            lines.push("  Quantity: ".concat(item.quantity.original, " \u2192 ").concat(item.quantity.transformed));
            lines.push("  Price: $".concat(item.price.original, " \u2192 $").concat(item.price.transformed));
            if (item.formData.matched.length > 0) {
                lines.push("  FormData: ".concat(item.formData.matched.length, " fields matched"));
            }
            if (item.formData.added.length > 0) {
                lines.push("  Added: ".concat(item.formData.added.join(', ')));
            }
            if (item.formData.missing.length > 0) {
                lines.push("  Missing: ".concat(item.formData.missing.join(', ')));
            }
        });
        // Pricing
        lines.push('\n' + '-'.repeat(40));
        lines.push('PRICING');
        lines.push('-'.repeat(40));
        lines.push("Original Total: $".concat(comparison.mapping.pricing.originalTotal));
        lines.push("Transformed Total: $".concat(comparison.mapping.pricing.transformedTotal));
        if (comparison.mapping.pricing.difference !== 0) {
            lines.push("Difference: $".concat(comparison.mapping.pricing.difference));
        }
        // Differences
        lines.push('\n' + '-'.repeat(40));
        lines.push('KEY DIFFERENCES');
        lines.push('-'.repeat(40));
        comparison.differences.forEach(function (diff) {
            lines.push("\n".concat(diff.type.toUpperCase(), ": ").concat(diff.field));
            lines.push("  ".concat(diff.description));
        });
        // Validation Issues
        if (!comparison.transformed.validation.valid) {
            lines.push('\n' + '-'.repeat(40));
            lines.push('VALIDATION ISSUES');
            lines.push('-'.repeat(40));
            comparison.transformed.validation.errors.forEach(function (error) {
                lines.push("\u274C ".concat(error.field, ": ").concat(error.message));
            });
            comparison.transformed.validation.warnings.forEach(function (warning) {
                lines.push("\u26A0\uFE0F ".concat(warning.field, ": ").concat(warning.message));
            });
        }
        lines.push('\n' + '='.repeat(80));
        return lines.join('\n');
    };
    /**
     * Generate HTML report for comparison
     */
    ComparisonViewer.prototype.generateHTMLReport = function (comparison) {
        var html = "\n<!DOCTYPE html>\n<html>\n<head>\n  <title>Registration to Cart Comparison - ".concat(comparison.registrationId, "</title>\n  <style>\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n      line-height: 1.6;\n      margin: 0;\n      padding: 20px;\n      background: #f5f5f5;\n    }\n    .container {\n      max-width: 1400px;\n      margin: 0 auto;\n      background: white;\n      border-radius: 8px;\n      box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n      padding: 30px;\n    }\n    h1 {\n      color: #333;\n      border-bottom: 3px solid #4CAF50;\n      padding-bottom: 10px;\n    }\n    h2 {\n      color: #555;\n      margin-top: 30px;\n      border-bottom: 1px solid #ddd;\n      padding-bottom: 5px;\n    }\n    .header-info {\n      background: #f8f9fa;\n      padding: 15px;\n      border-radius: 5px;\n      margin-bottom: 20px;\n    }\n    .status {\n      display: inline-block;\n      padding: 3px 10px;\n      border-radius: 3px;\n      font-weight: bold;\n    }\n    .status.valid {\n      background: #d4edda;\n      color: #155724;\n    }\n    .status.invalid {\n      background: #f8d7da;\n      color: #721c24;\n    }\n    .comparison-grid {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 20px;\n      margin: 20px 0;\n    }\n    .panel {\n      border: 1px solid #ddd;\n      border-radius: 5px;\n      padding: 15px;\n    }\n    .panel h3 {\n      margin-top: 0;\n      color: #666;\n      font-size: 14px;\n      text-transform: uppercase;\n      letter-spacing: 1px;\n    }\n    .original {\n      background: #fff3cd;\n    }\n    .transformed {\n      background: #d1ecf1;\n    }\n    .mapping-table {\n      width: 100%;\n      border-collapse: collapse;\n      margin: 15px 0;\n    }\n    .mapping-table th,\n    .mapping-table td {\n      padding: 10px;\n      text-align: left;\n      border-bottom: 1px solid #ddd;\n    }\n    .mapping-table th {\n      background: #f8f9fa;\n      font-weight: 600;\n    }\n    .field-match {\n      color: #28a745;\n    }\n    .field-transform {\n      color: #ffc107;\n    }\n    .field-missing {\n      color: #dc3545;\n    }\n    .difference {\n      margin: 10px 0;\n      padding: 10px;\n      border-left: 4px solid #17a2b8;\n      background: #f8f9fa;\n    }\n    .difference.added {\n      border-color: #28a745;\n    }\n    .difference.removed {\n      border-color: #dc3545;\n    }\n    .difference.modified {\n      border-color: #ffc107;\n    }\n    .difference.restructured {\n      border-color: #17a2b8;\n    }\n    .json-view {\n      background: #f4f4f4;\n      padding: 10px;\n      border-radius: 3px;\n      overflow-x: auto;\n      font-family: 'Courier New', monospace;\n      font-size: 12px;\n      max-height: 400px;\n      overflow-y: auto;\n    }\n    .validation-issues {\n      margin: 15px 0;\n    }\n    .validation-error {\n      color: #dc3545;\n      margin: 5px 0;\n    }\n    .validation-warning {\n      color: #ffc107;\n      margin: 5px 0;\n    }\n    .price-comparison {\n      display: grid;\n      grid-template-columns: repeat(3, 1fr);\n      gap: 15px;\n      margin: 20px 0;\n    }\n    .price-box {\n      text-align: center;\n      padding: 15px;\n      background: #f8f9fa;\n      border-radius: 5px;\n    }\n    .price-label {\n      font-size: 12px;\n      color: #666;\n      text-transform: uppercase;\n    }\n    .price-value {\n      font-size: 24px;\n      font-weight: bold;\n      color: #333;\n      margin-top: 5px;\n    }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <h1>Registration to Cart Comparison</h1>\n    \n    <div class=\"header-info\">\n      <div><strong>Registration ID:</strong> ").concat(comparison.registrationId, "</div>\n      <div><strong>Type:</strong> ").concat(comparison.registrationType, "</div>\n      <div><strong>Cart ID:</strong> ").concat(comparison.transformed.cart.cartId, "</div>\n      <div><strong>Validation Status:</strong> \n        <span class=\"status ").concat(comparison.transformed.validation.valid ? 'valid' : 'invalid', "\">\n          ").concat(comparison.transformed.validation.valid ? '✓ Valid' : '✗ Invalid', "\n        </span>\n      </div>\n    </div>\n\n    <h2>Customer Mapping</h2>\n    <table class=\"mapping-table\">\n      <thead>\n        <tr>\n          <th>Original Field</th>\n          <th>Cart Field</th>\n          <th>Original Value</th>\n          <th>Transformed Value</th>\n          <th>Status</th>\n        </tr>\n      </thead>\n      <tbody>\n        ").concat(comparison.mapping.customer.fields.map(function (field) { return "\n          <tr>\n            <td>".concat(field.from, "</td>\n            <td>").concat(field.to, "</td>\n            <td>").concat(field.originalValue || '-', "</td>\n            <td>").concat(field.transformedValue || '-', "</td>\n            <td class=\"field-").concat(field.status, "\">").concat(field.status, "</td>\n          </tr>\n        "); }).join(''), "\n      </tbody>\n    </table>\n\n    <h2>Pricing Comparison</h2>\n    <div class=\"price-comparison\">\n      <div class=\"price-box\">\n        <div class=\"price-label\">Original Total</div>\n        <div class=\"price-value\">$").concat(comparison.mapping.pricing.originalTotal.toFixed(2), "</div>\n      </div>\n      <div class=\"price-box\">\n        <div class=\"price-label\">Transformed Total</div>\n        <div class=\"price-value\">$").concat(comparison.mapping.pricing.transformedTotal.toFixed(2), "</div>\n      </div>\n      <div class=\"price-box\">\n        <div class=\"price-label\">Difference</div>\n        <div class=\"price-value\">$").concat(comparison.mapping.pricing.difference.toFixed(2), "</div>\n      </div>\n    </div>\n\n    <h2>Structure Comparison</h2>\n    <div class=\"comparison-grid\">\n      <div class=\"panel original\">\n        <h3>Original Registration</h3>\n        <div class=\"json-view\">\n          <pre>").concat(JSON.stringify({
            registrationId: comparison.original.registration.registrationId,
            type: comparison.original.registration.registrationType,
            attendees: comparison.original.attendees.length,
            tickets: comparison.original.tickets.length,
            bookingContact: comparison.original.registration.bookingContact
        }, null, 2), "</pre>\n        </div>\n      </div>\n      <div class=\"panel transformed\">\n        <h3>Transformed Cart</h3>\n        <div class=\"json-view\">\n          <pre>").concat(JSON.stringify({
            cartId: comparison.transformed.cart.cartId,
            customer: comparison.transformed.cart.customer,
            bundleItems: comparison.transformed.cart.cartItems.filter(function (i) { return !i.parentItemId; }).length,
            eventItems: comparison.transformed.cart.cartItems.filter(function (i) { return i.parentItemId; }).length,
            total: comparison.transformed.cart.total
        }, null, 2), "</pre>\n        </div>\n      </div>\n    </div>\n\n    <h2>Key Differences</h2>\n    ").concat(comparison.differences.map(function (diff) { return "\n      <div class=\"difference ".concat(diff.type, "\">\n        <strong>").concat(diff.field, "</strong> (").concat(diff.type, ")\n        <br>").concat(diff.description, "\n        ").concat(diff.original ? "<br>Original: ".concat(JSON.stringify(diff.original)) : '', "\n        ").concat(diff.transformed ? "<br>Transformed: ".concat(JSON.stringify(diff.transformed)) : '', "\n      </div>\n    "); }).join(''), "\n\n    ").concat(!comparison.transformed.validation.valid ? "\n      <h2>Validation Issues</h2>\n      <div class=\"validation-issues\">\n        ".concat(comparison.transformed.validation.errors.map(function (error) { return "\n          <div class=\"validation-error\">\u274C ".concat(error.field, ": ").concat(error.message, "</div>\n        "); }).join(''), "\n        ").concat(comparison.transformed.validation.warnings.map(function (warning) { return "\n          <div class=\"validation-warning\">\u26A0\uFE0F ".concat(warning.field, ": ").concat(warning.message, "</div>\n        "); }).join(''), "\n      </div>\n    ") : '', "\n\n    <h2>Item Mappings</h2>\n    <table class=\"mapping-table\">\n      <thead>\n        <tr>\n          <th>Type</th>\n          <th>Source ID</th>\n          <th>Cart Item ID</th>\n          <th>Quantity</th>\n          <th>Price</th>\n          <th>FormData Status</th>\n        </tr>\n      </thead>\n      <tbody>\n        ").concat(comparison.mapping.items.map(function (item) { return "\n          <tr>\n            <td>".concat(item.type, "</td>\n            <td>").concat(item.sourceId, "</td>\n            <td>").concat(item.cartItemId, "</td>\n            <td>").concat(item.quantity.original, " \u2192 ").concat(item.quantity.transformed, "</td>\n            <td>$").concat(item.price.original, " \u2192 $").concat(item.price.transformed, "</td>\n            <td>\n              ").concat(item.formData.matched.length, " matched\n              ").concat(item.formData.added.length > 0 ? ", ".concat(item.formData.added.length, " added") : '', "\n              ").concat(item.formData.missing.length > 0 ? ", ".concat(item.formData.missing.length, " missing") : '', "\n            </td>\n          </tr>\n        "); }).join(''), "\n      </tbody>\n    </table>\n  </div>\n</body>\n</html>\n    ");
        return html;
    };
    /**
     * Save comparison report to file
     */
    ComparisonViewer.prototype.saveComparisonReport = function (comparison_1) {
        return __awaiter(this, arguments, void 0, function (comparison, format) {
            var timestamp, dir, filename, content, filepath;
            if (format === void 0) { format = 'html'; }
            return __generator(this, function (_a) {
                timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                dir = path.join(process.cwd(), 'comparison-reports');
                // Create directory if it doesn't exist
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                switch (format) {
                    case 'json':
                        filename = "comparison-".concat(comparison.registrationId, "-").concat(timestamp, ".json");
                        content = JSON.stringify(comparison, null, 2);
                        break;
                    case 'text':
                        filename = "comparison-".concat(comparison.registrationId, "-").concat(timestamp, ".txt");
                        content = this.formatConsoleOutput(comparison);
                        break;
                    case 'html':
                    default:
                        filename = "comparison-".concat(comparison.registrationId, "-").concat(timestamp, ".html");
                        content = this.generateHTMLReport(comparison);
                        break;
                }
                filepath = path.join(dir, filename);
                fs.writeFileSync(filepath, content, 'utf8');
                return [2 /*return*/, filepath];
            });
        });
    };
    /**
     * Compare multiple registrations
     */
    ComparisonViewer.prototype.compareMultiple = function (registrationIds_1) {
        return __awaiter(this, arguments, void 0, function (registrationIds, saveReports) {
            var comparisons, _i, registrationIds_2, id, comparison, filepath;
            if (saveReports === void 0) { saveReports = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        comparisons = [];
                        _i = 0, registrationIds_2 = registrationIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < registrationIds_2.length)) return [3 /*break*/, 5];
                        id = registrationIds_2[_i];
                        console.log("\nComparing registration ".concat(id, "..."));
                        return [4 /*yield*/, this.compareRegistrationToCart(id)];
                    case 2:
                        comparison = _a.sent();
                        if (!comparison) return [3 /*break*/, 4];
                        comparisons.push(comparison);
                        // Display in console
                        console.log(this.formatConsoleOutput(comparison));
                        if (!saveReports) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.saveComparisonReport(comparison)];
                    case 3:
                        filepath = _a.sent();
                        console.log("Report saved: ".concat(filepath));
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [2 /*return*/, comparisons];
                }
            });
        });
    };
    /**
     * Validate field-by-field transfer from attendees and tickets to cart
     */
    ComparisonViewer.prototype.validateFieldTransfer = function (attendees, tickets, cart) {
        var _this = this;
        var validations = [];
        // Load field analysis data for comprehensive validation
        var fieldAnalysis = this.getFieldAnalysisData();
        // Validate attendee fields
        attendees.forEach(function (attendee, index) {
            // Root level attendee fields
            var rootFields = fieldAnalysis.fieldMappings.attendeeOnlyFields.fields.rootLevel || [];
            rootFields.forEach(function (field) {
                var validation = _this.validateSingleField(field, attendee[field], cart, "attendees[".concat(index, "].").concat(field), 'personalInformation');
                if (validation)
                    validations.push(validation);
            });
            // Nested attendeeData fields
            if (attendee.attendeeData) {
                var nestedFields = Object.keys(fieldAnalysis.fieldMappings.attendeeOnlyFields.fields.nested_attendeeData || {});
                nestedFields.forEach(function (field) {
                    var validation = _this.validateSingleField("attendeeData.".concat(field), attendee.attendeeData[field], cart, "attendees[".concat(index, "].attendeeData.").concat(field), _this.getFieldCategory(field, fieldAnalysis));
                    if (validation)
                        validations.push(validation);
                });
                // Handle deeply nested ticket data
                if (attendee.attendeeData.ticket) {
                    Object.keys(attendee.attendeeData.ticket).forEach(function (field) {
                        var validation = _this.validateSingleField("attendeeData.ticket.".concat(field), attendee.attendeeData.ticket[field], cart, "attendees[".concat(index, "].attendeeData.ticket.").concat(field), 'eventInformation');
                        if (validation)
                            validations.push(validation);
                    });
                }
            }
        });
        // Validate ticket fields
        tickets.forEach(function (ticket, index) {
            var ticketFields = fieldAnalysis.fieldMappings.ticketOnlyFields.fields || [];
            ticketFields.forEach(function (field) {
                var validation = _this.validateSingleField(field, ticket[field], cart, "tickets[".concat(index, "].").concat(field), _this.getFieldCategory(field, fieldAnalysis));
                if (validation)
                    validations.push(validation);
            });
        });
        return validations;
    };
    /**
     * Validate a single field transfer
     */
    ComparisonViewer.prototype.validateSingleField = function (fieldName, originalValue, cart, originalLocation, category) {
        if (originalValue === undefined || originalValue === null || originalValue === '') {
            return null; // Skip empty values
        }
        // Search for the value in cart structure
        var transformedLocation = this.findFieldInCart(fieldName, originalValue, cart);
        var status;
        var transformedValue = null;
        var severity = 'low';
        if (transformedLocation.found) {
            if (transformedLocation.exactMatch) {
                status = 'transferred';
            }
            else {
                status = 'transformed';
                transformedValue = transformedLocation.value;
            }
        }
        else {
            status = 'missing';
            // Set severity based on field importance
            if (this.isCriticalField(fieldName)) {
                severity = 'high';
            }
            else if (this.isImportantField(fieldName)) {
                severity = 'medium';
            }
        }
        return {
            field: fieldName,
            category: category,
            status: status,
            originalValue: originalValue,
            transformedValue: transformedValue || transformedLocation.value,
            location: {
                original: originalLocation,
                transformed: transformedLocation.path || 'not_found'
            },
            severity: severity
        };
    };
    /**
     * Find a field value in the cart structure
     */
    ComparisonViewer.prototype.findFieldInCart = function (fieldName, originalValue, cart) {
        var searchPaths = __spreadArray(__spreadArray(__spreadArray([
            // Customer data
            "customer.name",
            "customer.email",
            "customer.type",
            "customer.contactInfo"
        ], cart.cartItems.map(function (_, i) { return "cartItems[".concat(i, "].formData"); }), true), [
            // Cart metadata
            "metadata"
        ], false), cart.cartItems.map(function (_, i) { return "cartItems[".concat(i, "].formData.attendeeData"); }), true);
        // Search by field name mapping
        var mappedField = this.getFieldMapping(fieldName);
        // Direct value search in cart structure
        for (var _i = 0, searchPaths_1 = searchPaths; _i < searchPaths_1.length; _i++) {
            var path_1 = searchPaths_1[_i];
            var foundValue = this.getNestedValue(cart, path_1);
            if (foundValue !== undefined) {
                // Check for exact match
                if (JSON.stringify(foundValue) === JSON.stringify(originalValue)) {
                    return { found: true, exactMatch: true, value: foundValue, path: path_1 };
                }
                // Check for partial or transformed match
                if (this.isPartialMatch(originalValue, foundValue, fieldName)) {
                    return { found: true, exactMatch: false, value: foundValue, path: path_1 };
                }
            }
        }
        // Search in formData recursively
        for (var i = 0; i < cart.cartItems.length; i++) {
            var formData = cart.cartItems[i].formData || {};
            var result = this.searchInFormData(fieldName, originalValue, formData, "cartItems[".concat(i, "].formData"));
            if (result.found) {
                return result;
            }
        }
        return { found: false, exactMatch: false, value: null, path: '' };
    };
    /**
     * Search recursively in formData object
     */
    ComparisonViewer.prototype.searchInFormData = function (fieldName, originalValue, formData, basePath) {
        if (!formData || typeof formData !== 'object') {
            return { found: false, exactMatch: false, value: null, path: '' };
        }
        for (var _i = 0, _a = Object.entries(formData); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            var currentPath = "".concat(basePath, ".").concat(key);
            // Direct field name match
            if (key === fieldName || key.endsWith(".".concat(fieldName))) {
                if (JSON.stringify(value) === JSON.stringify(originalValue)) {
                    return { found: true, exactMatch: true, value: value, path: currentPath };
                }
                if (this.isPartialMatch(originalValue, value, fieldName)) {
                    return { found: true, exactMatch: false, value: value, path: currentPath };
                }
            }
            // Value match
            if (JSON.stringify(value) === JSON.stringify(originalValue)) {
                return { found: true, exactMatch: true, value: value, path: currentPath };
            }
            // Recursive search in nested objects
            if (typeof value === 'object' && value !== null) {
                var nestedResult = this.searchInFormData(fieldName, originalValue, value, currentPath);
                if (nestedResult.found) {
                    return nestedResult;
                }
            }
        }
        return { found: false, exactMatch: false, value: null, path: '' };
    };
    /**
     * Generate comprehensive field validation report
     */
    ComparisonViewer.prototype.generateFieldValidationReport = function (attendees, tickets, cart) {
        var validations = this.validateFieldTransfer(attendees, tickets, cart);
        var fieldAnalysis = this.getFieldAnalysisData();
        // Calculate summary statistics
        var attendeeValidations = validations.filter(function (v) { return v.location.original.startsWith('attendees'); });
        var ticketValidations = validations.filter(function (v) { return v.location.original.startsWith('tickets'); });
        var totalFields = validations.length;
        var transferredFields = validations.filter(function (v) { return v.status === 'transferred'; }).length;
        var missingFields = validations.filter(function (v) { return v.status === 'missing'; }).length;
        var transformedFields = validations.filter(function (v) { return v.status === 'transformed'; }).length;
        var addedFields = validations.filter(function (v) { return v.status === 'added'; }).length;
        var transferRate = totalFields > 0 ? (transferredFields + transformedFields) / totalFields * 100 : 0;
        // Category analysis
        var categories = {};
        var categoryNames = Object.keys(fieldAnalysis.fieldCategories || {});
        categoryNames.forEach(function (categoryName) {
            var categoryValidations = validations.filter(function (v) { return v.category === categoryName; });
            categories[categoryName] = {
                total: categoryValidations.length,
                transferred: categoryValidations.filter(function (v) { return v.status === 'transferred'; }).length,
                missing: categoryValidations.filter(function (v) { return v.status === 'missing'; }).length,
                transferRate: categoryValidations.length > 0 ?
                    (categoryValidations.filter(function (v) { return v.status === 'transferred' || v.status === 'transformed'; }).length / categoryValidations.length * 100) : 0
            };
        });
        // Critical missing fields
        var criticalMissing = validations.filter(function (v) { return v.status === 'missing' && v.severity === 'high'; });
        // Generate recommendations
        var recommendations = this.generateValidationRecommendations(validations, transferRate);
        return {
            summary: {
                totalFields: totalFields,
                attendeeFields: attendeeValidations.length,
                ticketFields: ticketValidations.length,
                transferredFields: transferredFields,
                missingFields: missingFields,
                transformedFields: transformedFields,
                addedFields: addedFields,
                transferRate: Math.round(transferRate * 100) / 100
            },
            details: {
                attendeeValidation: attendeeValidations,
                ticketValidation: ticketValidations
            },
            categories: categories,
            criticalMissing: criticalMissing,
            recommendations: recommendations
        };
    };
    /**
     * Get field analysis data (loaded from the JSON file)
     */
    ComparisonViewer.prototype.getFieldAnalysisData = function () {
        try {
            var analysisPath = path.join(process.cwd(), 'field-analysis-reports', 'field-transfer-analysis-2025-08-24.json');
            var data = fs.readFileSync(analysisPath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            console.warn('Could not load field analysis data:', error);
            return {
                fieldMappings: {
                    attendeeOnlyFields: { fields: { rootLevel: [], nested_attendeeData: {} } },
                    ticketOnlyFields: { fields: [] }
                },
                fieldCategories: {}
            };
        }
    };
    /**
     * Get field category from analysis data
     */
    ComparisonViewer.prototype.getFieldCategory = function (fieldName, fieldAnalysis) {
        var categories = fieldAnalysis.fieldCategories || {};
        for (var _i = 0, _a = Object.entries(categories); _i < _a.length; _i++) {
            var _b = _a[_i], categoryName = _b[0], categoryData = _b[1];
            var attendeeFields = categoryData.attendees || [];
            var ticketFields = categoryData.tickets || [];
            if (attendeeFields.includes(fieldName) || ticketFields.includes(fieldName)) {
                return categoryName;
            }
        }
        return 'uncategorized';
    };
    /**
     * Check if a field is critical for cart functionality
     */
    ComparisonViewer.prototype.isCriticalField = function (fieldName) {
        var criticalFields = [
            'firstName', 'lastName', 'email', 'attendeeId', 'registrationId',
            'attendeeData.firstName', 'attendeeData.lastName', 'attendeeData.primaryEmail',
            'ticketPrice', 'originalPrice', 'eventId', 'ticketId'
        ];
        return criticalFields.includes(fieldName);
    };
    /**
     * Check if a field is important for business logic
     */
    ComparisonViewer.prototype.isImportantField = function (fieldName) {
        var importantFields = [
            'phone', 'primaryPhone', 'dietaryRequirements', 'specialNeeds',
            'lodge', 'grandLodge', 'masonicStatus', 'paymentStatus',
            'attendeeData.lodge', 'attendeeData.grandLodge', 'attendeeData.rank'
        ];
        return importantFields.includes(fieldName);
    };
    /**
     * Check if values partially match (for transformed fields)
     */
    ComparisonViewer.prototype.isPartialMatch = function (originalValue, transformedValue, fieldName) {
        if (typeof originalValue === 'string' && typeof transformedValue === 'string') {
            // Check if transformed value contains original (e.g., firstName + lastName -> fullName)
            if (transformedValue.toLowerCase().includes(originalValue.toLowerCase())) {
                return true;
            }
            // Check if original contains transformed (e.g., fullName -> firstName)
            if (originalValue.toLowerCase().includes(transformedValue.toLowerCase())) {
                return true;
            }
        }
        // Special handling for email fields
        if (fieldName.includes('email') || fieldName.includes('Email')) {
            return originalValue === transformedValue;
        }
        return false;
    };
    /**
     * Get nested value from object using path
     */
    ComparisonViewer.prototype.getNestedValue = function (obj, path) {
        return path.split('.').reduce(function (current, key) {
            var _a;
            if (key.includes('[') && key.includes(']')) {
                var arrayKey = key.substring(0, key.indexOf('['));
                var index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                return (_a = current === null || current === void 0 ? void 0 : current[arrayKey]) === null || _a === void 0 ? void 0 : _a[index];
            }
            return current === null || current === void 0 ? void 0 : current[key];
        }, obj);
    };
    /**
     * Get field mapping for transformation
     */
    ComparisonViewer.prototype.getFieldMapping = function (fieldName) {
        var mappings = {
            'firstName': 'customer.name',
            'lastName': 'customer.name',
            'email': 'customer.email',
            'primaryEmail': 'customer.email',
            'attendeeData.firstName': 'formData.firstName',
            'attendeeData.lastName': 'formData.lastName',
            'attendeeData.primaryEmail': 'formData.email'
        };
        return mappings[fieldName] || fieldName;
    };
    /**
     * Generate validation recommendations based on results
     */
    ComparisonViewer.prototype.generateValidationRecommendations = function (validations, transferRate) {
        var recommendations = [];
        if (transferRate < 70) {
            recommendations.push('Transfer rate is below 70%. Consider reviewing field mapping logic.');
        }
        var criticalMissing = validations.filter(function (v) { return v.status === 'missing' && v.severity === 'high'; });
        if (criticalMissing.length > 0) {
            recommendations.push("".concat(criticalMissing.length, " critical fields are missing. Review: ").concat(criticalMissing.map(function (v) { return v.field; }).join(', ')));
        }
        var personalInfoMissing = validations.filter(function (v) {
            return v.category === 'personalInformation' && v.status === 'missing';
        }).length;
        if (personalInfoMissing > 3) {
            recommendations.push('Many personal information fields are missing. Verify customer data mapping.');
        }
        var masonicInfoMissing = validations.filter(function (v) {
            return v.category === 'masonicInformation' && v.status === 'missing';
        }).length;
        if (masonicInfoMissing > 5) {
            recommendations.push('Masonic information may be incompletely transferred. Check formData structure.');
        }
        var pricingMissing = validations.filter(function (v) {
            return v.category === 'pricingInformation' && v.status === 'missing';
        }).length;
        if (pricingMissing > 0) {
            recommendations.push('Pricing fields are missing. Verify cart item price calculations.');
        }
        if (recommendations.length === 0) {
            recommendations.push('Field validation looks good. All critical data appears to be transferred.');
        }
        return recommendations;
    };
    /**
     * Generate summary statistics for multiple comparisons
     */
    ComparisonViewer.prototype.generateSummaryStats = function (comparisons) {
        var stats = {
            total: comparisons.length,
            valid: comparisons.filter(function (c) { return c.transformed.validation.valid; }).length,
            invalid: comparisons.filter(function (c) { return !c.transformed.validation.valid; }).length,
            byType: {},
            pricingDifferences: [],
            commonErrors: {}
        };
        comparisons.forEach(function (comp) {
            // Count by type
            stats.byType[comp.registrationType] = (stats.byType[comp.registrationType] || 0) + 1;
            // Track pricing differences
            stats.pricingDifferences.push(comp.mapping.pricing.difference);
            // Track common errors
            comp.transformed.validation.errors.forEach(function (error) {
                stats.commonErrors[error.field] = (stats.commonErrors[error.field] || 0) + 1;
            });
        });
        console.log('\n' + '='.repeat(60));
        console.log('COMPARISON SUMMARY STATISTICS');
        console.log('='.repeat(60));
        console.log("Total Comparisons: ".concat(stats.total));
        console.log("Valid Carts: ".concat(stats.valid, " (").concat((stats.valid / stats.total * 100).toFixed(1), "%)"));
        console.log("Invalid Carts: ".concat(stats.invalid, " (").concat((stats.invalid / stats.total * 100).toFixed(1), "%)"));
        console.log('\nBy Registration Type:');
        Object.entries(stats.byType).forEach(function (_a) {
            var type = _a[0], count = _a[1];
            console.log("  ".concat(type, ": ").concat(count));
        });
        if (stats.pricingDifferences.length > 0) {
            var avgDiff = stats.pricingDifferences.reduce(function (a, b) { return a + b; }, 0) / stats.pricingDifferences.length;
            console.log("\nAverage Pricing Difference: $".concat(avgDiff.toFixed(2)));
        }
        if (Object.keys(stats.commonErrors).length > 0) {
            console.log('\nCommon Validation Errors:');
            Object.entries(stats.commonErrors)
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, 5)
                .forEach(function (_a) {
                var field = _a[0], count = _a[1];
                console.log("  ".concat(field, ": ").concat(count, " occurrences"));
            });
        }
        console.log('='.repeat(60));
    };
    /**
     * Generate detailed field validation report for a registration
     */
    ComparisonViewer.prototype.generateDetailedValidationReport = function (registrationId) {
        return __awaiter(this, void 0, void 0, function () {
            var comparison, validationReport, timestamp, reportPath, filename, filepath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.compareRegistrationToCart(registrationId)];
                    case 1:
                        comparison = _a.sent();
                        if (!comparison) {
                            console.error("Could not generate validation report for ".concat(registrationId));
                            return [2 /*return*/];
                        }
                        validationReport = this.generateFieldValidationReport(comparison.original.attendees, comparison.original.tickets, comparison.transformed.cart);
                        console.log('\n' + '='.repeat(80));
                        console.log('DETAILED FIELD VALIDATION REPORT');
                        console.log('='.repeat(80));
                        console.log("Registration ID: ".concat(registrationId));
                        console.log("Transfer Rate: ".concat(validationReport.summary.transferRate, "%"));
                        // Summary
                        console.log('\n' + '-'.repeat(40));
                        console.log('VALIDATION SUMMARY');
                        console.log('-'.repeat(40));
                        console.log("Total Fields Analyzed: ".concat(validationReport.summary.totalFields));
                        console.log("  - Attendee Fields: ".concat(validationReport.summary.attendeeFields));
                        console.log("  - Ticket Fields: ".concat(validationReport.summary.ticketFields));
                        console.log("Successfully Transferred: ".concat(validationReport.summary.transferredFields, " (").concat(Math.round((validationReport.summary.transferredFields / validationReport.summary.totalFields) * 100), "%)"));
                        console.log("Transformed Fields: ".concat(validationReport.summary.transformedFields, " (").concat(Math.round((validationReport.summary.transformedFields / validationReport.summary.totalFields) * 100), "%)"));
                        console.log("Missing Fields: ".concat(validationReport.summary.missingFields, " (").concat(Math.round((validationReport.summary.missingFields / validationReport.summary.totalFields) * 100), "%)"));
                        // Categories
                        console.log('\n' + '-'.repeat(40));
                        console.log('BY CATEGORY');
                        console.log('-'.repeat(40));
                        Object.entries(validationReport.categories).forEach(function (_a) {
                            var category = _a[0], stats = _a[1];
                            console.log("".concat(category, ":"));
                            console.log("  Total: ".concat(stats.total, ", Transfer Rate: ").concat(Math.round(stats.transferRate), "%"));
                            console.log("  Transferred: ".concat(stats.transferred, ", Missing: ").concat(stats.missing));
                        });
                        // Critical Missing
                        if (validationReport.criticalMissing.length > 0) {
                            console.log('\n' + '-'.repeat(40));
                            console.log('CRITICAL MISSING FIELDS');
                            console.log('-'.repeat(40));
                            validationReport.criticalMissing.forEach(function (field) {
                                console.log("\u274C ".concat(field.field, " (").concat(field.category, ")"));
                                console.log("   Original: ".concat(field.originalValue));
                                console.log("   Location: ".concat(field.location.original));
                            });
                        }
                        // Recommendations
                        console.log('\n' + '-'.repeat(40));
                        console.log('RECOMMENDATIONS');
                        console.log('-'.repeat(40));
                        validationReport.recommendations.forEach(function (rec, index) {
                            console.log("".concat(index + 1, ". ").concat(rec));
                        });
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        reportPath = path.join(process.cwd(), 'field-validation-reports');
                        if (!fs.existsSync(reportPath)) {
                            fs.mkdirSync(reportPath, { recursive: true });
                        }
                        filename = "field-validation-".concat(registrationId, "-").concat(timestamp, ".json");
                        filepath = path.join(reportPath, filename);
                        fs.writeFileSync(filepath, JSON.stringify(validationReport, null, 2), 'utf8');
                        console.log("\n\uD83D\uDCC4 Detailed report saved: ".concat(filepath));
                        console.log('\n' + '='.repeat(80));
                        return [2 /*return*/];
                }
            });
        });
    };
    return ComparisonViewer;
}());
exports.ComparisonViewer = ComparisonViewer;
