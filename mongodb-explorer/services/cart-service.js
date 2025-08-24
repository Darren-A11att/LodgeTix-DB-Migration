"use strict";
/**
 * Cart Service
 * Handles registration to cart conversion and cart operations
 * for the e-commerce architecture
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.CartService = void 0;
var uuid_1 = require("uuid");
// ============================================================================
// CART SERVICE CLASS
// ============================================================================
var CartService = /** @class */ (function () {
    function CartService(db) {
        this.bundleProductCache = null;
        this.db = db;
        this.cartsCollection = db.collection('carts');
        this.productsCollection = db.collection('products');
    }
    /**
     * Get or cache the bundle product
     */
    CartService.prototype.getBundleProduct = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.bundleProductCache) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.productsCollection.findOne({ type: 'bundle' })];
                    case 1:
                        _a.bundleProductCache = _b.sent();
                        if (!this.bundleProductCache) {
                            throw new Error('Bundle product not found in database');
                        }
                        _b.label = 2;
                    case 2: return [2 /*return*/, this.bundleProductCache];
                }
            });
        });
    };
    /**
     * Convert a registration to a cart
     */
    CartService.prototype.registrationToCart = function (registration) {
        return __awaiter(this, void 0, void 0, function () {
            var bundleProduct, customer, cartItems, _a, subtotal, tax, discount, total, cart;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getBundleProduct()];
                    case 1:
                        bundleProduct = _b.sent();
                        customer = this.createCustomer(registration.bookingContact);
                        if (!(registration.registrationType === 'individual')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.createIndividualCartItems(registration, bundleProduct)];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, this.createOrganizationCartItems(registration, bundleProduct)];
                    case 4:
                        _a = _b.sent();
                        _b.label = 5;
                    case 5:
                        cartItems = _a;
                        subtotal = cartItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
                        tax = 0;
                        discount = 0;
                        total = subtotal + tax - discount;
                        cart = {
                            cartId: (0, uuid_1.v4)(),
                            customer: customer,
                            cartItems: cartItems,
                            subtotal: subtotal,
                            tax: tax,
                            discount: discount,
                            total: total,
                            currency: 'AUD',
                            status: 'active',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        return [2 /*return*/, cart];
                }
            });
        });
    };
    /**
     * Create customer object from booking contact
     */
    CartService.prototype.createCustomer = function (bookingContact) {
        var hasBusinessName = bookingContact.businessName && bookingContact.businessName.trim() !== '';
        return {
            customerId: (0, uuid_1.v4)(),
            name: "".concat(bookingContact.firstName, " ").concat(bookingContact.lastName).trim(),
            type: hasBusinessName ? 'organisation' : 'person',
            email: bookingContact.email,
            phone: bookingContact.phone || bookingContact.mobile,
            businessName: bookingContact.businessName,
            businessNumber: bookingContact.businessNumber,
            addressLine1: bookingContact.addressLine1,
            city: bookingContact.city,
            state: bookingContact.state,
            postCode: bookingContact.postcode,
            country: bookingContact.country || 'Australia'
        };
    };
    /**
     * Create cart items for individual registration (one bundle per attendee)
     */
    CartService.prototype.createIndividualCartItems = function (registration, bundleProduct) {
        return __awaiter(this, void 0, void 0, function () {
            var cartItems, attendees, _loop_1, this_1, _i, attendees_1, attendee;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        cartItems = [];
                        attendees = registration.attendees || [];
                        _loop_1 = function (attendee) {
                            var isGuest, variantType, variant, bundleItem, attendeeTickets, _e, attendeeTickets_1, ticket, eventProduct, childItem;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        isGuest = !attendee.rank || attendee.rank === '';
                                        variantType = isGuest ? 'guest' : 'mason';
                                        variant = bundleProduct.variants.find(function (v) {
                                            return v.options.registration === 'individual' &&
                                                v.options.attendee === variantType;
                                        });
                                        if (!variant) {
                                            console.warn("No variant found for individual-".concat(variantType));
                                            return [2 /*return*/, "continue"];
                                        }
                                        bundleItem = {
                                            cartItemId: (0, uuid_1.v4)(),
                                            productId: bundleProduct.productId,
                                            variantId: variant.variantId,
                                            quantity: 1,
                                            price: variant.price || 0,
                                            subtotal: variant.price || 0,
                                            formData: __assign({}, attendee), // Copy ALL attendee data to formData
                                            metadata: {
                                                registrationId: registration.registrationId,
                                                registrationType: 'individual',
                                                attendeeType: variantType
                                            },
                                            addedAt: new Date(),
                                            updatedAt: new Date()
                                        };
                                        cartItems.push(bundleItem);
                                        attendeeTickets = ((_a = registration.tickets) === null || _a === void 0 ? void 0 : _a.filter(function (t) {
                                            return t.attendeeId === attendee.attendeeId;
                                        })) || [];
                                        _e = 0, attendeeTickets_1 = attendeeTickets;
                                        _f.label = 1;
                                    case 1:
                                        if (!(_e < attendeeTickets_1.length)) return [3 /*break*/, 4];
                                        ticket = attendeeTickets_1[_e];
                                        return [4 /*yield*/, this_1.productsCollection.findOne({
                                                sourceId: ticket.eventId,
                                                type: 'product'
                                            })];
                                    case 2:
                                        eventProduct = _f.sent();
                                        if (eventProduct) {
                                            childItem = {
                                                cartItemId: (0, uuid_1.v4)(),
                                                productId: eventProduct.productId,
                                                variantId: ((_c = (_b = eventProduct.variants) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.variantId) || '',
                                                quantity: 1,
                                                price: ticket.price,
                                                subtotal: ticket.price,
                                                parentItemId: bundleItem.cartItemId, // Link to parent bundle
                                                metadata: {
                                                    eventName: ticket.eventName,
                                                    ticketId: ticket.ticketId
                                                },
                                                addedAt: new Date(),
                                                updatedAt: new Date()
                                            };
                                            cartItems.push(childItem);
                                        }
                                        _f.label = 3;
                                    case 3:
                                        _e++;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, attendees_1 = attendees;
                        _d.label = 1;
                    case 1:
                        if (!(_i < attendees_1.length)) return [3 /*break*/, 4];
                        attendee = attendees_1[_i];
                        return [5 /*yield**/, _loop_1(attendee)];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, cartItems];
                }
            });
        });
    };
    /**
     * Create cart items for organization registration (single bundle)
     */
    CartService.prototype.createOrganizationCartItems = function (registration, bundleProduct) {
        return __awaiter(this, void 0, void 0, function () {
            var cartItems, variant, formData, bundleItem, tickets, _i, tickets_1, ticket, eventProduct, childItem;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        cartItems = [];
                        variant = bundleProduct.variants.find(function (v) {
                            return v.options.registration === registration.registrationType &&
                                v.options.attendee === 'member';
                        });
                        if (!variant) {
                            throw new Error("No variant found for ".concat(registration.registrationType, "-member"));
                        }
                        formData = {
                            registrationType: registration.registrationType,
                            registrationId: registration.registrationId,
                            registrationDate: registration.registrationDate,
                            confirmationNumber: registration.confirmationNumber
                        };
                        // Add type-specific details
                        if (registration.registrationType === 'lodge' && registration.lodgeDetails) {
                            formData.lodgeDetails = registration.lodgeDetails;
                        }
                        else if (registration.registrationType === 'grandLodge' && registration.grandLodgeDetails) {
                            formData.grandLodgeDetails = registration.grandLodgeDetails;
                        }
                        else if (registration.registrationType === 'masonicOrder' && registration.masonicOrderDetails) {
                            formData.masonicOrderDetails = registration.masonicOrderDetails;
                        }
                        // Add attendee list for reference (not booking contact)
                        if (registration.attendees && registration.attendees.length > 0) {
                            formData.attendees = registration.attendees;
                            formData.attendeeCount = registration.attendees.length;
                        }
                        // Add any additional metadata
                        if (registration.metadata) {
                            Object.assign(formData, registration.metadata);
                        }
                        bundleItem = {
                            cartItemId: (0, uuid_1.v4)(),
                            productId: bundleProduct.productId,
                            variantId: variant.variantId,
                            quantity: ((_a = registration.attendees) === null || _a === void 0 ? void 0 : _a.length) || 1,
                            price: variant.price || 0,
                            subtotal: (variant.price || 0) * (((_b = registration.attendees) === null || _b === void 0 ? void 0 : _b.length) || 1),
                            formData: formData,
                            metadata: {
                                registrationId: registration.registrationId,
                                registrationType: registration.registrationType
                            },
                            addedAt: new Date(),
                            updatedAt: new Date()
                        };
                        cartItems.push(bundleItem);
                        tickets = registration.tickets || [];
                        _i = 0, tickets_1 = tickets;
                        _e.label = 1;
                    case 1:
                        if (!(_i < tickets_1.length)) return [3 /*break*/, 4];
                        ticket = tickets_1[_i];
                        return [4 /*yield*/, this.productsCollection.findOne({
                                sourceId: ticket.eventId,
                                type: 'product'
                            })];
                    case 2:
                        eventProduct = _e.sent();
                        if (eventProduct) {
                            childItem = {
                                cartItemId: (0, uuid_1.v4)(),
                                productId: eventProduct.productId,
                                variantId: ((_d = (_c = eventProduct.variants) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.variantId) || '',
                                quantity: 1,
                                price: ticket.price,
                                subtotal: ticket.price,
                                parentItemId: bundleItem.cartItemId, // Link to parent bundle
                                metadata: {
                                    eventName: ticket.eventName,
                                    ticketId: ticket.ticketId
                                },
                                addedAt: new Date(),
                                updatedAt: new Date()
                            };
                            cartItems.push(childItem);
                        }
                        _e.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, cartItems];
                }
            });
        });
    };
    /**
     * Save cart to database
     */
    CartService.prototype.saveCart = function (cart) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cartsCollection.insertOne(cart)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update existing cart
     */
    CartService.prototype.updateCart = function (cartId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cartsCollection.updateOne({ cartId: cartId }, {
                            $set: __assign(__assign({}, updates), { updatedAt: new Date() })
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get cart by ID
     */
    CartService.prototype.getCart = function (cartId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cartsCollection.findOne({ cartId: cartId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Convert cart to order
     */
    CartService.prototype.convertCartToOrder = function (cartId, paymentInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var cart, order;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getCart(cartId)];
                    case 1:
                        cart = _a.sent();
                        if (!cart) {
                            throw new Error('Cart not found');
                        }
                        order = {
                            orderId: (0, uuid_1.v4)(),
                            orderNumber: this.generateOrderNumber(),
                            cartId: cart.cartId,
                            customer: cart.customer,
                            orderItems: cart.cartItems.map(function (item) { return (__assign(__assign({}, item), { orderItemId: (0, uuid_1.v4)(), status: 'pending' })); }),
                            subtotal: cart.subtotal,
                            tax: cart.tax,
                            discount: cart.discount,
                            total: cart.total,
                            currency: cart.currency,
                            payment: paymentInfo,
                            status: 'pending',
                            paymentStatus: 'pending',
                            fulfillmentStatus: 'unfulfilled',
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        // Save order
                        return [4 /*yield*/, this.db.collection('orders').insertOne(order)];
                    case 2:
                        // Save order
                        _a.sent();
                        // Update cart status
                        return [4 /*yield*/, this.updateCart(cartId, { status: 'converted' })];
                    case 3:
                        // Update cart status
                        _a.sent();
                        return [2 /*return*/, order];
                }
            });
        });
    };
    /**
     * Generate order number
     */
    CartService.prototype.generateOrderNumber = function () {
        var prefix = 'ORD';
        var timestamp = Date.now().toString(36).toUpperCase();
        var random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return "".concat(prefix, "-").concat(timestamp).concat(random);
    };
    return CartService;
}());
exports.CartService = CartService;
