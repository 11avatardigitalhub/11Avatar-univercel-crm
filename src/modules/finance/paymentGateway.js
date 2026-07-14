/**
 * ==========================================
 * FILE: paymentGateway.js
 * MODULE: Finance Module
 * CODE: FIN-6
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Payment gateway service for the CRM.
 * Supports multiple payment providers like Razorpay, PhonePe, Paytm,
 * and UPI for Indian businesses.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * 
 * FUNCTIONS:
 * - initialize(): Initialize payment gateway
 * - createOrder(data): Create a payment order
 * - verifyPayment(paymentData): Verify payment
 * - processRefund(orderId, refundData): Process refund
 * - getPaymentStatus(orderId): Get payment status
 * - getPaymentMethods(): Get available payment methods
 * - createUPILink(amount, options): Create UPI payment link
 * - generatePaymentLink(orderId): Generate payment link
 * - handleWebhook(payload): Handle payment webhook
 * - getTransactionHistory(filters): Get transaction history
 * - getPaymentAnalytics(): Get payment analytics
 * - cancelOrder(orderId): Cancel a payment order
 * - getPaymentMethodsByCustomer(customerId): Get customer payment methods
 * - savePaymentMethod(customerId, methodData): Save payment method
 * - deletePaymentMethod(customerId, methodId): Delete payment method
 * - setDefaultPaymentMethod(customerId, methodId): Set default payment method
 * 
 * USAGE EXAMPLE:
 * import { paymentGateway } from './modules/finance/paymentGateway.js';
 * 
 * // Initialize payment gateway
 * await paymentGateway.initialize();
 * 
 * // Create a payment order
 * const order = await paymentGateway.createOrder({
 *   amount: 50000,
 *   currency: 'INR',
 *   customerId: 'cust_123',
 *   description: 'Invoice payment'
 * });
 * 
 * // Verify payment
 * const verified = await paymentGateway.verifyPayment({
 *   orderId: 'order_456',
 *   paymentId: 'pay_789',
 *   signature: 'sig_xyz'
 * });
 * 
 * // Generate UPI link
 * const upiLink = await paymentGateway.createUPILink(50000, {
 *   upiId: 'merchant@upi',
 *   description: 'Invoice #INV-001'
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let orders = [];
let transactions = [];
let savedPaymentMethods = new Map();
let orderIdCounter = 1000;

// Payment provider configuration
const PROVIDER_CONFIG = {
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_123456',
        keySecret: process.env.RAZORPAY_KEY_SECRET || 'test_secret',
        apiUrl: 'https://api.razorpay.com/v1',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret'
    },
    phonepe: {
        merchantId: process.env.PHONEPE_MERCHANT_ID || 'TESTMERCHANT',
        apiKey: process.env.PHONEPE_API_KEY || 'test_api_key',
        apiUrl: 'https://api.phonepe.com/apis/merchant'
    },
    paytm: {
        merchantId: process.env.PAYTM_MERCHANT_ID || 'TESTMERCHANT',
        apiKey: process.env.PAYTM_API_KEY || 'test_api_key',
        apiUrl: 'https://paytm.com/api'
    },
    upi: {
        defaultVPA: process.env.UPI_DEFAULT_VPA || 'merchant@upi'
    }
};

class PaymentGateway {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            defaultProvider: 'razorpay',
            supportedProviders: ['razorpay', 'phonepe', 'paytm', 'upi'],
            defaultCurrency: 'INR',
            webhookSecret: null,
            enableTestMode: true,
            timeoutSeconds: 300,
            maxRetries: 3,
            retryDelay: 1000
        };
        
        // Webhook handlers
        this.webhookHandlers = new Map();
        
        // Cache
        this.cache = {
            orders: new Map(),
            transactions: new Map()
        };
        
        // Statistics
        this.stats = {
            totalOrders: 0,
            totalTransactions: 0,
            totalAmount: 0,
            byProvider: {},
            byStatus: {},
            successRate: 0
        };
        
        // Debug mode
        this.debugMode = false;
    }

    /**
     * Initialize payment gateway
     * @param {object} options - Initialization options
     * @returns {boolean} Success status
     */
    async initialize(options = {}) {
        if (this.initialized) {
            return true;
        }

        try {
            // Update config if provided
            if (options.config) {
                this.config = { ...this.config, ...options.config };
            }

            // Set webhook secret
            if (options.webhookSecret) {
                this.config.webhookSecret = options.webhookSecret;
            }

            // Register default webhook handlers
            this.registerWebhookHandlers();

            logger.info('Payment gateway initialized', {
                defaultProvider: this.config.defaultProvider,
                supportedProviders: this.config.supportedProviders
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Payment gateway initialization failed:', error);
            throw error;
        }
    }

    /**
     * Register webhook handlers
     */
    registerWebhookHandlers() {
        this.webhookHandlers.set('payment.success', this.handlePaymentSuccess.bind(this));
        this.webhookHandlers.set('payment.failure', this.handlePaymentFailure.bind(this));
        this.webhookHandlers.set('payment.refund', this.handleRefund.bind(this));
        this.webhookHandlers.set('order.created', this.handleOrderCreated.bind(this));
        this.webhookHandlers.set('order.cancelled', this.handleOrderCancelled.bind(this));
    }

    /**
     * Create a payment order
     * @param {object} data - Order data
     * @param {object} options - Additional options
     * @returns {object} Created order
     */
    async createOrder(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Payment gateway not initialized');
        }

        // Validate data
        if (!data.amount || data.amount <= 0) {
            throw new Error('Valid amount is required');
        }
        if (!data.customerId) {
            throw new Error('Customer ID is required');
        }

        const provider = data.provider || this.config.defaultProvider;
        if (!this.config.supportedProviders.includes(provider)) {
            throw new Error(`Provider ${provider} not supported`);
        }

        // Create order
        const order = {
            id: this.generateOrderId(),
            customerId: data.customerId,
            amount: data.amount,
            currency: data.currency || this.config.defaultCurrency,
            provider: provider,
            status: 'pending',
            description: data.description || '',
            metadata: data.metadata || {},
            invoiceId: data.invoiceId || null,
            subscriptionId: data.subscriptionId || null,
            paymentId: null,
            signature: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.config.timeoutSeconds * 1000).toISOString()
        };

        // Store order
        orders.push(order);
        this.cache.orders.set(order.id, order);

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'payment.order.created',
            'finance',
            { orderId: order.id, amount: order.amount, provider: order.provider }
        );

        // Emit event
        eventBus.publish('payment.order.created', {
            orderId: order.id,
            customerId: order.customerId,
            amount: order.amount,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[PaymentGateway] Order created: ${order.id}`);
        }

        return order;
    }

    /**
     * Verify payment
     * @param {object} paymentData - Payment verification data
     * @param {object} options - Additional options
     * @returns {object} Verification result
     */
    async verifyPayment(paymentData, options = {}) {
        if (!this.initialized) {
            throw new Error('Payment gateway not initialized');
        }

        // Validate data
        if (!paymentData.orderId) {
            throw new Error('Order ID is required');
        }
        if (!paymentData.paymentId) {
            throw new Error('Payment ID is required');
        }

        const order = orders.find(o => o.id === paymentData.orderId);
        if (!order) {
            throw new Error(`Order ${paymentData.orderId} not found`);
        }

        // In production, this would verify with provider API
        // For MVP, simulate verification
        const verified = await this.simulateVerification(order, paymentData);

        if (verified) {
            order.status = 'completed';
            order.paymentId = paymentData.paymentId;
            order.signature = paymentData.signature || null;
            order.updatedAt = new Date().toISOString();

            // Record transaction
            const transaction = {
                id: 'txn_' + Date.now(),
                orderId: order.id,
                customerId: order.customerId,
                amount: order.amount,
                currency: order.currency,
                provider: order.provider,
                paymentId: paymentData.paymentId,
                status: 'success',
                createdAt: new Date().toISOString()
            };
            transactions.push(transaction);
            this.cache.transactions.set(transaction.id, transaction);

            // Update stats
            this.updateStats();

            // Emit event
            eventBus.publish('payment.success', {
                orderId: order.id,
                paymentId: paymentData.paymentId,
                amount: order.amount,
                userId: options.userId || 'system'
            });

            // Handle webhook
            await this.handlePaymentSuccess(order, paymentData);
        }

        return {
            verified: verified,
            orderId: order.id,
            status: order.status,
            paymentId: order.paymentId
        };
    }

    /**
     * Simulate verification (for MVP)
     * @param {object} order - Order object
     * @param {object} paymentData - Payment data
     * @returns {boolean} Verification result
     */
    async simulateVerification(order, paymentData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    }

    /**
     * Process refund
     * @param {string} orderId - Order ID
     * @param {object} refundData - Refund data
     * @param {object} options - Additional options
     * @returns {object} Refund result
     */
    async processRefund(orderId, refundData, options = {}) {
        if (!this.initialized) {
            throw new Error('Payment gateway not initialized');
        }

        const order = orders.find(o => o.id === orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        if (order.status !== 'completed') {
            throw new Error(`Order ${orderId} is not in a refundable state`);
        }

        const refundAmount = refundData.amount || order.amount;
        if (refundAmount > order.amount) {
            throw new Error('Refund amount exceeds order amount');
        }

        // In production, this would process refund via provider
        // For MVP, simulate refund
        const refund = {
            id: 'ref_' + Date.now(),
            orderId: orderId,
            amount: refundAmount,
            reason: refundData.reason || 'Refund requested',
            status: 'completed',
            processedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Update order
        order.status = 'refunded';
        order.refundAmount = refundAmount;
        order.refundedAt = refund.processedAt;
        order.updatedAt = new Date().toISOString();

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'payment.refund.processed',
            'finance',
            { orderId: orderId, refundAmount: refundAmount }
        );

        // Emit event
        eventBus.publish('payment.refunded', {
            orderId: order.id,
            refundAmount: refundAmount,
            userId: options.userId || 'system'
        });

        return refund;
    }

    /**
     * Get payment status
     * @param {string} orderId - Order ID
     * @param {object} options - Additional options
     * @returns {object} Payment status
     */
    async getPaymentStatus(orderId, options = {}) {
        const order = orders.find(o => o.id === orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        return {
            orderId: order.id,
            status: order.status,
            amount: order.amount,
            currency: order.currency,
            provider: order.provider,
            paymentId: order.paymentId,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };
    }

    /**
     * Get available payment methods
     * @param {object} options - Additional options
     * @returns {Array} Available payment methods
     */
    async getPaymentMethods(options = {}) {
        return [
            { id: 'razorpay', name: 'Razorpay', icon: 'razorpay.svg', type: 'gateway' },
            { id: 'phonepe', name: 'PhonePe', icon: 'phonepe.svg', type: 'gateway' },
            { id: 'paytm', name: 'Paytm', icon: 'paytm.svg', type: 'gateway' },
            { id: 'upi', name: 'UPI', icon: 'upi.svg', type: 'upi' },
            { id: 'bank_transfer', name: 'Bank Transfer', icon: 'bank.svg', type: 'transfer' },
            { id: 'cash', name: 'Cash', icon: 'cash.svg', type: 'cash' }
        ];
    }

    /**
     * Create UPI payment link
     * @param {number} amount - Payment amount
     * @param {object} options - UPI options
     * @returns {string} UPI link
     */
    async createUPILink(amount, options = {}) {
        if (!this.initialized) {
            throw new Error('Payment gateway not initialized');
        }

        const upiId = options.upiId || PROVIDER_CONFIG.upi.defaultVPA;
        const description = options.description || 'Payment';
        const name = options.name || 'Merchant';
        
        // Generate UPI link
        const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}`;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'payment.upi.link.created',
            'finance',
            { amount: amount, upiId: upiId }
        );

        return upiLink;
    }

    /**
     * Generate payment link for an order
     * @param {string} orderId - Order ID
     * @param {object} options - Additional options
     * @returns {string} Payment link
     */
    async generatePaymentLink(orderId, options = {}) {
        const order = orders.find(o => o.id === orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // In production, this would generate provider-specific payment link
        // For MVP, return a mock link
        return `https://payment.11avatar.com/pay/${orderId}`;
    }

    /**
     * Handle webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     * @returns {object} Webhook handling result
     */
    async handleWebhook(payload, options = {}) {
        if (!this.initialized) {
            throw new Error('Payment gateway not initialized');
        }

        // Verify webhook signature (in production)
        // For MVP, skip verification

        const event = payload.event || payload.type;
        const handler = this.webhookHandlers.get(event);
        
        if (handler) {
            await handler(payload, options);
            return { processed: true, event: event };
        }

        return { processed: false, event: event };
    }

    /**
     * Handle payment success webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     */
    async handlePaymentSuccess(payload, options = {}) {
        const orderId = payload.orderId || payload.order_id;
        const paymentId = payload.paymentId || payload.payment_id;
        
        if (orderId) {
            const order = orders.find(o => o.id === orderId);
            if (order && order.status !== 'completed') {
                order.status = 'completed';
                order.paymentId = paymentId;
                order.updatedAt = new Date().toISOString();
                this.updateStats();
            }
        }
    }

    /**
     * Handle payment failure webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     */
    async handlePaymentFailure(payload, options = {}) {
        const orderId = payload.orderId || payload.order_id;
        
        if (orderId) {
            const order = orders.find(o => o.id === orderId);
            if (order && order.status === 'pending') {
                order.status = 'failed';
                order.failureReason = payload.reason || 'Payment failed';
                order.updatedAt = new Date().toISOString();
                this.updateStats();
            }
        }
    }

    /**
     * Handle refund webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     */
    async handleRefund(payload, options = {}) {
        const orderId = payload.orderId || payload.order_id;
        
        if (orderId) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                order.status = 'refunded';
                order.refundAmount = payload.amount || 0;
                order.refundedAt = new Date().toISOString();
                order.updatedAt = new Date().toISOString();
                this.updateStats();
            }
        }
    }

    /**
     * Handle order created webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     */
    async handleOrderCreated(payload, options = {}) {
        // For logging purposes
        if (this.debugMode) {
            logger.debug('[PaymentGateway] Order created webhook received');
        }
    }

    /**
     * Handle order cancelled webhook
     * @param {object} payload - Webhook payload
     * @param {object} options - Additional options
     */
    async handleOrderCancelled(payload, options = {}) {
        const orderId = payload.orderId || payload.order_id;
        
        if (orderId) {
            const order = orders.find(o => o.id === orderId);
            if (order && order.status === 'pending') {
                order.status = 'cancelled';
                order.updatedAt = new Date().toISOString();
                this.updateStats();
            }
        }
    }

    /**
     * Get transaction history
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} Transaction history
     */
    async getTransactionHistory(filters = {}, options = {}) {
        let results = [...transactions];

        if (filters.customerId) {
            results = results.filter(t => t.customerId === filters.customerId);
        }

        if (filters.status) {
            results = results.filter(t => t.status === filters.status);
        }

        if (filters.provider) {
            results = results.filter(t => t.provider === filters.provider);
        }

        if (filters.startDate) {
            results = results.filter(t => new Date(t.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(t => new Date(t.createdAt) <= new Date(filters.endDate));
        }

        // Sort by createdAt descending
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply pagination
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated;
    }

    /**
     * Get payment analytics
     * @param {object} options - Additional options
     * @returns {object} Payment analytics
     */
    async getPaymentAnalytics(options = {}) {
        const totalOrders = orders.length;
        const completed = orders.filter(o => o.status === 'completed').length;
        const failed = orders.filter(o => o.status === 'failed').length;
        const pending = orders.filter(o => o.status === 'pending').length;
        const refunded = orders.filter(o => o.status === 'refunded').length;
        const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);

        return {
            totalOrders: totalOrders,
            completed: completed,
            failed: failed,
            pending: pending,
            refunded: refunded,
            successRate: totalOrders > 0 ? (completed / totalOrders) * 100 : 0,
            totalAmount: totalAmount,
            byProvider: this.stats.byProvider,
            byStatus: this.stats.byStatus
        };
    }

    /**
     * Cancel a payment order
     * @param {string} orderId - Order ID
     * @param {object} options - Additional options
     * @returns {object} Cancelled order
     */
    async cancelOrder(orderId, options = {}) {
        const order = orders.find(o => o.id === orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        if (order.status !== 'pending') {
            throw new Error(`Order ${orderId} cannot be cancelled (status: ${order.status})`);
        }

        order.status = 'cancelled';
        order.cancelledAt = new Date().toISOString();
        order.updatedAt = new Date().toISOString();

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'payment.order.cancelled',
            'finance',
            { orderId: orderId }
        );

        // Emit event
        eventBus.publish('payment.order.cancelled', {
            orderId: order.id,
            userId: options.userId || 'system'
        });

        return order;
    }

    /**
     * Get payment methods by customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} Payment methods
     */
    async getPaymentMethodsByCustomer(customerId, options = {}) {
        return savedPaymentMethods.get(customerId) || [];
    }

    /**
     * Save payment method for customer
     * @param {string} customerId - Customer ID
     * @param {object} methodData - Payment method data
     * @param {object} options - Additional options
     * @returns {object} Saved payment method
     */
    async savePaymentMethod(customerId, methodData, options = {}) {
        const methods = savedPaymentMethods.get(customerId) || [];
        
        const method = {
            id: 'pm_' + Date.now(),
            type: methodData.type,
            provider: methodData.provider || methodData.type,
            last4: methodData.last4 || null,
            expiry: methodData.expiry || null,
            isDefault: methods.length === 0 || methodData.isDefault,
            createdAt: new Date().toISOString()
        };

        methods.push(method);
        savedPaymentMethods.set(customerId, methods);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'payment.method.saved',
            'finance',
            { customerId: customerId, methodType: method.type }
        );

        return method;
    }

    /**
     * Delete payment method
     * @param {string} customerId - Customer ID
     * @param {string} methodId - Method ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deletePaymentMethod(customerId, methodId, options = {}) {
        const methods = savedPaymentMethods.get(customerId) || [];
        const updated = methods.filter(m => m.id !== methodId);
        savedPaymentMethods.set(customerId, updated);
        return true;
    }

    /**
     * Set default payment method
     * @param {string} customerId - Customer ID
     * @param {string} methodId - Method ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async setDefaultPaymentMethod(customerId, methodId, options = {}) {
        const methods = savedPaymentMethods.get(customerId) || [];
        for (const method of methods) {
            method.isDefault = method.id === methodId;
        }
        savedPaymentMethods.set(customerId, methods);
        return true;
    }

    /**
     * Update statistics
     */
    updateStats() {
        const totalOrders = orders.length;
        const totalTransactions = transactions.length;
        const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);

        this.stats.totalOrders = totalOrders;
        this.stats.totalTransactions = totalTransactions;
        this.stats.totalAmount = totalAmount;

        // By provider
        this.stats.byProvider = {};
        for (const order of orders) {
            this.stats.byProvider[order.provider] = (this.stats.byProvider[order.provider] || 0) + 1;
        }

        // By status
        this.stats.byStatus = {};
        for (const order of orders) {
            this.stats.byStatus[order.status] = (this.stats.byStatus[order.status] || 0) + 1;
        }

        // Success rate
        const completed = orders.filter(o => o.status === 'completed').length;
        this.stats.successRate = totalOrders > 0 ? (completed / totalOrders) * 100 : 0;
    }

    /**
     * Generate order ID
     * @returns {string} Order ID
     */
    generateOrderId() {
        orderIdCounter++;
        return 'order_' + orderIdCounter;
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[PaymentGateway] Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebug() {
        this.debugMode = false;
    }

    /**
     * Update configuration
     * @param {object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Cleanup service resources
     */
    cleanup() {
        this.initialized = false;
        this.cache.orders.clear();
        this.cache.transactions.clear();
        this.webhookHandlers.clear();
        logger.info('Payment gateway cleaned up');
    }
}

// Create and export singleton instance
export const paymentGateway = new PaymentGateway();

// Export class for testing
export default PaymentGateway;
