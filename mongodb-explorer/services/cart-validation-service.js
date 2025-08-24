"use strict";
/**
 * Cart Validation Service
 * Validates cart structure and data integrity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartValidationService = void 0;
var CartValidationService = /** @class */ (function () {
    function CartValidationService() {
    }
    /**
     * Validate complete cart structure
     */
    CartValidationService.prototype.validateCart = function (cart) {
        var errors = [];
        var warnings = [];
        // Validate cart basics
        this.validateCartBasics(cart, errors, warnings);
        // Validate customer
        this.validateCustomer(cart.customer, errors, warnings);
        // Validate cart items
        this.validateCartItems(cart.cartItems, errors, warnings);
        // Validate pricing
        this.validatePricing(cart, errors, warnings);
        // Validate registration-specific rules
        this.validateRegistrationRules(cart, errors, warnings);
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };
    /**
     * Validate basic cart fields
     */
    CartValidationService.prototype.validateCartBasics = function (cart, errors, warnings) {
        if (!cart.cartId) {
            errors.push({
                field: 'cartId',
                message: 'Cart ID is required',
                severity: 'critical'
            });
        }
        if (!cart.status) {
            errors.push({
                field: 'status',
                message: 'Cart status is required',
                severity: 'error'
            });
        }
        if (!cart.currency) {
            warnings.push({
                field: 'currency',
                message: 'Currency not specified, defaulting to AUD'
            });
        }
        if (!cart.createdAt) {
            errors.push({
                field: 'createdAt',
                message: 'Cart creation date is required',
                severity: 'error'
            });
        }
    };
    /**
     * Validate customer object
     */
    CartValidationService.prototype.validateCustomer = function (customer, errors, warnings) {
        if (!customer) {
            errors.push({
                field: 'customer',
                message: 'Customer object is required',
                severity: 'critical'
            });
            return;
        }
        if (!customer.customerId) {
            errors.push({
                field: 'customer.customerId',
                message: 'Customer ID is required',
                severity: 'critical'
            });
        }
        if (!customer.email) {
            errors.push({
                field: 'customer.email',
                message: 'Customer email is required',
                severity: 'error'
            });
        }
        else if (!this.isValidEmail(customer.email)) {
            errors.push({
                field: 'customer.email',
                message: 'Customer email is invalid',
                severity: 'error'
            });
        }
        if (!customer.name) {
            errors.push({
                field: 'customer.name',
                message: 'Customer name is required',
                severity: 'error'
            });
        }
        if (!customer.type) {
            errors.push({
                field: 'customer.type',
                message: 'Customer type is required',
                severity: 'error'
            });
        }
        else if (!['person', 'organisation'].includes(customer.type)) {
            errors.push({
                field: 'customer.type',
                message: 'Customer type must be "person" or "organisation"',
                severity: 'error'
            });
        }
        // Validate organisation-specific fields
        if (customer.type === 'organisation' && !customer.businessName) {
            warnings.push({
                field: 'customer.businessName',
                message: 'Organisation customer should have businessName'
            });
        }
        if (customer.type === 'person' && customer.businessName) {
            warnings.push({
                field: 'customer.type',
                message: 'Customer has businessName but type is "person", should be "organisation"'
            });
        }
    };
    /**
     * Validate cart items
     */
    CartValidationService.prototype.validateCartItems = function (cartItems, errors, warnings) {
        var _this = this;
        if (!cartItems || cartItems.length === 0) {
            errors.push({
                field: 'cartItems',
                message: 'Cart must have at least one item',
                severity: 'error'
            });
            return;
        }
        var bundleItems = cartItems.filter(function (item) { return !item.parentItemId; });
        var childItems = cartItems.filter(function (item) { return item.parentItemId; });
        // Validate each bundle item
        bundleItems.forEach(function (item, index) {
            _this.validateCartItem(item, index, errors, warnings);
            // Check for orphaned parent references
            var children = childItems.filter(function (child) { return child.parentItemId === item.cartItemId; });
            if (children.length === 0 && bundleItems.length === 1) {
                warnings.push({
                    field: "cartItems[".concat(index, "]"),
                    message: 'Bundle item has no child items (events)'
                });
            }
        });
        // Check for orphaned child items
        childItems.forEach(function (item, index) {
            var parent = bundleItems.find(function (bundle) { return bundle.cartItemId === item.parentItemId; });
            if (!parent) {
                errors.push({
                    field: "cartItems[".concat(index, "].parentItemId"),
                    message: "Child item references non-existent parent: ".concat(item.parentItemId),
                    severity: 'error'
                });
            }
        });
    };
    /**
     * Validate individual cart item
     */
    CartValidationService.prototype.validateCartItem = function (item, index, errors, warnings) {
        if (!item.cartItemId) {
            errors.push({
                field: "cartItems[".concat(index, "].cartItemId"),
                message: 'Cart item ID is required',
                severity: 'critical'
            });
        }
        if (!item.productId) {
            errors.push({
                field: "cartItems[".concat(index, "].productId"),
                message: 'Product ID is required',
                severity: 'error'
            });
        }
        if (!item.variantId) {
            errors.push({
                field: "cartItems[".concat(index, "].variantId"),
                message: 'Variant ID is required',
                severity: 'error'
            });
        }
        if (item.quantity <= 0) {
            errors.push({
                field: "cartItems[".concat(index, "].quantity"),
                message: 'Quantity must be greater than 0',
                severity: 'error'
            });
        }
        if (item.price < 0) {
            errors.push({
                field: "cartItems[".concat(index, "].price"),
                message: 'Price cannot be negative',
                severity: 'error'
            });
        }
        if (Math.abs(item.subtotal - (item.price * item.quantity)) > 0.01) {
            errors.push({
                field: "cartItems[".concat(index, "].subtotal"),
                message: "Subtotal mismatch: expected ".concat(item.price * item.quantity, ", got ").concat(item.subtotal),
                severity: 'error'
            });
        }
    };
    /**
     * Validate pricing calculations
     */
    CartValidationService.prototype.validatePricing = function (cart, errors, warnings) {
        var calculatedSubtotal = cart.cartItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        if (Math.abs(calculatedSubtotal - cart.subtotal) > 0.01) {
            errors.push({
                field: 'subtotal',
                message: "Subtotal mismatch: calculated ".concat(calculatedSubtotal, ", stored ").concat(cart.subtotal),
                severity: 'error'
            });
        }
        if (cart.tax < 0) {
            errors.push({
                field: 'tax',
                message: 'Tax cannot be negative',
                severity: 'error'
            });
        }
        if (cart.discount < 0) {
            errors.push({
                field: 'discount',
                message: 'Discount cannot be negative',
                severity: 'error'
            });
        }
        var calculatedTotal = cart.subtotal + cart.tax - cart.discount;
        if (Math.abs(calculatedTotal - cart.total) > 0.01) {
            errors.push({
                field: 'total',
                message: "Total mismatch: calculated ".concat(calculatedTotal, ", stored ").concat(cart.total),
                severity: 'error'
            });
        }
    };
    /**
     * Validate registration-specific business rules
     */
    CartValidationService.prototype.validateRegistrationRules = function (cart, errors, warnings) {
        var _a, _b;
        var bundleItems = cart.cartItems.filter(function (item) { return !item.parentItemId; });
        // Check registration type from metadata
        var registrationType = (_b = (_a = bundleItems[0]) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.registrationType;
        if (!registrationType) {
            warnings.push({
                field: 'metadata.registrationType',
                message: 'Registration type not found in metadata'
            });
            return;
        }
        if (registrationType === 'individual') {
            // Individual registration rules
            this.validateIndividualRegistration(cart, bundleItems, errors, warnings);
        }
        else if (['lodge', 'grandLodge', 'masonicOrder'].includes(registrationType)) {
            // Organization registration rules
            this.validateOrganizationRegistration(cart, bundleItems, registrationType, errors, warnings);
        }
    };
    /**
     * Validate individual registration structure
     */
    CartValidationService.prototype.validateIndividualRegistration = function (cart, bundleItems, errors, warnings) {
        // Should have one bundle per attendee
        bundleItems.forEach(function (item, index) {
            if (!item.formData) {
                errors.push({
                    field: "bundleItems[".concat(index, "].formData"),
                    message: 'Individual registration bundle must have formData',
                    severity: 'error'
                });
                return;
            }
            // Check required attendee fields
            if (!item.formData.attendeeId) {
                errors.push({
                    field: "bundleItems[".concat(index, "].formData.attendeeId"),
                    message: 'Attendee ID is required in formData',
                    severity: 'error'
                });
            }
            if (!item.formData.firstName || !item.formData.lastName) {
                errors.push({
                    field: "bundleItems[".concat(index, "].formData"),
                    message: 'Attendee name is required in formData',
                    severity: 'error'
                });
            }
            // Warn about missing optional but important fields
            if (!item.formData.email) {
                warnings.push({
                    field: "bundleItems[".concat(index, "].formData.email"),
                    message: 'Attendee email is missing'
                });
            }
            if (item.formData.rank && !item.formData.lodgeName) {
                warnings.push({
                    field: "bundleItems[".concat(index, "].formData.lodgeName"),
                    message: 'Mason attendee should have lodge information'
                });
            }
        });
    };
    /**
     * Validate organization registration structure
     */
    CartValidationService.prototype.validateOrganizationRegistration = function (cart, bundleItems, registrationType, errors, warnings) {
        // Should have exactly one bundle item
        if (bundleItems.length !== 1) {
            errors.push({
                field: 'bundleItems',
                message: "Organization registration should have exactly 1 bundle item, found ".concat(bundleItems.length),
                severity: 'error'
            });
        }
        var bundleItem = bundleItems[0];
        if (!(bundleItem === null || bundleItem === void 0 ? void 0 : bundleItem.formData)) {
            errors.push({
                field: 'bundleItem.formData',
                message: 'Organization registration must have formData',
                severity: 'error'
            });
            return;
        }
        // Check for organization details based on type
        if (registrationType === 'lodge') {
            if (!bundleItem.formData.lodgeDetails && !bundleItem.formData.lodgeName) {
                warnings.push({
                    field: 'bundleItem.formData',
                    message: 'Lodge registration should have lodge details'
                });
            }
        }
        else if (registrationType === 'grandLodge') {
            if (!bundleItem.formData.grandLodgeDetails && !bundleItem.formData.grandLodgeName) {
                warnings.push({
                    field: 'bundleItem.formData',
                    message: 'Grand Lodge registration should have grand lodge details'
                });
            }
        }
        else if (registrationType === 'masonicOrder') {
            if (!bundleItem.formData.masonicOrderDetails && !bundleItem.formData.orderName) {
                warnings.push({
                    field: 'bundleItem.formData',
                    message: 'Masonic Order registration should have order details'
                });
            }
        }
        // Check for attendee list
        if (bundleItem.formData.attendees) {
            if (!Array.isArray(bundleItem.formData.attendees)) {
                errors.push({
                    field: 'bundleItem.formData.attendees',
                    message: 'Attendees must be an array',
                    severity: 'error'
                });
            }
            else if (bundleItem.quantity !== bundleItem.formData.attendees.length) {
                warnings.push({
                    field: 'bundleItem.quantity',
                    message: "Quantity (".concat(bundleItem.quantity, ") doesn't match attendee count (").concat(bundleItem.formData.attendees.length, ")")
                });
            }
        }
    };
    /**
     * Validate email format
     */
    CartValidationService.prototype.isValidEmail = function (email) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
    /**
     * Validate cart for order conversion
     */
    CartValidationService.prototype.validateForOrderConversion = function (cart) {
        var _a;
        var result = this.validateCart(cart);
        // Additional checks for order conversion
        if (cart.status !== 'active') {
            result.errors.push({
                field: 'status',
                message: 'Only active carts can be converted to orders',
                severity: 'error'
            });
        }
        if (cart.total <= 0) {
            result.warnings.push({
                field: 'total',
                message: 'Cart total is 0 or negative'
            });
        }
        if (!((_a = cart.customer) === null || _a === void 0 ? void 0 : _a.email)) {
            result.errors.push({
                field: 'customer.email',
                message: 'Customer email is required for order conversion',
                severity: 'critical'
            });
        }
        result.valid = result.errors.length === 0;
        return result;
    };
    return CartValidationService;
}());
exports.CartValidationService = CartValidationService;
