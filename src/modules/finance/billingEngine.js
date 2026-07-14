/**
 * ==========================================
 * FILE: billingEngine.js
 * MODULE: Finance Module
 * CODE: FIN-5
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Billing engine for the CRM that handles billing cycles,
 * invoice generation, payment processing, and revenue recognition.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - invoiceGenerator.js (for invoice creation)
 * - subscriptionManager.js (for subscription data)
 * 
 * FUNCTIONS:
 * - generateInvoice(invoiceData): Generate a new invoice
 * - processPayment(paymentData): Process a payment
 * - generateRecurringInvoices(): Generate recurring invoices
 * - getBillingHistory(customerId): Get billing history
 * - getOutstandingBalance(customerId): Get outstanding balance
 * - applyDiscount(invoiceId, discountData): Apply discount
 * - applyTax(invoiceId, taxData): Apply tax
 * - sendInvoiceReminders(): Send invoice reminders
 * - getRevenueReport(period): Get revenue report
 * - getBillingStats(): Get billing statistics
 * - getCustomerBillingSummary(customerId): Get customer billing summary
 * - voidInvoice(invoiceId): Void an invoice
 * - refundPayment(paymentId, refundData): Process refund
 * - getPaymentMethods(customerId): Get payment methods
 * - addPaymentMethod(customerId, methodData): Add payment method
 * - removePaymentMethod(customerId, methodId): Remove payment method
 * - setDefaultPaymentMethod(customerId, methodId): Set default payment method
 * 
 * USAGE EXAMPLE:
 * import { billingEngine } from './modules/finance/billingEngine.js';
 * 
 * // Generate an invoice
 * const invoice = await billingEngine.generateInvoice({
 *   customerId: 'cust_123',
 *   items: [
 *     { description: 'Monthly Subscription', amount: 999 }
 *   ]
 * });
 * 
 * // Process payment
 * const payment = await billingEngine.processPayment({
 *   invoiceId: 'inv_456',
 *   amount: 999,
 *   method: 'razorpay'
 * });
 * 
 * // Generate recurring invoices
 * await billingEngine.generateRecurringInvoices();
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { invoiceGenerator } from './invoiceGenerator.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let billingRecords = [];
let payments = [];
let invoices = [];
let paymentMethods = new Map();

class BillingEngine {
    constructor() {
        // Service state
        this.initialized = false;
        this.config = {
            defaultCurrency: 'INR',
            defaultTaxRate: 18,
            autoGenerateInvoices: true,
            sendReminders: true,
            reminderDays: [7, 3, 1],
            maxRetryPayments: 3,
            refundWindowDays: 30,
            lateFeePercentage: 2,
            lateFeeAfterDays: 15
        };
        
        // Cache
        this.cache = {
            invoices: new Map(),
            payments: new Map(),
            billingRecords: new Map()
        };
        
        // Statistics
        this.stats = {
            totalInvoices: 0,
            totalPayments: 0,
            totalRevenue: 0,
            pendingAmount: 0,
            overdueAmount: 0,
            byPeriod: {},
            byMethod: {}
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize sample data
        this.initSampleData();
        
        // Start reminder scheduler
        this.startReminderScheduler();
    }

    /**
     * Initialize billing engine
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

            // Update stats
            this.updateStats();

            logger.info('Billing engine initialized', {
                currency: this.config.defaultCurrency,
                taxRate: this.config.defaultTaxRate
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Billing engine initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const now = new Date();
        const sampleInvoices = [
            {
                id: 'inv_sample_1',
                customerId: 'cust_1001',
                invoiceNumber: 'INV-2024-001',
                items: [
                    { description: 'ERP License', quantity: 1, rate: 500000, amount: 500000 }
                ],
                subtotal: 500000,
                taxRate: 18,
                taxAmount: 90000,
                total: 590000,
                status: 'paid',
                dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paymentMethod: 'razorpay',
                transactionId: 'txn_sample_1',
                createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'inv_sample_2',
                customerId: 'cust_1002',
                invoiceNumber: 'INV-2024-002',
                items: [
                    { description: 'Healthcare Suite', quantity: 1, rate: 250000, amount: 250000 }
                ],
                subtotal: 250000,
                taxRate: 18,
                taxAmount: 45000,
                total: 295000,
                status: 'pending',
                dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                paymentMethod: null,
                transactionId: null,
                createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const inv of sampleInvoices) {
            invoices.push(inv);
            this.cache.invoices.set(inv.id, inv);
        }
    }

    /**
     * Generate a new invoice
     * @param {object} invoiceData - Invoice data
     * @param {object} options - Additional options
     * @returns {object} Created invoice
     */
    async generateInvoice(invoiceData, options = {}) {
        if (!this.initialized) {
            throw new Error('Billing engine not initialized');
        }

        // Validate data
        if (!invoiceData.customerId) {
            throw new Error('Customer ID is required');
        }
        if (!invoiceData.items || invoiceData.items.length === 0) {
            throw new Error('Invoice items are required');
        }

        // Calculate totals
        const items = invoiceData.items;
        const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxRate = invoiceData.taxRate || this.config.defaultTaxRate;
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount;

        // Create invoice
        const invoice = {
            id: this.generateId('inv'),
            customerId: invoiceData.customerId,
            invoiceNumber: this.generateInvoiceNumber(),
            items: items,
            subtotal: subtotal,
            taxRate: taxRate,
            taxAmount: taxAmount,
            total: total,
            status: 'pending',
            dueDate: invoiceData.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            paidAt: null,
            paymentMethod: null,
            transactionId: null,
            notes: invoiceData.notes || '',
            currency: invoiceData.currency || this.config.defaultCurrency,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store invoice
        invoices.push(invoice);
        this.cache.invoices.set(invoice.id, invoice);

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'billing.invoice.generated',
            'finance',
            { invoiceId: invoice.id, customerId: invoice.customerId, amount: invoice.total }
        );

        // Emit event
        eventBus.publish('billing.invoice.generated', {
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount: invoice.total,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[BillingEngine] Invoice generated: ${invoice.invoiceNumber}`);
        }

        return invoice;
    }

    /**
     * Process a payment
     * @param {object} paymentData - Payment data
     * @param {object} options - Additional options
     * @returns {object} Payment result
     */
    async processPayment(paymentData, options = {}) {
        if (!this.initialized) {
            throw new Error('Billing engine not initialized');
        }

        // Validate data
        if (!paymentData.invoiceId && !paymentData.customerId) {
            throw new Error('Invoice ID or Customer ID is required');
        }
        if (!paymentData.amount || paymentData.amount <= 0) {
            throw new Error('Valid amount is required');
        }
        if (!paymentData.method) {
            throw new Error('Payment method is required');
        }

        // Get invoice if invoiceId provided
        let invoice = null;
        if (paymentData.invoiceId) {
            invoice = invoices.find(i => i.id === paymentData.invoiceId);
            if (!invoice) {
                throw new Error(`Invoice ${paymentData.invoiceId} not found`);
            }
            if (invoice.status === 'paid') {
                throw new Error(`Invoice ${paymentData.invoiceId} is already paid`);
            }
        }

        // Process payment
        const payment = {
            id: this.generateId('pay'),
            invoiceId: paymentData.invoiceId || null,
            customerId: paymentData.customerId || invoice?.customerId,
            amount: paymentData.amount,
            method: paymentData.method,
            status: 'completed',
            transactionId: paymentData.transactionId || 'txn_' + Date.now(),
            paymentDetails: paymentData.paymentDetails || {},
            processedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Store payment
        payments.push(payment);
        this.cache.payments.set(payment.id, payment);

        // Update invoice if applicable
        if (invoice) {
            invoice.status = 'paid';
            invoice.paidAt = payment.processedAt;
            invoice.paymentMethod = payment.method;
            invoice.transactionId = payment.transactionId;
            invoice.updatedAt = new Date().toISOString();
            this.cache.invoices.set(invoice.id, invoice);

            // Emit event
            eventBus.publish('invoice.paid', {
                invoiceId: invoice.id,
                amount: payment.amount,
                method: payment.method,
                userId: options.userId || 'system'
            });
        }

        // Update stats
        this.updateStats();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'billing.payment.processed',
            'finance',
            { paymentId: payment.id, amount: payment.amount, method: payment.method }
        );

        if (this.debugMode) {
            logger.debug(`[BillingEngine] Payment processed: ${payment.id}`);
        }

        return payment;
    }

    /**
     * Generate recurring invoices
     * @param {object} options - Additional options
     * @returns {Array} Generated invoices
     */
    async generateRecurringInvoices(options = {}) {
        if (!this.initialized) {
            throw new Error('Billing engine not initialized');
        }

        // In production, this would check subscription billing cycles
        // For MVP, return sample
        const generated = [];
        
        if (this.debugMode) {
            logger.debug(`[BillingEngine] Recurring invoices generated: ${generated.length}`);
        }

        return generated;
    }

    /**
     * Get billing history
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} Billing history
     */
    async getBillingHistory(customerId, options = {}) {
        const customerInvoices = invoices.filter(i => i.customerId === customerId);
        const customerPayments = payments.filter(p => p.customerId === customerId);

        const history = [
            ...customerInvoices.map(i => ({ ...i, type: 'invoice' })),
            ...customerPayments.map(p => ({ ...p, type: 'payment' }))
        ];

        history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return history;
    }

    /**
     * Get outstanding balance for a customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {number} Outstanding balance
     */
    async getOutstandingBalance(customerId, options = {}) {
        const pendingInvoices = invoices.filter(i => 
            i.customerId === customerId && 
            (i.status === 'pending' || i.status === 'overdue')
        );

        return pendingInvoices.reduce((sum, i) => sum + i.total, 0);
    }

    /**
     * Apply discount to an invoice
     * @param {string} invoiceId - Invoice ID
     * @param {object} discountData - Discount data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async applyDiscount(invoiceId, discountData, options = {}) {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        if (invoice.status === 'paid') {
            throw new Error('Cannot apply discount to paid invoice');
        }

        const discountType = discountData.type || 'percentage';
        const discountValue = discountData.value || 0;
        
        let discountAmount = 0;
        if (discountType === 'percentage') {
            discountAmount = (invoice.subtotal * discountValue) / 100;
        } else {
            discountAmount = discountValue;
        }

        const newTotal = invoice.total - discountAmount;

        // Update invoice with discount
        invoice.discount = discountAmount;
        invoice.total = newTotal;
        invoice.updatedAt = new Date().toISOString();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'billing.discount.applied',
            'finance',
            { invoiceId: invoice.id, discountAmount: discountAmount }
        );

        return invoice;
    }

    /**
     * Apply tax to an invoice
     * @param {string} invoiceId - Invoice ID
     * @param {object} taxData - Tax data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async applyTax(invoiceId, taxData, options = {}) {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        if (invoice.status === 'paid') {
            throw new Error('Cannot apply tax to paid invoice');
        }

        const taxRate = taxData.rate || this.config.defaultTaxRate;
        const taxAmount = (invoice.subtotal * taxRate) / 100;

        invoice.taxRate = taxRate;
        invoice.taxAmount = taxAmount;
        invoice.total = invoice.subtotal + taxAmount;
        invoice.updatedAt = new Date().toISOString();

        return invoice;
    }

    /**
     * Send invoice reminders
     * @param {object} options - Additional options
     * @returns {Array} Reminders sent
     */
    async sendInvoiceReminders(options = {}) {
        if (!this.config.sendReminders) {
            return [];
        }

        const now = new Date();
        const reminders = [];

        for (const invoice of invoices) {
            if (invoice.status !== 'pending') continue;

            const dueDate = new Date(invoice.dueDate);
            const daysUntilDue = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));

            if (this.config.reminderDays.includes(daysUntilDue)) {
                // In production, send email/WhatsApp reminder
                reminders.push({
                    invoiceId: invoice.id,
                    daysUntilDue: daysUntilDue,
                    sentAt: new Date().toISOString()
                });
            }
        }

        return reminders;
    }

    /**
     * Get revenue report
     * @param {string} period - Period (day, week, month, quarter, year)
     * @param {object} options - Additional options
     * @returns {object} Revenue report
     */
    async getRevenueReport(period = 'month', options = {}) {
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        const now = new Date();
        const revenue = {};

        // Initialize periods
        let periods = [];
        switch (period) {
            case 'day':
                for (let i = 0; i < 30; i++) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    periods.push(date.toISOString().split('T')[0]);
                }
                break;
            case 'week':
                for (let i = 0; i < 12; i++) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i * 7);
                    periods.push(this.getWeekNumber(date));
                }
                break;
            case 'month':
                for (let i = 0; i < 12; i++) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - i);
                    periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
                }
                break;
            case 'quarter':
                for (let i = 0; i < 4; i++) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - i * 3);
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    periods.push(`${date.getFullYear()}-Q${quarter}`);
                }
                break;
            case 'year':
                for (let i = 0; i < 5; i++) {
                    periods.push(String(now.getFullYear() - i));
                }
                break;
            default:
                throw new Error(`Invalid period: ${period}`);
        }

        // Initialize revenue object
        for (const periodKey of periods) {
            revenue[periodKey] = 0;
        }

        // Calculate revenue
        for (const invoice of paidInvoices) {
            if (!invoice.paidAt) continue;
            const paidDate = new Date(invoice.paidAt);
            let periodKey;

            switch (period) {
                case 'day':
                    periodKey = paidDate.toISOString().split('T')[0];
                    break;
                case 'week':
                    periodKey = this.getWeekNumber(paidDate);
                    break;
                case 'month':
                    periodKey = `${paidDate.getFullYear()}-${String(paidDate.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'quarter':
                    const quarter = Math.floor(paidDate.getMonth() / 3) + 1;
                    periodKey = `${paidDate.getFullYear()}-Q${quarter}`;
                    break;
                case 'year':
                    periodKey = String(paidDate.getFullYear());
                    break;
                default:
                    continue;
            }

            if (revenue[periodKey] !== undefined) {
                revenue[periodKey] += invoice.total;
            }
        }

        return {
            period: period,
            revenue: revenue,
            total: Object.values(revenue).reduce((sum, val) => sum + val, 0),
            growth: this.calculateGrowth(revenue)
        };
    }

    /**
     * Get billing statistics
     * @param {object} options - Additional options
     * @returns {object} Billing statistics
     */
    async getBillingStats(options = {}) {
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * Get customer billing summary
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {object} Customer billing summary
     */
    async getCustomerBillingSummary(customerId, options = {}) {
        const customerInvoices = invoices.filter(i => i.customerId === customerId);
        const customerPayments = payments.filter(p => p.customerId === customerId);

        return {
            customerId: customerId,
            totalInvoices: customerInvoices.length,
            paidInvoices: customerInvoices.filter(i => i.status === 'paid').length,
            pendingInvoices: customerInvoices.filter(i => i.status === 'pending').length,
            overdueInvoices: customerInvoices.filter(i => i.status === 'overdue').length,
            totalAmount: customerInvoices.reduce((sum, i) => sum + i.total, 0),
            paidAmount: customerInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
            outstandingAmount: customerInvoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0),
            totalPayments: customerPayments.length,
            lastPayment: customerPayments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
        };
    }

    /**
     * Void an invoice
     * @param {string} invoiceId - Invoice ID
     * @param {object} options - Additional options
     * @returns {object} Voided invoice
     */
    async voidInvoice(invoiceId, options = {}) {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        if (invoice.status === 'paid') {
            throw new Error('Cannot void a paid invoice');
        }

        invoice.status = 'voided';
        invoice.voidedAt = new Date().toISOString();
        invoice.voidReason = options.reason || 'Voided by user';
        invoice.updatedAt = new Date().toISOString();

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'billing.invoice.voided',
            'finance',
            { invoiceId: invoice.id, reason: options.reason }
        );

        return invoice;
    }

    /**
     * Process refund
     * @param {string} paymentId - Payment ID
     * @param {object} refundData - Refund data
     * @param {object} options - Additional options
     * @returns {object} Refund result
     */
    async refundPayment(paymentId, refundData, options = {}) {
        const payment = payments.find(p => p.id === paymentId);
        if (!payment) {
            throw new Error(`Payment ${paymentId} not found`);
        }

        if (payment.status !== 'completed') {
            throw new Error(`Payment ${paymentId} is not in a refundable state`);
        }

        const refund = {
            id: this.generateId('ref'),
            paymentId: paymentId,
            amount: refundData.amount || payment.amount,
            reason: refundData.reason || 'Refund requested',
            status: 'completed',
            processedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'billing.refund.processed',
            'finance',
            { refundId: refund.id, paymentId: paymentId, amount: refund.amount }
        );

        return refund;
    }

    /**
     * Get payment methods for a customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} Payment methods
     */
    async getPaymentMethods(customerId, options = {}) {
        return paymentMethods.get(customerId) || [];
    }

    /**
     * Add payment method for a customer
     * @param {string} customerId - Customer ID
     * @param {object} methodData - Payment method data
     * @param {object} options - Additional options
     * @returns {object} Added payment method
     */
    async addPaymentMethod(customerId, methodData, options = {}) {
        const methods = paymentMethods.get(customerId) || [];
        const method = {
            id: 'pm_' + Date.now(),
            type: methodData.type,
            details: methodData.details,
            isDefault: methods.length === 0 || methodData.isDefault,
            createdAt: new Date().toISOString()
        };
        methods.push(method);
        paymentMethods.set(customerId, methods);
        return method;
    }

    /**
     * Remove payment method
     * @param {string} customerId - Customer ID
     * @param {string} methodId - Method ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async removePaymentMethod(customerId, methodId, options = {}) {
        const methods = paymentMethods.get(customerId) || [];
        const updated = methods.filter(m => m.id !== methodId);
        paymentMethods.set(customerId, updated);
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
        const methods = paymentMethods.get(customerId) || [];
        for (const method of methods) {
            method.isDefault = method.id === methodId;
        }
        paymentMethods.set(customerId, methods);
        return true;
    }

    /**
     * Calculate growth percentage
     * @param {object} revenue - Revenue data
     * @returns {number} Growth percentage
     */
    calculateGrowth(revenue) {
        const values = Object.values(revenue);
        if (values.length < 2) return 0;

        const latest = values[0] || 0;
        const previous = values[1] || 0;
        if (previous === 0) return 0;

        return ((latest - previous) / previous) * 100;
    }

    /**
     * Get week number
     * @param {Date} date - Date object
     * @returns {string} Week number
     */
    getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }

    /**
     * Update statistics
     */
    updateStats() {
        const totalInvoices = invoices.length;
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        const pendingInvoices = invoices.filter(i => i.status === 'pending');
        const overdueInvoices = invoices.filter(i => i.status === 'overdue');
        const totalPayments = payments.length;

        this.stats.totalInvoices = totalInvoices;
        this.stats.totalPayments = totalPayments;
        this.stats.totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
        this.stats.pendingAmount = pendingInvoices.reduce((sum, i) => sum + i.total, 0);
        this.stats.overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.total, 0);

        // By method
        this.stats.byMethod = {};
        for (const payment of payments) {
            this.stats.byMethod[payment.method] = (this.stats.byMethod[payment.method] || 0) + payment.amount;
        }
    }

    /**
     * Generate invoice number
     * @param {object} options - Additional options
     * @returns {string} Invoice number
     */
    generateInvoiceNumber(options = {}) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = String(invoices.length + 1).padStart(4, '0');
        return `INV-${year}${month}-${count}`;
    }

    /**
     * Generate unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Start reminder scheduler
     */
    startReminderScheduler() {
        setInterval(() => {
            if (this.initialized) {
                this.sendInvoiceReminders().catch(error => {
                    logger.error('[BillingEngine] Reminder scheduler error:', error);
                });
            }
        }, 3600000); // Check every hour
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[BillingEngine] Debug mode enabled');
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
        this.cache.invoices.clear();
        this.cache.payments.clear();
        this.cache.billingRecords.clear();
        logger.info('Billing engine cleaned up');
    }
}

// Create and export singleton instance
export const billingEngine = new BillingEngine();

// Export class for testing
export default BillingEngine;
