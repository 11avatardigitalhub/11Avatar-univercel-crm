/**
 * ==========================================
 * FILE: invoiceRepository.js
 * MODULE: Data/Repositories
 * CODE: DAT-5
 * PRIORITY: P0
 * PHASE: 0
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Data access layer for Invoice entities.
 * Handles CRUD operations, GST calculations, payment tracking, and reporting.
 * Implements tenant isolation and caching.
 * 
 * DEPENDENCIES:
 * - tenantIsolation.js (for tenant context)
 * - auditLogger.js (for logging)
 * - changeTracker.js (for tracking changes)
 * - customerRepository.js (for customer reference)
 * - dealRepository.js (for deal reference)
 * 
 * FUNCTIONS:
 * - create(invoiceData): Create a new invoice
 * - findById(id): Find invoice by ID
 * - findAll(filters): Find all invoices with filters
 * - update(id, invoiceData): Update an invoice
 * - delete(id): Delete an invoice
 * - getInvoicesByCustomer(customerId): Get invoices by customer
 * - getInvoicesByStatus(status): Get invoices by status
 * - getInvoicesByDateRange(startDate, endDate): Get invoices by date
 * - markAsPaid(id, paymentData): Mark invoice as paid
 * - markAsOverdue(id): Mark invoice as overdue
 * - generateInvoiceNumber(): Generate invoice number
 * - calculateGST(amount, rate): Calculate GST
 * - getInvoiceStats(): Get invoice statistics
 * - getRevenueByPeriod(period): Get revenue by period
 * - getOutstandingInvoices(): Get outstanding invoices
 * - sendInvoiceEmail(id): Send invoice email
 * - generatePDF(id): Generate PDF
 * - addPayment(id, paymentData): Add payment record
 * - getPaymentHistory(id): Get payment history
 * 
 * USAGE EXAMPLE:
 * import { invoiceRepository } from './data/repositories/invoiceRepository.js';
 * 
 * // Create a new invoice
 * const invoice = await invoiceRepository.create({
 *   customerId: 'cust_123',
 *   dealId: 'deal_456',
 *   items: [
 *     { description: 'ERP License', quantity: 10, rate: 5000, amount: 50000 }
 *   ],
 *   subtotal: 50000,
 *   gstRate: 18,
 *   dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
 * });
 * 
 * // Mark invoice as paid
 * await invoiceRepository.markAsPaid('inv_789', {
 *   paymentMethod: 'upi',
 *   transactionId: 'txn_123',
 *   paidAt: new Date().toISOString()
 * });
 * ==========================================
 */

import { tenantIsolation } from '../../core/multitenancy/tenantIsolation.js';
import { auditLogger } from '../../core/audit/auditLogger.js';
import { changeTracker } from '../../core/audit/changeTracker.js';
import { customerRepository } from './customerRepository.js';
import { dealRepository } from './dealRepository.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let invoices = [];
let idCounter = 1000;
let invoiceNumberCounter = 1;

class InvoiceRepository {
    constructor() {
        // In-memory cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Indexes for faster lookups
        this.indexes = {
            byCustomer: new Map(),
            byStatus: new Map(),
            byInvoiceNumber: new Map(),
            byDate: new Map(),
            byTenant: new Map()
        };
        
        // GST rates (India)
        this.gstRates = {
            '0': 0,
            '5': 5,
            '12': 12,
            '18': 18,
            '28': 28
        };
        
        // Configuration
        this.config = {
            enableCache: true,
            enableIndexes: true,
            defaultLimit: 100,
            maxLimit: 1000,
            defaultGstRate: 18,
            invoicePrefix: 'INV',
            invoiceDateFormat: 'YYYYMMDD'
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize with sample data
        this.initSampleData();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const sampleInvoices = [
            {
                id: 'inv_1001',
                tenantId: 'tenant_1',
                invoiceNumber: 'INV-2024-001',
                customerId: 'cust_1001',
                dealId: 'deal_1001',
                items: [
                    { description: 'ERP License (50 users)', quantity: 50, rate: 10000, amount: 500000 },
                    { description: 'Implementation Charges', quantity: 1, rate: 50000, amount: 50000 }
                ],
                subtotal: 550000,
                gstRate: 18,
                gstAmount: 99000,
                total: 649000,
                status: 'pending',
                dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                paymentMethod: null,
                transactionId: null,
                pdfUrl: null,
                notes: 'Payment due within 15 days',
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'inv_1002',
                tenantId: 'tenant_1',
                invoiceNumber: 'INV-2024-002',
                customerId: 'cust_1002',
                dealId: 'deal_1002',
                items: [
                    { description: 'Healthcare Management Suite', quantity: 10, rate: 25000, amount: 250000 }
                ],
                subtotal: 250000,
                gstRate: 18,
                gstAmount: 45000,
                total: 295000,
                status: 'paid',
                dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paymentMethod: 'razorpay',
                transactionId: 'txn_razor_123',
                pdfUrl: '/invoices/inv_1002.pdf',
                notes: 'Payment received via Razorpay',
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'inv_1003',
                tenantId: 'tenant_1',
                invoiceNumber: 'INV-2024-003',
                customerId: 'cust_1003',
                dealId: 'deal_1003',
                items: [
                    { description: 'IT Support - Monthly', quantity: 1, rate: 100000, amount: 100000 }
                ],
                subtotal: 100000,
                gstRate: 18,
                gstAmount: 18000,
                total: 118000,
                status: 'overdue',
                dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                paymentMethod: null,
                transactionId: null,
                pdfUrl: null,
                notes: 'Payment overdue, follow up with client',
                createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const invoice of sampleInvoices) {
            invoices.push(invoice);
            this.updateIndexes(invoice);
        }
    }

    /**
     * Create a new invoice
     * @param {object} invoiceData - Invoice data
     * @param {object} options - Additional options
     * @returns {object} Created invoice
     */
    async create(invoiceData, options = {}) {
        // Get tenant context
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        // Validate invoice data
        this.validateInvoice(invoiceData);

        // Validate customer exists
        const customer = await customerRepository.findById(invoiceData.customerId);
        if (!customer) {
            throw new Error(`Customer ${invoiceData.customerId} not found`);
        }

        // Calculate GST
        const gstRate = invoiceData.gstRate || this.config.defaultGstRate;
        const gstAmount = this.calculateGST(invoiceData.subtotal, gstRate);

        // Generate invoice number
        const invoiceNumber = this.generateInvoiceNumber();

        // Create invoice object
        const invoice = {
            id: this.generateId(),
            tenantId: tenantId,
            invoiceNumber: invoiceNumber,
            customerId: invoiceData.customerId,
            dealId: invoiceData.dealId || null,
            items: invoiceData.items || [],
            subtotal: invoiceData.subtotal || 0,
            gstRate: gstRate,
            gstAmount: gstAmount,
            total: (invoiceData.subtotal || 0) + gstAmount,
            status: 'pending',
            dueDate: invoiceData.dueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            paidAt: null,
            paymentMethod: null,
            transactionId: null,
            pdfUrl: null,
            notes: invoiceData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        invoices.push(invoice);
        this.updateIndexes(invoice);
        this.invalidateCache(invoice.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.created',
            'invoice',
            { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total }
        );

        if (this.debugMode) {
            console.log('[InvoiceRepository] Created invoice:', invoice.id);
        }

        return { ...invoice };
    }

    /**
     * Find invoice by ID
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {object|null} Invoice or null
     */
    async findById(id, options = {}) {
        // Check cache first
        if (this.config.enableCache && this.cache.has(id)) {
            const cached = this.cache.get(id);
            const timestamp = this.cacheTimestamps.get(id) || 0;
            if (Date.now() - timestamp < this.cacheTTL) {
                return { ...cached };
            }
            this.cache.delete(id);
            this.cacheTimestamps.delete(id);
        }

        const invoice = invoices.find(i => i.id === id);
        
        if (!invoice) {
            return null;
        }

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (invoice.tenantId !== tenantId) {
            return null;
        }

        // Cache the result
        if (this.config.enableCache) {
            this.cache.set(id, invoice);
            this.cacheTimestamps.set(id, Date.now());
        }

        return { ...invoice };
    }

    /**
     * Find all invoices with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of invoices
     */
    async findAll(filters = {}, options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        let results = invoices.filter(invoice => invoice.tenantId === tenantId);

        // Apply filters
        if (filters.customerId) {
            results = results.filter(invoice => invoice.customerId === filters.customerId);
        }

        if (filters.status) {
            results = results.filter(invoice => invoice.status === filters.status);
        }

        if (filters.invoiceNumber) {
            results = results.filter(invoice => invoice.invoiceNumber === filters.invoiceNumber);
        }

        if (filters.startDate) {
            results = results.filter(invoice => new Date(invoice.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(invoice => new Date(invoice.createdAt) <= new Date(filters.endDate));
        }

        if (filters.minAmount) {
            results = results.filter(invoice => invoice.total >= filters.minAmount);
        }

        if (filters.maxAmount) {
            results = results.filter(invoice => invoice.total <= filters.maxAmount);
        }

        if (filters.dueBefore) {
            results = results.filter(invoice => invoice.dueDate && new Date(invoice.dueDate) <= new Date(filters.dueBefore));
        }

        if (filters.dueAfter) {
            results = results.filter(invoice => invoice.dueDate && new Date(invoice.dueDate) >= new Date(filters.dueAfter));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(invoice =>
                invoice.invoiceNumber.toLowerCase().includes(searchTerm) ||
                (invoice.notes && invoice.notes.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'dueDate' || sortBy === 'paidAt') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }
            
            if (sortOrder === 'asc') {
                return valA < valB ? -1 : 1;
            } else {
                return valA > valB ? -1 : 1;
            }
        });

        // Apply pagination
        const limit = Math.min(options.limit || this.config.defaultLimit, this.config.maxLimit);
        const offset = options.offset || 0;
        
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(invoice => ({ ...invoice }));
    }

    /**
     * Update an invoice
     * @param {string} id - Invoice ID
     * @param {object} invoiceData - Updated invoice data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async update(id, invoiceData, options = {}) {
        const index = invoices.findIndex(i => i.id === id);
        
        if (index === -1) {
            throw new Error(`Invoice ${id} not found`);
        }

        const oldInvoice = { ...invoices[index] };
        const invoice = invoices[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (invoice.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // If status is paid, don't allow updates (audit purpose)
        if (invoice.status === 'paid' && !options.forceUpdate) {
            throw new Error('Cannot update a paid invoice');
        }

        // Track changes
        const changedFields = {};
        for (const [key, value] of Object.entries(invoiceData)) {
            if (value !== undefined && invoice[key] !== value) {
                changedFields[key] = { old: invoice[key], new: value };
                invoice[key] = value;
            }
        }

        // If subtotal or GST rate changed, recalculate total
        if (changedFields.subtotal || changedFields.gstRate) {
            const subtotal = invoice.subtotal;
            const gstRate = invoice.gstRate;
            invoice.gstAmount = this.calculateGST(subtotal, gstRate);
            invoice.total = subtotal + invoice.gstAmount;
        }

        invoice.updatedAt = new Date().toISOString();

        // Update indexes
        this.updateIndexes(invoice);
        this.invalidateCache(id);

        // Track change
        await changeTracker.trackChange(
            'invoice',
            id,
            oldInvoice,
            invoice,
            options.userId || 'system'
        );

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.updated',
            'invoice',
            { invoiceId: id, changes: changedFields }
        );

        if (this.debugMode) {
            console.log('[InvoiceRepository] Updated invoice:', id);
        }

        return { ...invoice };
    }

    /**
     * Delete an invoice
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async delete(id, options = {}) {
        const index = invoices.findIndex(i => i.id === id);
        
        if (index === -1) {
            throw new Error(`Invoice ${id} not found`);
        }

        const invoice = invoices[index];

        // Check tenant isolation
        const tenantId = tenantIsolation.getCurrentTenant();
        if (invoice.tenantId !== tenantId) {
            throw new Error('Access denied');
        }

        // Can't delete paid invoices (audit purpose)
        if (invoice.status === 'paid' && !options.forceDelete) {
            throw new Error('Cannot delete a paid invoice');
        }

        // Remove from storage
        invoices.splice(index, 1);

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.deleted',
            'invoice',
            { invoiceId: id, invoiceNumber: invoice.invoiceNumber }
        );

        if (this.debugMode) {
            console.log('[InvoiceRepository] Deleted invoice:', id);
        }

        return true;
    }

    /**
     * Get invoices by customer
     * @param {string} customerId - Customer ID
     * @param {object} options - Additional options
     * @returns {Array} List of invoices
     */
    async getInvoicesByCustomer(customerId, options = {}) {
        return await this.findAll({ customerId }, options);
    }

    /**
     * Get invoices by status
     * @param {string} status - Invoice status
     * @param {object} options - Additional options
     * @returns {Array} List of invoices
     */
    async getInvoicesByStatus(status, options = {}) {
        return await this.findAll({ status }, options);
    }

    /**
     * Get invoices by date range
     * @param {string} startDate - Start date (ISO string)
     * @param {string} endDate - End date (ISO string)
     * @param {object} options - Additional options
     * @returns {Array} List of invoices
     */
    async getInvoicesByDateRange(startDate, endDate, options = {}) {
        return await this.findAll({ startDate, endDate }, options);
    }

    /**
     * Mark invoice as paid
     * @param {string} id - Invoice ID
     * @param {object} paymentData - Payment data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async markAsPaid(id, paymentData = {}, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // Check if already paid
        if (invoice.status === 'paid') {
            return invoice;
        }

        const updateData = {
            status: 'paid',
            paidAt: paymentData.paidAt || new Date().toISOString(),
            paymentMethod: paymentData.paymentMethod || 'other',
            transactionId: paymentData.transactionId || null,
            notes: invoice.notes ? `${invoice.notes}\n\nPaid: ${paymentData.notes || ''}` : `Paid: ${paymentData.notes || ''}`
        };

        const updated = await this.update(id, updateData, options);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.paid',
            'invoice',
            { invoiceId: id, amount: invoice.total, method: paymentData.paymentMethod }
        );

        return updated;
    }

    /**
     * Mark invoice as overdue
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async markAsOverdue(id, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // Only pending invoices can be overdue
        if (invoice.status !== 'pending') {
            return invoice;
        }

        const updated = await this.update(id, { status: 'overdue' }, options);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.overdue',
            'invoice',
            { invoiceId: id, invoiceNumber: invoice.invoiceNumber }
        );

        return updated;
    }

    /**
     * Generate invoice number
     * @param {object} options - Additional options
     * @returns {string} Invoice number
     */
    generateInvoiceNumber(options = {}) {
        const prefix = this.config.invoicePrefix;
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        
        // Use counter
        const counter = String(invoiceNumberCounter++).padStart(4, '0');
        
        return `${prefix}-${year}${month}-${counter}`;
    }

    /**
     * Calculate GST
     * @param {number} amount - Base amount
     * @param {number} rate - GST rate (0, 5, 12, 18, 28)
     * @returns {number} GST amount
     */
    calculateGST(amount, rate) {
        return Math.round((amount * rate) / 100);
    }

    /**
     * Get invoice statistics
     * @param {object} options - Additional options
     * @returns {object} Invoice statistics
     */
    async getInvoiceStats(options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const tenantInvoices = invoices.filter(i => i.tenantId === tenantId);

        const stats = {
            total: tenantInvoices.length,
            byStatus: {},
            byPaymentMethod: {},
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            overdueAmount: 0,
            collectionRate: 0,
            averageInvoiceAmount: 0
        };

        let totalAmount = 0;
        let paidAmount = 0;
        let pendingAmount = 0;
        let overdueAmount = 0;

        for (const invoice of tenantInvoices) {
            stats.byStatus[invoice.status] = (stats.byStatus[invoice.status] || 0) + 1;
            
            if (invoice.paymentMethod) {
                stats.byPaymentMethod[invoice.paymentMethod] = (stats.byPaymentMethod[invoice.paymentMethod] || 0) + 1;
            }

            totalAmount += invoice.total;

            if (invoice.status === 'paid') {
                paidAmount += invoice.total;
            } else if (invoice.status === 'pending') {
                pendingAmount += invoice.total;
            } else if (invoice.status === 'overdue') {
                overdueAmount += invoice.total;
            }
        }

        stats.totalAmount = totalAmount;
        stats.paidAmount = paidAmount;
        stats.pendingAmount = pendingAmount;
        stats.overdueAmount = overdueAmount;
        stats.collectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;
        stats.averageInvoiceAmount = tenantInvoices.length > 0 ? Math.round(totalAmount / tenantInvoices.length) : 0;

        return stats;
    }

    /**
     * Get revenue by period
     * @param {string} period - Period (day, week, month, quarter, year)
     * @param {object} options - Additional options
     * @returns {object} Revenue by period
     */
    async getRevenueByPeriod(period = 'month', options = {}) {
        const tenantId = tenantIsolation.getCurrentTenant();
        if (!tenantId) {
            throw new Error('No tenant context available');
        }

        const paidInvoices = invoices.filter(i => 
            i.tenantId === tenantId && 
            i.status === 'paid'
        );

        const revenue = {};
        const now = new Date();
        let periods = [];

        // Determine periods based on period type
        switch (period) {
            case 'day':
                for (let i = 0; i < 30; i++) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    const key = date.toISOString().split('T')[0];
                    periods.push(key);
                }
                break;
            case 'week':
                for (let i = 0; i < 12; i++) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - (i * 7));
                    const weekNumber = this.getWeekNumber(date);
                    const key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
                    periods.push(key);
                }
                break;
            case 'month':
                for (let i = 0; i < 12; i++) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - i);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    periods.push(key);
                }
                break;
            case 'quarter':
                for (let i = 0; i < 4; i++) {
                    const date = new Date(now);
                    date.setMonth(date.getMonth() - (i * 3));
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    const key = `${date.getFullYear()}-Q${quarter}`;
                    periods.push(key);
                }
                break;
            case 'year':
                for (let i = 0; i < 5; i++) {
                    const year = now.getFullYear() - i;
                    const key = String(year);
                    periods.push(key);
                }
                break;
            default:
                throw new Error(`Invalid period: ${period}`);
        }

        // Initialize revenue object
        for (const periodKey of periods) {
            revenue[periodKey] = 0;
        }

        // Calculate revenue for each period
        for (const invoice of paidInvoices) {
            if (!invoice.paidAt) continue;
            const paidDate = new Date(invoice.paidAt);
            let periodKey;

            switch (period) {
                case 'day':
                    periodKey = paidDate.toISOString().split('T')[0];
                    break;
                case 'week':
                    const weekNumber = this.getWeekNumber(paidDate);
                    periodKey = `${paidDate.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
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

        return revenue;
    }

    /**
     * Get outstanding invoices
     * @param {object} options - Additional options
     * @returns {Array} List of outstanding invoices
     */
    async getOutstandingInvoices(options = {}) {
        return await this.findAll({
            status: { $in: ['pending', 'overdue'] }
        }, options);
    }

    /**
     * Send invoice email (placeholder)
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async sendInvoiceEmail(id, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // In production, this would send email via email service
        if (this.debugMode) {
            console.log(`[InvoiceRepository] Sending email for invoice: ${invoice.invoiceNumber}`);
        }

        return true;
    }

    /**
     * Generate PDF (placeholder)
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {string} PDF URL
     */
    async generatePDF(id, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // In production, this would generate PDF via pdf-lib
        const pdfUrl = `/invoices/${invoice.id}.pdf`;
        
        // Update invoice with PDF URL
        await this.update(id, { pdfUrl }, options);

        return pdfUrl;
    }

    /**
     * Add payment record
     * @param {string} id - Invoice ID
     * @param {object} paymentData - Payment data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async addPayment(id, paymentData, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // In production, this would add to payment history collection
        // For MVP, just mark as paid
        return await this.markAsPaid(id, paymentData, options);
    }

    /**
     * Get payment history
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {Array} Payment history
     */
    async getPaymentHistory(id, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // In production, this would fetch from payment history collection
        // For MVP, return basic payment info if paid
        if (invoice.status === 'paid') {
            return [{
                invoiceId: id,
                amount: invoice.total,
                method: invoice.paymentMethod,
                transactionId: invoice.transactionId,
                paidAt: invoice.paidAt
            }];
        }

        return [];
    }

    /**
     * Get week number for a date
     * @param {Date} date - Date object
     * @returns {number} Week number
     */
    getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'inv_' + idCounter;
    }

    /**
     * Validate invoice data
     * @param {object} invoiceData - Invoice data to validate
     * @throws {Error} If validation fails
     */
    validateInvoice(invoiceData) {
        if (!invoiceData.customerId) {
            throw new Error('Customer ID is required');
        }

        if (!invoiceData.items || invoiceData.items.length === 0) {
            throw new Error('At least one invoice item is required');
        }

        if (invoiceData.subtotal === undefined || invoiceData.subtotal < 0) {
            throw new Error('Subtotal is required and must be positive');
        }

        if (invoiceData.gstRate && !this.gstRates[invoiceData.gstRate]) {
            throw new Error(`Invalid GST rate. Valid rates: ${Object.keys(this.gstRates).join(', ')}`);
        }
    }

    /**
     * Update indexes for an invoice
     * @param {object} invoice - Invoice object
     */
    updateIndexes(invoice) {
        // Customer index
        if (invoice.customerId) {
            if (!this.indexes.byCustomer.has(invoice.customerId)) {
                this.indexes.byCustomer.set(invoice.customerId, new Set());
            }
            this.indexes.byCustomer.get(invoice.customerId).add(invoice.id);
        }

        // Status index
        if (invoice.status) {
            if (!this.indexes.byStatus.has(invoice.status)) {
                this.indexes.byStatus.set(invoice.status, new Set());
            }
            this.indexes.byStatus.get(invoice.status).add(invoice.id);
        }

        // Invoice number index
        if (invoice.invoiceNumber) {
            this.indexes.byInvoiceNumber.set(invoice.invoiceNumber, invoice.id);
        }

        // Date index
        const dateKey = new Date(invoice.createdAt).toDateString();
        if (!this.indexes.byDate.has(dateKey)) {
            this.indexes.byDate.set(dateKey, new Set());
        }
        this.indexes.byDate.get(dateKey).add(invoice.id);

        // Tenant index
        if (invoice.tenantId) {
            if (!this.indexes.byTenant.has(invoice.tenantId)) {
                this.indexes.byTenant.set(invoice.tenantId, new Set());
            }
            this.indexes.byTenant.get(invoice.tenantId).add(invoice.id);
        }
    }

    /**
     * Invalidate cache for an invoice
     * @param {string} id - Invoice ID
     */
    invalidateCache(id) {
        this.cache.delete(id);
        this.cacheTimestamps.delete(id);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        console.log('[InvoiceRepository] Debug mode enabled');
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
}

// Create and export singleton instance
export const invoiceRepository = new InvoiceRepository();

// Export class for testing
export default InvoiceRepository;
