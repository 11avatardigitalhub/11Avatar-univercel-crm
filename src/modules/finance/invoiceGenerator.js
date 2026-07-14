/**
 * ==========================================
 * FILE: invoiceGenerator.js
 * MODULE: Finance Module
 * CODE: FIN-2
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Invoice generation service for the CRM.
 * Handles invoice creation, PDF generation, and invoice management.
 * 
 * DEPENDENCIES:
 * - eventBus.js (for events)
 * - auditLogger.js (for logging)
 * - gstCalculator.js (for GST calculations)
 * 
 * FUNCTIONS:
 * - create(data): Create a new invoice
 * - findById(id): Find invoice by ID
 * - findAll(filters): Find all invoices with filters
 * - update(id, data): Update an invoice
 * - delete(id): Delete an invoice
 * - markAsPaid(id, paymentData): Mark invoice as paid
 * - generatePDF(id): Generate PDF for invoice
 * - sendInvoice(id, method): Send invoice via email/WhatsApp
 * - getInvoicesByCustomer(customerId): Get invoices by customer
 * - getInvoicesByStatus(status): Get invoices by status
 * - getInvoicesByDateRange(startDate, endDate): Get invoices by date
 * - getOutstandingInvoices(): Get outstanding invoices
 * - getRevenueByPeriod(period): Get revenue by period
 * - getInvoiceStats(): Get invoice statistics
 * - generateInvoiceNumber(): Generate invoice number
 * - getInvoiceTemplate(): Get default template
 * - updateTemplate(templateData): Update default template
 * 
 * USAGE EXAMPLE:
 * import { invoiceGenerator } from './modules/finance/invoiceGenerator.js';
 * 
 * // Create an invoice
 * const invoice = await invoiceGenerator.create({
 *   customerId: 'cust_123',
 *   items: [
 *     { description: 'ERP License', quantity: 10, rate: 5000, amount: 50000 }
 *   ],
 *   subtotal: 50000,
 *   gstRate: 18,
 *   dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
 * });
 * 
 * // Generate PDF
 * const pdfUrl = await invoiceGenerator.generatePDF('inv_456');
 * 
 * // Mark as paid
 * await invoiceGenerator.markAsPaid('inv_456', {
 *   paymentMethod: 'razorpay',
 *   transactionId: 'txn_123'
 * });
 * ==========================================
 */

import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let invoices = [];
let idCounter = 1000;
let invoiceNumberCounter = 1;

// Default invoice template
const defaultTemplate = {
    id: 'template_default',
    name: 'Default Invoice Template',
    header: {
        title: 'TAX INVOICE',
        companyName: '11 Avatar CRM',
        address: '123, Business Park, Mumbai, India',
        phone: '+91 9876543210',
        email: 'info@11avatar.com',
        gstin: '22AAAAA0000A1Z5',
        pan: 'AAAAA0000A'
    },
    footer: {
        terms: 'Payment due within 15 days',
        disclaimer: 'This is a system-generated invoice.',
        bankDetails: 'Bank: HDFC Bank, Account: 1234567890, IFSC: HDFC0001234'
    },
    format: {
        currency: '₹',
        dateFormat: 'DD/MM/YYYY',
        showTaxBreakdown: true,
        showDiscount: true
    }
};

class InvoiceGenerator {
    constructor() {
        // Service state
        this.initialized = false;
        this.template = { ...defaultTemplate };
        this.config = {
            prefix: 'INV',
            defaultDueDays: 15,
            defaultGstRate: 18,
            enablePDF: true,
            autoSendEmail: false
        };
        
        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        
        // Statistics
        this.stats = {
            total: 0,
            paid: 0,
            pending: 0,
            overdue: 0,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            overdueAmount: 0
        };
        
        // Debug mode
        this.debugMode = false;
        
        // Initialize sample data
        this.initSampleData();
    }

    /**
     * Initialize invoice generator
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

            if (options.template) {
                this.template = { ...this.template, ...options.template };
            }

            logger.info('Invoice generator initialized', {
                prefix: this.config.prefix,
                defaultDueDays: this.config.defaultDueDays
            });

            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Invoice generator initialization failed:', error);
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
                dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                paymentMethod: null,
                transactionId: null,
                pdfUrl: null,
                notes: 'Payment due within 15 days',
                currency: 'INR',
                createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
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
                dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paymentMethod: 'razorpay',
                transactionId: 'txn_razor_123',
                pdfUrl: '/invoices/inv_1002.pdf',
                notes: 'Payment received via Razorpay',
                currency: 'INR',
                createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
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
                dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                paidAt: null,
                paymentMethod: null,
                transactionId: null,
                pdfUrl: null,
                notes: 'Payment overdue, follow up with client',
                currency: 'INR',
                createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const invoice of sampleInvoices) {
            invoices.push(invoice);
            this.updateStats(invoice);
        }
    }

    /**
     * Create a new invoice
     * @param {object} data - Invoice data
     * @param {object} options - Additional options
     * @returns {object} Created invoice
     */
    async create(data, options = {}) {
        if (!this.initialized) {
            throw new Error('Invoice generator not initialized');
        }

        // Validate data
        this.validateInvoiceData(data);

        // Calculate totals
        const items = data.items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.amount || item.quantity * item.rate || 0), 0);
        const gstRate = data.gstRate || this.config.defaultGstRate;
        const gstAmount = (subtotal * gstRate) / 100;
        const total = subtotal + gstAmount;

        // Generate invoice number
        const invoiceNumber = data.invoiceNumber || this.generateInvoiceNumber();

        // Create invoice object
        const invoice = {
            id: this.generateId(),
            tenantId: data.tenantId || 'tenant_1',
            invoiceNumber: invoiceNumber,
            customerId: data.customerId,
            dealId: data.dealId || null,
            items: items,
            subtotal: subtotal,
            gstRate: gstRate,
            gstAmount: gstAmount,
            total: total,
            status: 'pending',
            dueDate: data.dueDate || new Date(Date.now() + this.config.defaultDueDays * 24 * 60 * 60 * 1000).toISOString(),
            paidAt: null,
            paymentMethod: null,
            transactionId: null,
            pdfUrl: null,
            notes: data.notes || '',
            currency: data.currency || 'INR',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store invoice
        invoices.push(invoice);
        this.updateStats(invoice);
        this.invalidateCache(invoice.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.generated',
            'finance',
            { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total }
        );

        // Emit event
        eventBus.publish('invoice.created', {
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            amount: invoice.total,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[InvoiceGenerator] Invoice created: ${invoice.invoiceNumber}`);
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
        // Check cache
        if (this.cache.has(id)) {
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

        // Cache the result
        this.cache.set(id, invoice);
        this.cacheTimestamps.set(id, Date.now());

        return { ...invoice };
    }

    /**
     * Find all invoices with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of invoices
     */
    async findAll(filters = {}, options = {}) {
        let results = [...invoices];

        // Apply filters
        if (filters.customerId) {
            results = results.filter(i => i.customerId === filters.customerId);
        }

        if (filters.status) {
            results = results.filter(i => i.status === filters.status);
        }

        if (filters.startDate) {
            results = results.filter(i => new Date(i.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(i => new Date(i.createdAt) <= new Date(filters.endDate));
        }

        if (filters.minAmount) {
            results = results.filter(i => i.total >= filters.minAmount);
        }

        if (filters.maxAmount) {
            results = results.filter(i => i.total <= filters.maxAmount);
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(i =>
                i.invoiceNumber.toLowerCase().includes(searchTerm) ||
                (i.notes && i.notes.toLowerCase().includes(searchTerm))
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
        const limit = options.limit || 100;
        const offset = options.offset || 0;
        const paginated = results.slice(offset, offset + limit);

        return paginated.map(invoice => ({ ...invoice }));
    }

    /**
     * Update an invoice
     * @param {string} id - Invoice ID
     * @param {object} data - Updated invoice data
     * @param {object} options - Additional options
     * @returns {object} Updated invoice
     */
    async update(id, data, options = {}) {
        const index = invoices.findIndex(i => i.id === id);
        if (index === -1) {
            throw new Error(`Invoice ${id} not found`);
        }

        const oldInvoice = { ...invoices[index] };
        const invoice = invoices[index];

        // Check if invoice can be updated
        if (invoice.status === 'paid' && !options.forceUpdate) {
            throw new Error('Cannot update a paid invoice');
        }

        // Update fields
        if (data.items) {
            invoice.items = data.items;
            invoice.subtotal = data.items.reduce((sum, item) => sum + (item.amount || item.quantity * item.rate || 0), 0);
            invoice.gstAmount = (invoice.subtotal * invoice.gstRate) / 100;
            invoice.total = invoice.subtotal + invoice.gstAmount;
        }
        if (data.gstRate !== undefined) {
            invoice.gstRate = data.gstRate;
            invoice.gstAmount = (invoice.subtotal * data.gstRate) / 100;
            invoice.total = invoice.subtotal + invoice.gstAmount;
        }
        if (data.notes) invoice.notes = data.notes;
        if (data.dueDate) invoice.dueDate = data.dueDate;
        
        invoice.updatedAt = new Date().toISOString();

        // Update stats
        this.updateStats(invoice, oldInvoice);

        // Invalidate cache
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.updated',
            'finance',
            { invoiceId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[InvoiceGenerator] Invoice updated: ${invoice.invoiceNumber}`);
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

        // Can't delete paid invoices
        if (invoice.status === 'paid' && !options.forceDelete) {
            throw new Error('Cannot delete a paid invoice');
        }

        // Remove from storage
        invoices.splice(index, 1);
        this.invalidateCache(id);

        // Update stats
        this.updateStats(null, invoice);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.deleted',
            'finance',
            { invoiceId: id, invoiceNumber: invoice.invoiceNumber }
        );

        if (this.debugMode) {
            logger.debug(`[InvoiceGenerator] Invoice deleted: ${invoice.invoiceNumber}`);
        }

        return true;
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
            paymentMethod: paymentData.method || paymentData.paymentMethod || 'other',
            transactionId: paymentData.transactionId || null,
            notes: invoice.notes ? `${invoice.notes}\n\nPaid: ${paymentData.notes || ''}` : `Paid: ${paymentData.notes || ''}`
        };

        const updated = await this.update(id, updateData, options);

        // Emit event
        eventBus.publish('invoice.paid', {
            invoiceId: updated.id,
            amount: updated.total,
            method: updateData.paymentMethod,
            userId: options.userId || 'system'
        });

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

        if (invoice.status !== 'pending') {
            return invoice;
        }

        const updated = await this.update(id, { status: 'overdue' }, options);

        // Emit event
        eventBus.publish('invoice.overdue', {
            invoiceId: updated.id,
            userId: options.userId || 'system'
        });

        return updated;
    }

    /**
     * Generate PDF for invoice
     * @param {string} id - Invoice ID
     * @param {object} options - Additional options
     * @returns {string} PDF URL
     */
    async generatePDF(id, options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        if (!this.config.enablePDF) {
            throw new Error('PDF generation is disabled');
        }

        // In production, this would generate PDF using pdf-lib
        // For MVP, return a mock PDF URL
        const pdfUrl = `/invoices/${invoice.id}.pdf`;
        
        // Update invoice with PDF URL
        await this.update(id, { pdfUrl }, options);

        if (this.debugMode) {
            logger.debug(`[InvoiceGenerator] PDF generated for invoice ${invoice.invoiceNumber}`);
        }

        return pdfUrl;
    }

    /**
     * Send invoice via email/WhatsApp
     * @param {string} id - Invoice ID
     * @param {string} method - Send method (email, whatsapp)
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async sendInvoice(id, method = 'email', options = {}) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error(`Invoice ${id} not found`);
        }

        // In production, this would send via email/WhatsApp services
        // For MVP, simulate sending
        await this.delay(1000);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'invoice.sent',
            'finance',
            { invoiceId: id, method: method }
        );

        if (this.debugMode) {
            logger.debug(`[InvoiceGenerator] Invoice sent via ${method}: ${invoice.invoiceNumber}`);
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
     * Get outstanding invoices
     * @param {object} options - Additional options
     * @returns {Array} List of outstanding invoices
     */
    async getOutstandingInvoices(options = {}) {
        return await this.findAll({ status: 'pending' }, options);
    }

    /**
     * Get revenue by period
     * @param {string} period - Period (day, week, month, quarter, year)
     * @param {object} options - Additional options
     * @returns {object} Revenue by period
     */
    async getRevenueByPeriod(period = 'month', options = {}) {
        const paidInvoices = invoices.filter(i => i.status === 'paid');
        const revenue = {};
        const now = new Date();

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
                    const weekNum = this.getWeekNumber(date);
                    periods.push(`${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`);
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
                    const weekNum = this.getWeekNumber(paidDate);
                    periodKey = `${paidDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
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
     * Get invoice statistics
     * @param {object} options - Additional options
     * @returns {object} Invoice statistics
     */
    async getInvoiceStats(options = {}) {
        return { ...this.stats };
    }

    /**
     * Generate invoice number
     * @param {object} options - Additional options
     * @returns {string} Invoice number
     */
    generateInvoiceNumber(options = {}) {
        const prefix = this.config.prefix;
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = String(invoiceNumberCounter++).padStart(4, '0');
        return `${prefix}-${year}${month}-${count}`;
    }

    /**
     * Get invoice template
     * @param {object} options - Additional options
     * @returns {object} Invoice template
     */
    getInvoiceTemplate(options = {}) {
        return { ...this.template };
    }

    /**
     * Update invoice template
     * @param {object} templateData - Template data
     * @param {object} options - Additional options
     * @returns {object} Updated template
     */
    async updateTemplate(templateData, options = {}) {
        this.template = { ...this.template, ...templateData };
        return { ...this.template };
    }

    /**
     * Validate invoice data
     * @param {object} data - Invoice data
     * @throws {Error} If validation fails
     */
    validateInvoiceData(data) {
        if (!data.customerId) {
            throw new Error('Customer ID is required');
        }
        if (!data.items || data.items.length === 0) {
            throw new Error('At least one invoice item is required');
        }
        for (const item of data.items) {
            if (!item.description) {
                throw new Error('Item description is required');
            }
            if (item.quantity !== undefined && item.quantity <= 0) {
                throw new Error('Item quantity must be positive');
            }
            if (item.rate !== undefined && item.rate < 0) {
                throw new Error('Item rate cannot be negative');
            }
        }
        if (data.gstRate !== undefined && (data.gstRate < 0 || data.gstRate > 100)) {
            throw new Error('GST rate must be between 0 and 100');
        }
    }

    /**
     * Update statistics
     * @param {object} invoice - Invoice to add/update
     * @param {object} oldInvoice - Old invoice (for updates)
     */
    updateStats(invoice, oldInvoice = null) {
        // Remove old invoice stats
        if (oldInvoice) {
            this.stats.total = Math.max(0, this.stats.total - 1);
            if (oldInvoice.status === 'paid') {
                this.stats.paid = Math.max(0, this.stats.paid - 1);
                this.stats.paidAmount = Math.max(0, this.stats.paidAmount - oldInvoice.total);
            } else if (oldInvoice.status === 'pending') {
                this.stats.pending = Math.max(0, this.stats.pending - 1);
                this.stats.pendingAmount = Math.max(0, this.stats.pendingAmount - oldInvoice.total);
            } else if (oldInvoice.status === 'overdue') {
                this.stats.overdue = Math.max(0, this.stats.overdue - 1);
                this.stats.overdueAmount = Math.max(0, this.stats.overdueAmount - oldInvoice.total);
            }
            this.stats.totalAmount = Math.max(0, this.stats.totalAmount - oldInvoice.total);
        }

        // Add new invoice stats
        if (invoice) {
            this.stats.total++;
            this.stats.totalAmount += invoice.total;
            if (invoice.status === 'paid') {
                this.stats.paid++;
                this.stats.paidAmount += invoice.total;
            } else if (invoice.status === 'pending') {
                this.stats.pending++;
                this.stats.pendingAmount += invoice.total;
            } else if (invoice.status === 'overdue') {
                this.stats.overdue++;
                this.stats.overdueAmount += invoice.total;
            }
        }
    }

    /**
     * Get week number
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
     * Invalidate cache
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
     * Delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Enable debug mode
     */
    enableDebug() {
        this.debugMode = true;
        logger.debug('[InvoiceGenerator] Debug mode enabled');
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
        this.cache.clear();
        this.cacheTimestamps.clear();
        logger.info('Invoice generator cleaned up');
    }
}

// Create and export singleton instance
export const invoiceGenerator = new InvoiceGenerator();

// Export class for testing
export default InvoiceGenerator;
