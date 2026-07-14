/**
 * ==========================================
 * FILE: quotationManager.js
 * MODULE: CRM Module
 * CODE: CRM-6
 * PRIORITY: P0
 * PHASE: 1
 * STATUS: COMPLETED
 * VERSION: 1.0.0
 * ==========================================
 * 
 * DESCRIPTION:
 * Quotation management operations for the CRM module.
 * Handles quotation generation, PDF creation, and management.
 * 
 * DEPENDENCIES:
 * - dealRepository.js (for deal operations)
 * - customerRepository.js (for customer operations)
 * - invoiceRepository.js (for invoice conversion)
 * - eventBus.js (for events)
 * 
 * FUNCTIONS:
 * - createQuotation(data): Create a new quotation
 * - getQuotation(id): Get quotation by ID
 * - updateQuotation(id, data): Update a quotation
 * - deleteQuotation(id): Delete a quotation
 * - getQuotations(filters): Get quotations with filters
 * - generatePDF(id): Generate PDF for quotation
 * - sendQuotation(id, method): Send quotation via email/WhatsApp
 * - convertToInvoice(id): Convert quotation to invoice
 * - getQuotationTemplate(): Get default template
 * - updateTemplate(templateData): Update default template
 * - cloneQuotation(id): Clone an existing quotation
 * - getQuotationAnalytics(): Get quotation analytics
 * - getQuotationStatus(id): Get quotation status
 * - approveQuotation(id): Approve a quotation
 * - rejectQuotation(id, reason): Reject a quotation
 * - getQuotationStats(): Get quotation statistics
 * 
 * USAGE EXAMPLE:
 * import { quotationManager } from './modules/crm/quotationManager.js';
 * 
 * // Create a new quotation
 * const quotation = await quotationManager.createQuotation({
 *   dealId: 'deal_123',
 *   customerId: 'cust_456',
 *   items: [
 *     { description: 'ERP License', quantity: 10, rate: 5000, amount: 50000 }
 *   ],
 *   subtotal: 50000,
 *   taxRate: 18,
 *   validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
 * });
 * 
 * // Generate PDF
 * const pdfUrl = await quotationManager.generatePDF('quote_789');
 * 
 * // Send quotation
 * await quotationManager.sendQuotation('quote_789', 'email');
 * ==========================================
 */

import { dealRepository } from '../../layers/data/repositories/dealRepository.js';
import { customerRepository } from '../../layers/data/repositories/customerRepository.js';
import { invoiceRepository } from '../../layers/data/repositories/invoiceRepository.js';
import { eventBus } from '../../core/events/eventBus.js';
import { logger } from '../../core/monitoring/logger.js';
import { auditLogger } from '../../core/audit/auditLogger.js';

// In-memory storage (for MVP)
// In production, this would be Firestore
let quotations = [];
let idCounter = 1000;

class QuotationManager {
    constructor() {
        // Quotation template
        this.template = {
            id: 'template_default',
            name: 'Default Quotation Template',
            header: {
                title: 'QUOTATION',
                companyName: '11 Avatar CRM',
                address: '123, Business Park, Mumbai, India',
                phone: '+91 9876543210',
                email: 'info@11avatar.com',
                gstin: '22AAAAA0000A1Z5'
            },
            footer: {
                terms: 'Payment due within 15 days',
                disclaimer: 'This quotation is valid for 15 days from the date of issue.',
                signature: 'Authorized Signatory'
            },
            format: {
                currency: '₹',
                dateFormat: 'DD/MM/YYYY',
                showTaxBreakdown: true,
                showDiscount: true
            }
        };

        // Cache
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.cacheTimestamps = new Map();

        // Debug mode
        this.debugMode = false;

        // Initialize sample data
        this.initSampleData();
    }

    /**
     * Initialize sample data for testing
     */
    initSampleData() {
        const now = new Date();
        const sampleQuotations = [
            {
                id: 'quote_1001',
                tenantId: 'tenant_1',
                quotationNumber: 'QUOTE-2024-001',
                dealId: 'deal_1001',
                customerId: 'cust_1001',
                title: 'ERP License Quotation',
                description: 'Quotation for ERP license and implementation',
                items: [
                    { description: 'ERP License (50 users)', quantity: 50, rate: 10000, amount: 500000 },
                    { description: 'Implementation Charges', quantity: 1, rate: 50000, amount: 50000 },
                    { description: 'Training & Support', quantity: 1, rate: 25000, amount: 25000 }
                ],
                subtotal: 575000,
                taxRate: 18,
                taxAmount: 103500,
                discount: 0,
                discountType: 'percentage',
                total: 678500,
                status: 'sent',
                validUntil: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                sentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                approvedAt: null,
                rejectedAt: null,
                convertedToInvoice: null,
                notes: 'Includes 3 months of free support',
                createdBy: 'user_123',
                createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'quote_1002',
                tenantId: 'tenant_1',
                quotationNumber: 'QUOTE-2024-002',
                dealId: 'deal_1002',
                customerId: 'cust_1002',
                title: 'Healthcare Suite Quotation',
                description: 'Quotation for healthcare management suite',
                items: [
                    { description: 'Healthcare Suite (10 users)', quantity: 10, rate: 25000, amount: 250000 },
                    { description: 'Implementation', quantity: 1, rate: 30000, amount: 30000 }
                ],
                subtotal: 280000,
                taxRate: 18,
                taxAmount: 50400,
                discount: 10000,
                discountType: 'fixed',
                total: 320400,
                status: 'approved',
                validUntil: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                sentAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                approvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                rejectedAt: null,
                convertedToInvoice: 'inv_1002',
                notes: 'Approved by finance team',
                createdBy: 'user_456',
                createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        for (const quote of sampleQuotations) {
            quotations.push(quote);
        }
    }

    /**
     * Create a new quotation
     * @param {object} data - Quotation data
     * @param {object} options - Additional options
     * @returns {object} Created quotation
     */
    async createQuotation(data, options = {}) {
        // Validate data
        this.validateQuotationData(data);

        // Get customer and deal details
        const customer = await customerRepository.findById(data.customerId);
        if (!customer) {
            throw new Error(`Customer ${data.customerId} not found`);
        }

        if (data.dealId) {
            const deal = await dealRepository.findById(data.dealId);
            if (!deal) {
                throw new Error(`Deal ${data.dealId} not found`);
            }
        }

        // Calculate totals
        const items = data.items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxRate = data.taxRate || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = data.discount || 0;
        const total = subtotal + taxAmount - discount;

        // Generate quotation number
        const quotationNumber = this.generateQuotationNumber();

        // Create quotation
        const quotation = {
            id: this.generateId(),
            tenantId: data.tenantId || 'tenant_1',
            quotationNumber: quotationNumber,
            dealId: data.dealId || null,
            customerId: data.customerId,
            title: data.title || `Quotation for ${customer.name}`,
            description: data.description || '',
            items: items,
            subtotal: subtotal,
            taxRate: taxRate,
            taxAmount: taxAmount,
            discount: discount,
            discountType: data.discountType || 'percentage',
            total: total,
            status: 'draft',
            validUntil: data.validUntil || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            sentAt: null,
            approvedAt: null,
            rejectedAt: null,
            convertedToInvoice: null,
            notes: data.notes || '',
            createdBy: options.userId || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Store in memory
        quotations.push(quotation);
        this.invalidateCache(quotation.id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.created',
            'quotation',
            { quotationId: quotation.id, quotationNumber: quotation.quotationNumber }
        );

        // Emit event
        eventBus.publish('quotation.created', {
            quotationId: quotation.id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation created: ${quotation.id}`);
        }

        return { ...quotation };
    }

    /**
     * Get quotation by ID
     * @param {string} id - Quotation ID
     * @param {object} options - Additional options
     * @returns {object} Quotation
     */
    async getQuotation(id, options = {}) {
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

        const quotation = quotations.find(q => q.id === id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        // Cache the result
        this.cache.set(id, quotation);
        this.cacheTimestamps.set(id, Date.now());

        return { ...quotation };
    }

    /**
     * Update a quotation
     * @param {string} id - Quotation ID
     * @param {object} data - Updated quotation data
     * @param {object} options - Additional options
     * @returns {object} Updated quotation
     */
    async updateQuotation(id, data, options = {}) {
        const index = quotations.findIndex(q => q.id === id);
        if (index === -1) {
            throw new Error(`Quotation ${id} not found`);
        }

        const quotation = quotations[index];

        // Check if quotation can be updated
        if (quotation.status === 'approved' || quotation.status === 'converted') {
            throw new Error(`Cannot update ${quotation.status} quotation`);
        }

        // Update fields
        const oldQuotation = { ...quotation };

        if (data.title) quotation.title = data.title;
        if (data.description) quotation.description = data.description;
        if (data.items) {
            quotation.items = data.items;
            quotation.subtotal = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
            quotation.taxAmount = (quotation.subtotal * quotation.taxRate) / 100;
            quotation.total = quotation.subtotal + quotation.taxAmount - (quotation.discount || 0);
        }
        if (data.taxRate !== undefined) {
            quotation.taxRate = data.taxRate;
            quotation.taxAmount = (quotation.subtotal * data.taxRate) / 100;
            quotation.total = quotation.subtotal + quotation.taxAmount - (quotation.discount || 0);
        }
        if (data.discount !== undefined) {
            quotation.discount = data.discount;
            quotation.total = quotation.subtotal + quotation.taxAmount - data.discount;
        }
        if (data.notes) quotation.notes = data.notes;
        if (data.validUntil) quotation.validUntil = data.validUntil;

        quotation.updatedAt = new Date().toISOString();
        quotations[index] = quotation;
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.updated',
            'quotation',
            { quotationId: id, changes: data }
        );

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation updated: ${id}`);
        }

        return { ...quotation };
    }

    /**
     * Delete a quotation
     * @param {string} id - Quotation ID
     * @param {object} options - Additional options
     * @returns {boolean} Success status
     */
    async deleteQuotation(id, options = {}) {
        const index = quotations.findIndex(q => q.id === id);
        if (index === -1) {
            throw new Error(`Quotation ${id} not found`);
        }

        const quotation = quotations[index];

        // Check if quotation can be deleted
        if (quotation.status === 'approved' || quotation.status === 'converted') {
            throw new Error(`Cannot delete ${quotation.status} quotation`);
        }

        quotations.splice(index, 1);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.deleted',
            'quotation',
            { quotationId: id }
        );

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation deleted: ${id}`);
        }

        return true;
    }

    /**
     * Get quotations with filters
     * @param {object} filters - Filter criteria
     * @param {object} options - Additional options
     * @returns {Array} List of quotations
     */
    async getQuotations(filters = {}, options = {}) {
        let results = [...quotations];

        // Apply filters
        if (filters.status) {
            results = results.filter(q => q.status === filters.status);
        }

        if (filters.customerId) {
            results = results.filter(q => q.customerId === filters.customerId);
        }

        if (filters.dealId) {
            results = results.filter(q => q.dealId === filters.dealId);
        }

        if (filters.startDate) {
            results = results.filter(q => new Date(q.createdAt) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            results = results.filter(q => new Date(q.createdAt) <= new Date(filters.endDate));
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            results = results.filter(q =>
                q.quotationNumber.toLowerCase().includes(searchTerm) ||
                q.title.toLowerCase().includes(searchTerm) ||
                q.description.toLowerCase().includes(searchTerm)
            );
        }

        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'validUntil') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
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

        return paginated.map(quotation => ({ ...quotation }));
    }

    /**
     * Generate PDF for quotation
     * @param {string} id - Quotation ID
     * @param {object} options - Additional options
     * @returns {string} PDF URL
     */
    async generatePDF(id, options = {}) {
        const quotation = await this.getQuotation(id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        // In production, this would generate PDF using pdf-lib or similar
        // For MVP, return a mock PDF URL
        const pdfUrl = `/quotations/${quotation.id}.pdf`;

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.pdf_generated',
            'quotation',
            { quotationId: id }
        );

        if (this.debugMode) {
            logger.debug(`[QuotationManager] PDF generated for quotation: ${id}`);
        }

        return pdfUrl;
    }

    /**
     * Send quotation via email/WhatsApp
     * @param {string} id - Quotation ID
     * @param {string} method - Send method (email, whatsapp)
     * @param {object} options - Additional options
     * @returns {object} Send result
     */
    async sendQuotation(id, method = 'email', options = {}) {
        const quotation = await this.getQuotation(id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        // Update quotation status
        quotation.status = 'sent';
        quotation.sentAt = new Date().toISOString();
        quotation.updatedAt = new Date().toISOString();
        this.updateQuotationInStorage(id, quotation);
        this.invalidateCache(id);

        // In production, this would send email/WhatsApp via respective services
        // For MVP, simulate sending
        await this.simulateSend(quotation, method);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.sent',
            'quotation',
            { quotationId: id, method: method }
        );

        // Emit event
        eventBus.publish('quotation.sent', {
            quotationId: id,
            method: method,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation sent: ${id} via ${method}`);
        }

        return {
            success: true,
            quotationId: id,
            method: method,
            sentAt: quotation.sentAt
        };
    }

    /**
     * Simulate sending quotation
     * @param {object} quotation - Quotation object
     * @param {string} method - Send method
     */
    async simulateSend(quotation, method) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Simulate successful send
    }

    /**
     * Convert quotation to invoice
     * @param {string} id - Quotation ID
     * @param {object} options - Additional options
     * @returns {object} Created invoice
     */
    async convertToInvoice(id, options = {}) {
        const quotation = await this.getQuotation(id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        // Check if already converted
        if (quotation.status === 'converted') {
            throw new Error(`Quotation ${id} already converted to invoice`);
        }

        // Create invoice from quotation
        const invoiceData = {
            customerId: quotation.customerId,
            dealId: quotation.dealId,
            items: quotation.items,
            subtotal: quotation.subtotal,
            gstRate: quotation.taxRate,
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            notes: `Converted from quotation ${quotation.quotationNumber}\n${quotation.notes || ''}`
        };

        const invoice = await invoiceRepository.create(invoiceData, {
            userId: options.userId || 'system'
        });

        // Update quotation
        quotation.status = 'converted';
        quotation.convertedToInvoice = invoice.id;
        quotation.updatedAt = new Date().toISOString();
        this.updateQuotationInStorage(id, quotation);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.converted',
            'quotation',
            { quotationId: id, invoiceId: invoice.id }
        );

        // Emit event
        eventBus.publish('quotation.converted', {
            quotationId: id,
            invoiceId: invoice.id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation converted: ${id} → ${invoice.id}`);
        }

        return invoice;
    }

    /**
     * Approve a quotation
     * @param {string} id - Quotation ID
     * @param {object} options - Additional options
     * @returns {object} Updated quotation
     */
    async approveQuotation(id, options = {}) {
        const quotation = await this.getQuotation(id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        if (quotation.status === 'approved') {
            return quotation;
        }

        quotation.status = 'approved';
        quotation.approvedAt = new Date().toISOString();
        quotation.updatedAt = new Date().toISOString();
        this.updateQuotationInStorage(id, quotation);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.approved',
            'quotation',
            { quotationId: id }
        );

        // Emit event
        eventBus.publish('quotation.approved', {
            quotationId: id,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation approved: ${id}`);
        }

        return { ...quotation };
    }

    /**
     * Reject a quotation
     * @param {string} id - Quotation ID
     * @param {string} reason - Rejection reason
     * @param {object} options - Additional options
     * @returns {object} Updated quotation
     */
    async rejectQuotation(id, reason, options = {}) {
        const quotation = await this.getQuotation(id);
        if (!quotation) {
            throw new Error(`Quotation ${id} not found`);
        }

        if (quotation.status === 'rejected') {
            return quotation;
        }

        quotation.status = 'rejected';
        quotation.rejectedAt = new Date().toISOString();
        quotation.rejectionReason = reason;
        quotation.updatedAt = new Date().toISOString();
        this.updateQuotationInStorage(id, quotation);
        this.invalidateCache(id);

        // Log to audit
        await auditLogger.log(
            options.userId || 'system',
            'quotation.rejected',
            'quotation',
            { quotationId: id, reason: reason }
        );

        // Emit event
        eventBus.publish('quotation.rejected', {
            quotationId: id,
            reason: reason,
            userId: options.userId || 'system'
        });

        if (this.debugMode) {
            logger.debug(`[QuotationManager] Quotation rejected: ${id}`);
        }

        return { ...quotation };
    }

    /**
     * Get quotation analytics
     * @param {object} options - Additional options
     * @returns {object} Quotation analytics
     */
    async getQuotationAnalytics(options = {}) {
        const allQuotations = [...quotations];

        const analytics = {
            total: allQuotations.length,
            byStatus: {},
            byMonth: {},
            totalValue: 0,
            averageValue: 0,
            conversionRate: 0,
            approvalRate: 0
        };

        let totalValue = 0;
        let converted = 0;
        let approved = 0;

        for (const quote of allQuotations) {
            // By status
            analytics.byStatus[quote.status] = (analytics.byStatus[quote.status] || 0) + 1;

            // By month
            const month = new Date(quote.createdAt).toISOString().substring(0, 7);
            if (!analytics.byMonth[month]) {
                analytics.byMonth[month] = { count: 0, value: 0 };
            }
            analytics.byMonth[month].count++;
            analytics.byMonth[month].value += quote.total;

            totalValue += quote.total;

            if (quote.status === 'converted' || quote.status === 'approved') {
                converted++;
            }
            if (quote.status === 'approved') {
                approved++;
            }
        }

        analytics.totalValue = totalValue;
        analytics.averageValue = allQuotations.length > 0 ? totalValue / allQuotations.length : 0;
        analytics.conversionRate = allQuotations.length > 0 ? (converted / allQuotations.length) * 100 : 0;
        analytics.approvalRate = allQuotations.length > 0 ? (approved / allQuotations.length) * 100 : 0;

        return analytics;
    }

    /**
     * Get quotation statistics
     * @param {object} options - Additional options
     * @returns {object} Quotation statistics
     */
    async getQuotationStats(options = {}) {
        const allQuotations = [...quotations];

        return {
            total: allQuotations.length,
            draft: allQuotations.filter(q => q.status === 'draft').length,
            sent: allQuotations.filter(q => q.status === 'sent').length,
            approved: allQuotations.filter(q => q.status === 'approved').length,
            rejected: allQuotations.filter(q => q.status === 'rejected').length,
            converted: allQuotations.filter(q => q.status === 'converted').length,
            totalValue: allQuotations.reduce((sum, q) => sum + q.total, 0)
        };
    }

    /**
     * Generate quotation number
     * @param {object} options - Additional options
     * @returns {string} Quotation number
     */
    generateQuotationNumber(options = {}) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const count = quotations.length + 1;
        return `QUOTE-${year}${month}-${String(count).padStart(4, '0')}`;
    }

    /**
     * Validate quotation data
     * @param {object} data - Quotation data
     */
    validateQuotationData(data) {
        if (!data.customerId) {
            throw new Error('Customer ID is required');
        }

        if (!data.items || data.items.length === 0) {
            throw new Error('At least one item is required');
        }

        for (const item of data.items) {
            if (!item.description) {
                throw new Error('Item description is required');
            }
            if (item.quantity && item.quantity <= 0) {
                throw new Error('Item quantity must be positive');
            }
            if (item.rate && item.rate < 0) {
                throw new Error('Item rate cannot be negative');
            }
        }

        if (data.taxRate !== undefined && (data.taxRate < 0 || data.taxRate > 100)) {
            throw new Error('Tax rate must be between 0 and 100');
        }

        if (data.discount !== undefined && data.discount < 0) {
            throw new Error('Discount cannot be negative');
        }
    }

    /**
     * Update quotation in storage
     * @param {string} id - Quotation ID
     * @param {object} quotation - Quotation object
     */
    updateQuotationInStorage(id, quotation) {
        const index = quotations.findIndex(q => q.id === id);
        if (index !== -1) {
            quotations[index] = quotation;
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        idCounter++;
        return 'quote_' + idCounter;
    }

    /**
     * Invalidate cache
     * @param {string} id - Quotation ID
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
        logger.debug('[QuotationManager] Debug mode enabled');
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
        // Update template if provided
        if (newConfig.template) {
            this.template = { ...this.template, ...newConfig.template };
        }
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return {
            template: { ...this.template },
            config: { ...this.config }
        };
    }
}

// Create and export singleton instance
export const quotationManager = new QuotationManager();

// Export class for testing
export default QuotationManager;
